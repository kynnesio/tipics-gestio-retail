import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ACTIONS = [
  { id: 'entrada',   icon: '📦', label: 'Entrada\nde lot',    color: '#956C58', bg: '#F5EDE3', desc: 'Registra kg o unitats del proveïdor' },
  { id: 'conversio', icon: '⚖️', label: 'Kg →\nUnitats',      color: '#6B4F3A', bg: '#EDE6DE', desc: 'Converteix kg a unitats envasades' },
  { id: 'enviament', icon: '🚚', label: 'Enviar a\nbotiga',    color: '#212322', bg: '#E6E6E5', desc: 'Porta producte al punt de venda' },
  { id: 'venda',     icon: '💰', label: 'Venda',               color: '#2A5A3A', bg: '#E3EFE7', desc: 'Registra una venda' },
  { id: 'mostra',    icon: '🎁', label: 'Mostra /\nRegal',     color: '#7A4F1A', bg: '#F0E8DC', desc: 'Tast, mostra o obsequi' },
  { id: 'merma',     icon: '⚠️', label: 'Merma',               color: '#8B2A2A', bg: '#F0E3E3', desc: 'Pèrdua o rebuig' },
]

function lotLabel(lot, productos) {
  const prod = productos.find(p => p.id === lot.producto_id)
  const cad = lot.data_caducitat ? ` · cad ${lot.data_caducitat}` : ''
  return `${lot.numero_lot} · ${prod?.sku || prod?.nombre || '?'}${cad}`
}

async function updateLotEstat(lotId) {
  const { data: lot } = await supabase.from('lots').select('*').eq('id', lotId).single()
  if (!lot) return
  if ((lot.unitats_magatzem || 0) === 0 && (lot.unitats_botigues || 0) === 0 && (lot.kg_restants || 0) === 0) {
    await supabase.from('lots').update({ estat: 'esgotat' }).eq('id', lotId)
  }
}

export default function Home() {
  const [action, setAction] = useState(null)
  const [productos, setProductos] = useState([])
  const [tiendas, setTiendas] = useState([])
  const [lots, setLots] = useState([])
  const [stats, setStats] = useState({ magatzem: 0, botigues: 0, lots_actius: 0, alerta: 0 })
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
    const en30d = new Date(avui.getTime() + 30 * 86400000)
    setStats({
      magatzem: actius.reduce((s, l) => s + (l.unitats_magatzem || 0), 0),
      botigues: actius.reduce((s, l) => s + (l.unitats_botigues || 0), 0),
      lots_actius: actius.length,
      alerta: actius.filter(l => l.data_caducitat && new Date(l.data_caducitat) <= en30d).length,
    })
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!action) return
    const defaults = {
      entrada:   { producto_id: '', numero_lot: '', data_caducitat: '', kg_inicials: '', unitats_inicials: '', notes: '' },
      conversio: { lot_id: '', kg_usats: '', unitats_produides: '', notes: '' },
      enviament: { lot_id: '', tienda_id: '', quantitat: '', notes: '' },
      venda:     { lot_id: '', tienda_id: '', quantitat: '', preu_unitari: '', notes: '' },
      mostra:    { lot_id: '', quantitat: '', origen: 'magatzem', tienda_id: '', notes: '' },
      merma:     { lot_id: '', tipus_merma: 'ud', quantitat: '', motiu: 'caducitat', notes: '' },
    }
    setForm(defaults[action] || {})
  }, [action])

  // Auto-fill preu quan canvia el lot a venda
  useEffect(() => {
    if (action !== 'venda' || !form.lot_id) return
    const lot = lots.find(l => l.id === form.lot_id)
    if (!lot) return
    const prod = productos.find(p => p.id === lot.producto_id)
    if (prod?.pvp) setForm(p => ({ ...p, preu_unitari: String(prod.pvp) }))
  }, [form.lot_id])

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const activeLots = lots.filter(l => l.estat === 'actiu')
  const lotsConversio = activeLots.filter(l => (l.kg_restants || 0) > 0)
  const lotsEnviament = activeLots.filter(l => (l.unitats_magatzem || 0) > 0)
  const lotsVenda     = activeLots.filter(l => (l.unitats_botigues || 0) > 0)
  const lotsMostra    = activeLots.filter(l => (l.unitats_magatzem || 0) + (l.unitats_botigues || 0) > 0)
  const selectedLot   = lots.find(l => l.id === form.lot_id)
  const selectedProd  = selectedLot ? productos.find(p => p.id === selectedLot.producto_id) : null

  // Producte seleccionat a l'entrada
  const entradaProd   = productos.find(p => p.id === form.producto_id)
  const entradaEsKg   = entradaProd?.tipus_unitat === 'kg'

  const handleSave = async () => {
    setSaving(true)
    try {
      const avui = new Date().toISOString().split('T')[0]

      // ── ENTRADA ──────────────────────────────────────
      if (action === 'entrada') {
        if (!form.producto_id || !form.numero_lot) { alert('Omple els camps obligatoris.'); setSaving(false); return }

        if (entradaEsKg) {
          // Entrada en kg → caldrà fer Conversió després
          if (!form.kg_inicials) { alert('Introdueix els kg rebuts.'); setSaving(false); return }
          const kgIni = parseFloat(form.kg_inicials)
          const { data: lot, error } = await supabase.from('lots').insert({
            producto_id: form.producto_id, numero_lot: form.numero_lot,
            data_caducitat: form.data_caducitat || null,
            kg_inicials: kgIni, kg_restants: kgIni,
            unitats_produides: 0, unitats_magatzem: 0,
            estat: 'actiu', notes: form.notes || null,
          }).select().single()
          if (error) throw error
          await supabase.from('moviments').insert({
            lot_id: lot.id, producto_id: form.producto_id,
            tipus: 'entrada_kg', quantitat: kgIni, unitat: 'kg', data: avui, notes: form.notes || null,
          })
        } else {
          // Entrada en unitats → va directament al magatzem
          if (!form.unitats_inicials) { alert('Introdueix les unitats rebudes.'); setSaving(false); return }
          const udIni = parseInt(form.unitats_inicials)
          const { data: lot, error } = await supabase.from('lots').insert({
            producto_id: form.producto_id, numero_lot: form.numero_lot,
            data_caducitat: form.data_caducitat || null,
            kg_inicials: null, kg_restants: null,
            unitats_produides: udIni, unitats_magatzem: udIni,
            estat: 'actiu', notes: form.notes || null,
          }).select().single()
          if (error) throw error
          await supabase.from('moviments').insert({
            lot_id: lot.id, producto_id: form.producto_id,
            tipus: 'entrada_ud', quantitat: udIni, unitat: 'ud', data: avui, notes: form.notes || null,
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

      // ── ENVIAMENT ─────────────────────────────────────
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

      // ── VENDA ─────────────────────────────────────────
      else if (action === 'venda') {
        if (!form.lot_id || !form.tienda_id || !form.quantitat) { alert('Omple tots els camps.'); setSaving(false); return }
        const lot = lots.find(l => l.id === form.lot_id)
        const q = parseInt(form.quantitat)
        const preu = parseFloat(form.preu_unitari) || 0
        await supabase.from('lots').update({
          unitats_botigues: Math.max(0, (lot.unitats_botigues || 0) - q),
          unitats_venudes: (lot.unitats_venudes || 0) + q,
        }).eq('id', form.lot_id)
        await supabase.from('moviments').insert({
          lot_id: form.lot_id, producto_id: lot.producto_id, tienda_id: form.tienda_id,
          tipus: 'venda', quantitat: q, unitat: 'ud',
          preu_unitari: preu, total: q * preu, data: avui, notes: form.notes || null,
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
        if (isKg) { update.kg_restants = Math.max(0, (lot.kg_restants || 0) - q) }
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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1.75rem' }}>
        {[
          { label: 'Magatzem', value: stats.magatzem, unit: 'ud' },
          { label: 'Botigues', value: stats.botigues, unit: 'ud' },
          { label: 'Lots actius', value: stats.lots_actius, unit: '' },
          { label: 'Alerta cad.', value: stats.alerta, unit: '', alert: stats.alerta > 0 },
        ].map(s => (
          <div key={s.label} style={{ background: s.alert ? '#F0E3E3' : 'white', border: `1px solid ${s.alert ? 'rgba(139,42,42,0.25)' : 'var(--c-border)'}`, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 300, color: s.alert ? '#8B2A2A' : 'var(--c-text)', lineHeight: 1 }}>
              {s.value}{s.unit && <span style={{ fontSize: 10, marginLeft: 1 }}>{s.unit}</span>}
            </div>
            <div style={{ fontSize: 9, color: s.alert ? '#8B2A2A' : 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bombolles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {ACTIONS.map(a => (
          <button key={a.id} onClick={() => setAction(a.id)} style={{
            background: a.bg, border: `1px solid ${a.color}20`,
            borderRadius: 14, padding: '1.25rem 0.75rem',
            cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8,
            transition: 'transform 0.12s, box-shadow 0.12s',
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
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
                      <option key={p.id} value={p.id}>
                        {p.sku ? `${p.sku} — ` : ''}{p.nombre}
                        {p.tipus_unitat === 'kg' ? ' (kg)' : ' (unitats)'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Indicador del tipus */}
                {form.producto_id && (
                  <div style={{ background: entradaEsKg ? 'var(--c-cream-light)' : '#E3EFE7', borderRadius: 6, padding: '6px 12px', marginBottom: '1rem', fontSize: 12, color: entradaEsKg ? '#956C58' : '#2A5A3A' }}>
                    {entradaEsKg
                      ? '⚖️ Producte en kg — caldrà fer una Conversió per obtenir unitats'
                      : '📦 Producte en unitats — aniran directament al magatzem'}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label>Número de lot *</label>
                    <input value={form.numero_lot} onChange={f('numero_lot')} placeholder={entradaEsKg ? 'G4171 / M4' : 'LL005'} />
                  </div>
                  <div className="form-group"><label>Data caducitat</label>
                    <input type="date" value={form.data_caducitat} onChange={f('data_caducitat')} />
                  </div>
                </div>

                {entradaEsKg ? (
                  <div className="form-group"><label>Kg rebuts *</label>
                    <input type="number" step="0.001" min="0" value={form.kg_inicials} onChange={f('kg_inicials')} placeholder="12.000" />
                  </div>
                ) : (
                  <div className="form-group"><label>Unitats rebudes *</label>
                    <input type="number" min="1" value={form.unitats_inicials} onChange={f('unitats_inicials')} placeholder="144" />
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

            {/* ── ENVIAMENT ── */}
            {action === 'enviament' && (
              <div>
                <div className="form-group"><label>Lot *</label>
                  <select value={form.lot_id} onChange={f('lot_id')}>
                    <option value="">Selecciona lot...</option>
                    {lotsEnviament.map(l => <option key={l.id} value={l.id}>{lotLabel(l, productos)} · {l.unitats_magatzem}ud mag.</option>)}
                  </select>
                </div>
                {lotsEnviament.length === 0 && <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginBottom: '1rem' }}>Sense unitats al magatzem.</p>}
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

            {/* ── VENDA ── */}
            {action === 'venda' && (
              <div>
                <div className="form-group"><label>Lot *</label>
                  <select value={form.lot_id} onChange={f('lot_id')}>
                    <option value="">Selecciona lot...</option>
                    {lotsVenda.map(l => <option key={l.id} value={l.id}>{lotLabel(l, productos)} · {l.unitats_botigues}ud bot.</option>)}
                  </select>
                </div>
                {lotsVenda.length === 0 && <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginBottom: '1rem' }}>Sense unitats a botigues. Primer fes un Enviament.</p>}
                <div className="form-group"><label>Botiga *</label>
                  <select value={form.tienda_id} onChange={f('tienda_id')}>
                    <option value="">Selecciona botiga...</option>
                    {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Unitats *{selectedLot ? ` (màx. ${selectedLot.unitats_botigues})` : ''}</label>
                    <input type="number" min="1" max={selectedLot?.unitats_botigues} value={form.quantitat} onChange={f('quantitat')} placeholder="3" />
                  </div>
                  <div className="form-group"><label>Preu/ud (€)</label>
                    <input type="number" step="0.01" min="0" value={form.preu_unitari} onChange={f('preu_unitari')} />
                  </div>
                </div>
                {form.quantitat && form.preu_unitari && (
                  <div style={{ background: '#E3EFE7', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: '1rem', color: '#2A5A3A', fontWeight: 500 }}>
                    Total: {(parseFloat(form.quantitat) * parseFloat(form.preu_unitari)).toFixed(2)}€
                  </div>
                )}
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
                  <div className="form-group"><label>Unitats *</label><input type="number" min="1" value={form.quantitat} onChange={f('quantitat')} placeholder="1" /></div>
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
                <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={f('notes')} placeholder="Per a qui és..." /></div>
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
                  <div className="form-group"><label>Quantitat *</label><input type="number" step="0.001" min="0" value={form.quantitat} onChange={f('quantitat')} /></div>
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
                <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={f('notes')} /></div>
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
