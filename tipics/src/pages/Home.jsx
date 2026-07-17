import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ACTIONS = [
  { id: 'entrada',   icon: '📦', label: 'Entrada\nde lot',    color: '#956C58', bg: '#F5EDE3', desc: 'Registra kg o unitats del proveïdor' },
  { id: 'conversio', icon: '⚖️', label: 'Kg →\nUnitats',      color: '#6B4F3A', bg: '#EDE6DE', desc: 'Converteix kg a unitats envasades' },
  { id: 'enviament', icon: '🚚', label: 'Enviar a\nbotiga',    color: '#212322', bg: '#E6E6E5', desc: 'Porta producte al punt de venda' },
  { id: 'mostra',    icon: '🎁', label: 'Mostra /\nRegal',     color: '#7A4F1A', bg: '#F0E8DC', desc: 'Tast, mostra o obsequi' },
  { id: 'merma',     icon: '⚠️', label: 'Merma',               color: '#8B2A2A', bg: '#F0E3E3', desc: 'Pèrdua o rebuig' },
]

const DIES_ALERTA = 75 // 2 mesos i mig

function lotLabel(lot, productos) {
  const prod = productos.find(p => p.id === lot.producto_id)
  const cad = lot.data_caducitat ? ` · cad ${lot.data_caducitat}` : ''
  return `${lot.numero_lot} · ${prod?.sku || prod?.nombre || '?'}${cad}`
}

async function updateLotEstat(lotId) {
  const { data: lot } = await supabase.from('lots').select('*').eq('id', lotId).single()
  if (!lot) return
  if ((lot.unitats_magatzem || 0) === 0 && (lot.unitats_botigues || 0) === 0 && (lot.kg_restants || 0) === 0)
    await supabase.from('lots').update({ estat: 'esgotat' }).eq('id', lotId)
}

export default function Home() {
  const [action, setAction] = useState(null)
  const [productos, setProductos] = useState([])
  const [tiendas, setTiendas] = useState([])
  const [lots, setLots] = useState([])
  const [stockPerSKU, setStockPerSKU] = useState([])
  const [alerta, setAlerta] = useState(0)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)

  const loadData = async () => {
    const [{ data: prods }, { data: tiend }, { data: lotsData }] = await Promise.all([
      supabase.from('productos').select('id, nombre, sku, pvp, tipus_unitat').eq('activo', true).order('sku'),
      supabase.from('tiendas').select('id, nombre').eq('activa', true).order('nombre'),
      supabase.from('lots').select('*').order('data_caducitat', { ascending: true }),
    ])
    setProductos(prods || [])
    setTiendas(tiend || [])
    setLots(lotsData || [])

    const actius = (lotsData || []).filter(l => l.estat === 'actiu')
    const avui = new Date()
    const enNDies = new Date(avui.getTime() + DIES_ALERTA * 86400000)

    // Estoc per SKU al magatzem
    const skuMap = {}
    actius.forEach(lot => {
      const prod = (prods || []).find(p => p.id === lot.producto_id)
      const key = prod?.sku || prod?.nombre || '?'
      skuMap[key] = (skuMap[key] || 0) + (lot.unitats_magatzem || 0)
    })
    setStockPerSKU(Object.entries(skuMap).sort((a, b) => a[0].localeCompare(b[0])))
    setAlerta(actius.filter(l => l.data_caducitat && new Date(l.data_caducitat) <= enNDies).length)
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!action) return
    const prod = productos.find(p => p.id === form.producto_id)
    const defaults = {
      entrada:   { producto_id: '', numero_lot: '', data_caducitat: '', tipus_rebuda: prod?.tipus_unitat || 'ud', quantitat_rebuda: '', notes: '' },
      conversio: { lot_id: '', kg_usats: '', unitats_produides: '', notes: '' },
      enviament: { lot_id: '', tienda_id: '', quantitat: '', notes: '' },
      mostra:    { lot_id: '', quantitat: '', origen: 'magatzem', tienda_id: '', notes: '' },
      merma:     { lot_id: '', tipus_merma: 'ud', quantitat: '', motiu: 'caducitat', notes: '' },
    }
    setForm(defaults[action] || {})
  }, [action])

  // Auto-ajust tipus_rebuda quan canvia el producte a entrada
  useEffect(() => {
    if (action !== 'entrada' || !form.producto_id) return
    const prod = productos.find(p => p.id === form.producto_id)
    if (prod?.tipus_unitat) setForm(p => ({ ...p, tipus_rebuda: prod.tipus_unitat }))
  }, [form.producto_id])

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const activeLots     = lots.filter(l => l.estat === 'actiu')
  const lotsConversio  = activeLots.filter(l => (l.kg_restants || 0) > 0)
  const lotsEnviament  = activeLots.filter(l => (l.unitats_magatzem || 0) > 0)
  const lotsMostra     = activeLots.filter(l => (l.unitats_magatzem || 0) + (l.unitats_botigues || 0) > 0)
  const selectedLot    = lots.find(l => l.id === form.lot_id)

  const handleSave = async () => {
    setSaving(true)
    try {
      const avui = new Date().toISOString().split('T')[0]

      // ── ENTRADA ──────────────────────────────────────
      if (action === 'entrada') {
        if (!form.producto_id || !form.numero_lot || !form.quantitat_rebuda) {
          alert('Omple els camps obligatoris.'); setSaving(false); return
        }
        const isKg = form.tipus_rebuda === 'kg'
        const qty  = parseFloat(form.quantitat_rebuda)

        if (isKg) {
          const { data: lot, error } = await supabase.from('lots').insert({
            producto_id: form.producto_id, numero_lot: form.numero_lot,
            data_caducitat: form.data_caducitat || null,
            kg_inicials: qty, kg_restants: qty,
            unitats_produides: 0, unitats_magatzem: 0,
            estat: 'actiu', notes: form.notes || null,
          }).select().single()
          if (error) throw error
          await supabase.from('moviments').insert({
            lot_id: lot.id, producto_id: form.producto_id,
            tipus: 'entrada_kg', quantitat: qty, unitat: 'kg', data: avui, notes: form.notes || null,
          })
        } else {
          const ud = parseInt(qty)
          const { data: lot, error } = await supabase.from('lots').insert({
            producto_id: form.producto_id, numero_lot: form.numero_lot,
            data_caducitat: form.data_caducitat || null,
            kg_inicials: null, kg_restants: null,
            unitats_produides: ud, unitats_magatzem: ud,
            estat: 'actiu', notes: form.notes || null,
          }).select().single()
          if (error) throw error
          await supabase.from('moviments').insert({
            lot_id: lot.id, producto_id: form.producto_id,
            tipus: 'entrada_ud', quantitat: ud, unitat: 'ud', data: avui, notes: form.notes || null,
          })
        }
      }

      // ── CONVERSIÓ ─────────────────────────────────────
      else if (action === 'conversio') {
        if (!form.lot_id || !form.kg_usats || !form.unitats_produides) { alert('Omple tots els camps.'); setSaving(false); return }
        const lot = lots.find(l => l.id === form.lot_id)
        const kgU = parseFloat(form.kg_usats)
        const udP = parseInt(form.unitats_produides)
        if (kgU > (lot.kg_restants || 0)) { alert(`Només tens ${lot.kg_restants}kg disponibles.`); setSaving(false); return }
        await supabase.from('lots').update({
          kg_restants: (lot.kg_restants || 0) - kgU,
          unitats_produides: (lot.unitats_produides || 0) + udP,
          unitats_magatzem: (lot.unitats_magatzem || 0) + udP,
        }).eq('id', form.lot_id)
        await supabase.from('moviments').insert({
          lot_id: form.lot_id, producto_id: lot.producto_id,
          tipus: 'conversio_ud', quantitat: udP, unitat: 'ud', data: avui,
          notes: `${kgU}kg → ${udP} unitats${form.notes ? ' · ' + form.notes : ''}`,
        })
      }

      // ── ENVIAR A BOTIGA ───────────────────────────────
      else if (action === 'enviament') {
        if (!form.lot_id || !form.tienda_id || !form.quantitat) { alert('Omple tots els camps.'); setSaving(false); return }
        const lot = lots.find(l => l.id === form.lot_id)
        const q = parseInt(form.quantitat)
        if (q > (lot.unitats_magatzem || 0)) { alert(`Només tens ${lot.unitats_magatzem} unitats al magatzem.`); setSaving(false); return }
        await supabase.from('lots').update({
          unitats_magatzem: (lot.unitats_magatzem || 0) - q,
          unitats_botigues: (lot.unitats_botigues || 0) + q,
        }).eq('id', form.lot_id)
        await supabase.from('moviments').insert({
          lot_id: form.lot_id, producto_id: lot.producto_id, tienda_id: form.tienda_id,
          tipus: 'enviament', quantitat: q, unitat: 'ud', data: avui, notes: form.notes || null,
        })
        await updateLotEstat(form.lot_id)
      }

      // ── MOSTRA ────────────────────────────────────────
      else if (action === 'mostra') {
        if (!form.lot_id || !form.quantitat) { alert('Omple els camps obligatoris.'); setSaving(false); return }
        const lot = lots.find(l => l.id === form.lot_id)
        const q = parseInt(form.quantitat)
        const update = { unitats_mostres: (lot.unitats_mostres || 0) + q }
        if (form.origen === 'botiga') update.unitats_botigues = Math.max(0, (lot.unitats_botigues || 0) - q)
        else update.unitats_magatzem = Math.max(0, (lot.unitats_magatzem || 0) - q)
        await supabase.from('lots').update(update).eq('id', form.lot_id)
        await supabase.from('moviments').insert({
          lot_id: form.lot_id, producto_id: lot.producto_id, tienda_id: form.tienda_id || null,
          tipus: 'mostra', quantitat: q, unitat: 'ud', data: avui, notes: form.notes || null,
        })
      }

      // ── MERMA ─────────────────────────────────────────
      else if (action === 'merma') {
        if (!form.lot_id || !form.quantitat) { alert('Omple els camps obligatoris.'); setSaving(false); return }
        const lot = lots.find(l => l.id === form.lot_id)
        const q = parseFloat(form.quantitat)
        const isKg = form.tipus_merma === 'kg'
        const update = {}
        if (isKg) update.kg_restants = Math.max(0, (lot.kg_restants || 0) - q)
        else { update.unitats_magatzem = Math.max(0, (lot.unitats_magatzem || 0) - q); update.unitats_merma = (lot.unitats_merma || 0) + q }
        await supabase.from('lots').update(update).eq('id', form.lot_id)
        await supabase.from('moviments').insert({
          lot_id: form.lot_id, producto_id: lot.producto_id,
          tipus: 'merma', quantitat: q, unitat: isKg ? 'kg' : 'ud',
          motiu_merma: form.motiu, data: avui, notes: form.notes || null,
        })
        await updateLotEstat(form.lot_id)
      }

      setSuccess(`✓ ${ACTIONS.find(a => a.id === action)?.label.replace('\n', ' ')} registrat`)
      setAction(null)
      await loadData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) { alert('Error: ' + e.message) }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {success && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#2A5A3A', color: 'white', padding: '10px 24px', borderRadius: 20, fontSize: 13, fontWeight: 500, zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          {success}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 300, letterSpacing: '0.06em' }}>Operacions</h1>
        <div style={{ width: 28, height: 2, background: '#956C58', marginTop: 6 }} />
      </div>

      {/* Estoc per SKU al magatzem */}
      <div style={{ background: 'white', border: '1px solid var(--c-border)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.75rem' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
          Estoc al magatzem
        </div>
        {stockPerSKU.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--c-text-light)' }}>Sense lots actius.</div>
        ) : (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {stockPerSKU.map(([sku, ud]) => (
              <div key={sku} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ background: 'var(--c-cream)', color: '#956C58', borderRadius: 4, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{sku}</span>
                <span style={{ fontSize: 26, fontWeight: 300, lineHeight: 1 }}>{ud}</span>
                <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>ud</span>
              </div>
            ))}
          </div>
        )}
        {alerta > 0 && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--c-border)', fontSize: 12, color: '#8B2A2A' }}>
            ⚠️ {alerta} lot{alerta > 1 ? 's' : ''} caduca{alerta > 1 ? 'n' : ''} en menys de {DIES_ALERTA} dies
          </div>
        )}
      </div>

      {/* Bombolles — 5 accions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {ACTIONS.map((a, i) => (
          <button key={a.id} onClick={() => setAction(a.id)} style={{
            background: a.bg, border: `1px solid ${a.color}20`,
            borderRadius: 14, padding: '1.25rem 0.75rem',
            cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8,
            transition: 'transform 0.12s, box-shadow 0.12s',
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
            // Centra l'últim element si la fila no és completa
            ...(ACTIONS.length % 3 !== 0 && i === ACTIONS.length - 1 ? { gridColumn: '2' } : {}),
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.05)' }}
          >
            <div style={{ fontSize: 28 }}>{a.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: a.color, textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3 }}>{a.label}</div>
            <div style={{ fontSize: 10, color: a.color + 'aa', textAlign: 'center', lineHeight: 1.3 }}>{a.desc}</div>
          </button>
        ))}
      </div>

      {/* Modal */}
      {action && (
        <div className="modal-overlay" onClick={() => setAction(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{ACTIONS.find(a2 => a2.id === action)?.icon}</span>
                <h2>{ACTIONS.find(a2 => a2.id === action)?.label.replace('\n', ' ')}</h2>
              </div>
              <button className="btn btn-sm" onClick={() => setAction(null)}>✕</button>
            </div>

            {/* ── ENTRADA ── */}
            {action === 'entrada' && (
              <div>
                <div className="form-group"><label>Producte (SKU) *</label>
                  <select value={form.producto_id} onChange={f('producto_id')}>
                    <option value="">Selecciona producte...</option>
                    {productos.map(p => (
                      <option key={p.id} value={p.id}>{p.sku ? `${p.sku} — ` : ''}{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label>Número de lot *</label>
                    <input value={form.numero_lot} onChange={f('numero_lot')} placeholder="G4171 / LL005" />
                  </div>
                  <div className="form-group"><label>Data caducitat</label>
                    <input type="date" value={form.data_caducitat} onChange={f('data_caducitat')} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Format</label>
                    <select value={form.tipus_rebuda} onChange={f('tipus_rebuda')}>
                      <option value="ud">Unitats</option>
                      <option value="kg">Kg</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Rebuda *</label>
                    <input type="number" step={form.tipus_rebuda === 'kg' ? '0.001' : '1'} min="0"
                      value={form.quantitat_rebuda} onChange={f('quantitat_rebuda')}
                      placeholder={form.tipus_rebuda === 'kg' ? '12.000' : '144'} />
                  </div>
                </div>
                {form.tipus_rebuda === 'kg' && (
                  <div style={{ background: 'var(--c-cream-light)', borderRadius: 6, padding: '6px 12px', marginBottom: '1rem', fontSize: 12, color: '#956C58' }}>
                    ⚖️ Entrada en kg — caldrà fer una Conversió per obtenir unitats
                  </div>
                )}
                <div className="form-group"><label>Notes</label>
                  <textarea rows={2} value={form.notes} onChange={f('notes')} placeholder="Proveïdor, albarà..." />
                </div>
              </div>
            )}

            {/* ── CONVERSIÓ ── */}
            {action === 'conversio' && (
              <div>
                <div className="form-group"><label>Lot *</label>
                  <select value={form.lot_id} onChange={f('lot_id')}>
                    <option value="">Selecciona lot...</option>
                    {lotsConversio.map(l => <option key={l.id} value={l.id}>{lotLabel(l, productos)} · {l.kg_restants}kg disp.</option>)}
                  </select>
                </div>
                {lotsConversio.length === 0 && <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginBottom: '1rem' }}>Sense lots amb kg pendents de convertir.</p>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label>Kg usats *</label>
                    <input type="number" step="0.001" min="0" value={form.kg_usats} onChange={f('kg_usats')} placeholder="5.000" />
                  </div>
                  <div className="form-group"><label>Unitats produïdes *</label>
                    <input type="number" min="1" value={form.unitats_produides} onChange={f('unitats_produides')} placeholder="47" />
                  </div>
                </div>
                {form.kg_usats && form.unitats_produides && (
                  <div style={{ background: 'var(--c-cream-light)', borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: '1rem', color: 'var(--c-text-muted)' }}>
                    Rendiment: {(parseFloat(form.unitats_produides) / parseFloat(form.kg_usats)).toFixed(1)} ud/kg
                  </div>
                )}
                <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={f('notes')} /></div>
              </div>
            )}

            {/* ── ENVIAR A BOTIGA ── */}
            {action === 'enviament' && (
              <div>
                <div className="form-group"><label>Lot *</label>
                  <select value={form.lot_id} onChange={f('lot_id')}>
                    <option value="">Selecciona lot...</option>
                    {lotsEnviament.map(l => <option key={l.id} value={l.id}>{lotLabel(l, productos)} · {l.unitats_magatzem}ud mag.</option>)}
                  </select>
                </div>
                {lotsEnviament.length === 0 && <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginBottom: '1rem' }}>Sense unitats al magatzem. Primer fes una Entrada o Conversió.</p>}
                <div className="form-group"><label>Botiga *</label>
                  <select value={form.tienda_id} onChange={f('tienda_id')}>
                    <option value="">Selecciona botiga...</option>
                    {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Unitats *{selectedLot ? ` (màx. ${selectedLot.unitats_magatzem})` : ''}</label>
                  <input type="number" min="1" max={selectedLot?.unitats_magatzem} value={form.quantitat} onChange={f('quantitat')} placeholder="10" />
                </div>
                <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={f('notes')} /></div>
              </div>
            )}

            {/* ── MOSTRA ── */}
            {action === 'mostra' && (
              <div>
                <div className="form-group"><label>Lot *</label>
                  <select value={form.lot_id} onChange={f('lot_id')}>
                    <option value="">Selecciona lot...</option>
                    {lotsMostra.map(l => <option key={l.id} value={l.id}>{lotLabel(l, productos)} · {l.unitats_magatzem}mag/{l.unitats_botigues}bot</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label>Unitats *</label>
                    <input type="number" min="1" value={form.quantitat} onChange={f('quantitat')} placeholder="1" />
                  </div>
                  <div className="form-group"><label>Origen</label>
                    <select value={form.origen} onChange={f('origen')}>
                      <option value="magatzem">Magatzem</option>
                      <option value="botiga">Botiga</option>
                    </select>
                  </div>
                </div>
                {form.origen === 'botiga' && (
                  <div className="form-group"><label>Botiga</label>
                    <select value={form.tienda_id} onChange={f('tienda_id')}>
                      <option value="">Selecciona...</option>
                      {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group"><label>Notes</label>
                  <textarea rows={2} value={form.notes} onChange={f('notes')} placeholder="Per a qui és..." />
                </div>
              </div>
            )}

            {/* ── MERMA ── */}
            {action === 'merma' && (
              <div>
                <div className="form-group"><label>Lot *</label>
                  <select value={form.lot_id} onChange={f('lot_id')}>
                    <option value="">Selecciona lot...</option>
                    {activeLots.map(l => <option key={l.id} value={l.id}>{lotLabel(l, productos)}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label>Tipus</label>
                    <select value={form.tipus_merma} onChange={f('tipus_merma')}>
                      <option value="ud">Unitats</option>
                      <option value="kg">Kg</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Quantitat *</label>
                    <input type="number" step="0.001" min="0" value={form.quantitat} onChange={f('quantitat')} />
                  </div>
                  <div className="form-group"><label>Motiu</label>
                    <select value={form.motiu} onChange={f('motiu')}>
                      <option value="caducitat">Caducitat</option>
                      <option value="trencament">Trencament</option>
                      <option value="robatori">Robatori</option>
                      <option value="devolucio">Devolució</option>
                      <option value="altre">Altre</option>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label>Notes</label>
                  <textarea rows={2} value={form.notes} onChange={f('notes')} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn" onClick={() => setAction(null)}>Cancel·lar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardant...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
