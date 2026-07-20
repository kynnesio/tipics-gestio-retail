import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ACTIONS = [
  { id: 'entrada',   icon: '📦', label: 'Entrada\nde lot',   color: '#956C58', bg: '#F5EDE3', desc: 'Registra kg o unitats del proveïdor' },
  { id: 'conversio', icon: '⚖️', label: 'Kg →\nUnitats',     color: '#6B4F3A', bg: '#EDE6DE', desc: 'Converteix kg a unitats envasades' },
  { id: 'enviament', icon: '🚚', label: 'Enviar a\nbotiga',   color: '#1A1918', bg: '#E6E6E5', desc: 'Porta producte a una o més botigues' },
  { id: 'mostra',    icon: '🎁', label: 'Mostra /\nRegal',    color: '#7A4F1A', bg: '#F0E8DC', desc: 'Tast, mostra o obsequi' },
  { id: 'merma',     icon: '⚠️', label: 'Merma',              color: '#8B2A2A', bg: '#F0E3E3', desc: 'Pèrdua o rebuig' },
]

const LOW_STOCK = 40
const DIES_ALERTA = 75

function lotLabel(lot, productos) {
  const prod = productos.find(p => p.id === lot.producto_id)
  const cad = lot.data_caducitat ? ` · ${lot.data_caducitat}` : ''
  return `${lot.numero_lot} · ${prod?.sku || '?'} · ${lot.unitats_magatzem}ud${cad}`
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
  const [cadAlerta, setCadAlerta] = useState(0)
  const [seguiment, setSeguiment] = useState([])
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)

  // Sol·licitar permisos de notificació
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default')
      Notification.requestPermission()
  }, [])

  const loadData = async () => {
    const [{ data: prods }, { data: tiend }, { data: lotsData }, { data: ultimsEnv }] = await Promise.all([
      supabase.from('productos').select('id, nombre, sku, pvp, tipus_unitat').eq('activo', true).order('sku'),
      supabase.from('tiendas').select('id, nombre, dies_seguiment, darrer_seguiment').eq('activa', true).order('nombre'),
      supabase.from('lots').select('*').order('data_caducitat', { ascending: true }),
      supabase.from('moviments').select('tienda_id, data').eq('tipus', 'enviament').not('tienda_id', 'is', null),
    ])
    setProductos(prods || [])
    setTiendas(tiend || [])
    setLots(lotsData || [])

    const actius = (lotsData || []).filter(l => l.estat === 'actiu')
    const avui = new Date()
    const enNDies = new Date(avui.getTime() + DIES_ALERTA * 86400000)

    // Estoc per SKU
    const skuMap = {}
    actius.forEach(lot => {
      const prod = (prods || []).find(p => p.id === lot.producto_id)
      const key = prod?.sku || prod?.nombre || '?'
      skuMap[key] = (skuMap[key] || 0) + (lot.unitats_magatzem || 0)
    })
    const skuList = Object.entries(skuMap).sort((a, b) => a[0].localeCompare(b[0]))
    setStockPerSKU(skuList)
    setCadAlerta(actius.filter(l => l.data_caducitat && new Date(l.data_caducitat) <= enNDies).length)

    // Notificació estoc baix
    if ('Notification' in window && Notification.permission === 'granted') {
      skuList.forEach(([sku, ud]) => {
        if (ud < LOW_STOCK) {
          const key = `notif_baixestoc_${sku}`
          const last = sessionStorage.getItem(key)
          if (!last || Date.now() - parseInt(last) > 3600000) {
            new Notification('Típics — Estoc baix', { body: `${sku}: ${ud} unitats al magatzem` })
            sessionStorage.setItem(key, String(Date.now()))
          }
        }
      })
    }

    // Seguiment botigues (totes les que han rebut almenys un enviament)
    const ultimPerTienda = {}
    ;(ultimsEnv || []).forEach(m => {
      if (!ultimPerTienda[m.tienda_id] || m.data > ultimPerTienda[m.tienda_id])
        ultimPerTienda[m.tienda_id] = m.data
    })
    const segData = (tiend || [])
      .filter(t => ultimPerTienda[t.id])
      .map(t => {
        const ultimEnv = ultimPerTienda[t.id]
        const darrer = (t.darrer_seguiment && t.darrer_seguiment >= ultimEnv) ? t.darrer_seguiment : ultimEnv
        const dies = Math.floor((avui - new Date(darrer)) / 86400000)
        return { ...t, dies, darrer, ultimEnv }
      })
      .sort((a, b) => b.dies - a.dies)
    setSeguiment(segData)
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!action) return
    const prod = productos.find(p => p.id === form.producto_id)
    const defaults = {
      entrada:   { producto_id: '', numero_lot: '', data_caducitat: '', tipus_rebuda: prod?.tipus_unitat || 'ud', quantitat_rebuda: '', notes: '' },
      conversio: { lot_id: '', kg_usats: '', unitats_produides: '', notes: '' },
      enviament: { tienda_id: '', linies: [{ id: 1, lot_id: '', quantitat: '' }], notes: '' },
      mostra:    { lot_id: '', quantitat: '', origen: 'magatzem', tienda_id: '', notes: '' },
      merma:     { lot_id: '', tipus_merma: 'ud', quantitat: '', motiu: 'caducitat', notes: '' },
    }
    setForm(defaults[action] || {})
  }, [action])

  useEffect(() => {
    if (action !== 'entrada' || !form.producto_id) return
    const prod = productos.find(p => p.id === form.producto_id)
    if (prod?.tipus_unitat) setForm(p => ({ ...p, tipus_rebuda: prod.tipus_unitat }))
  }, [form.producto_id])

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const activeLots    = lots.filter(l => l.estat === 'actiu')
  const lotsConversio = activeLots.filter(l => (l.kg_restants || 0) > 0)
  const lotsEnviament = activeLots.filter(l => (l.unitats_magatzem || 0) > 0)
  const lotsMostra    = activeLots.filter(l => (l.unitats_magatzem || 0) + (l.unitats_botigues || 0) > 0)
  const selectedLot   = lots.find(l => l.id === form.lot_id)

  // Línies d'enviament
  const addLinia    = () => setForm(p => ({ ...p, linies: [...(p.linies || []), { id: Date.now(), lot_id: '', quantitat: '' }] }))
  const removeLinia = (id) => setForm(p => ({ ...p, linies: (p.linies || []).filter(l => l.id !== id) }))
  const updateLinia = (id, key, val) => setForm(p => ({ ...p, linies: (p.linies || []).map(l => l.id === id ? { ...l, [key]: val } : l) }))

  const handleContactat = async (tiendaId) => {
    const avuiStr = new Date().toISOString().split('T')[0]
    await supabase.from('tiendas').update({ darrer_seguiment: avuiStr }).eq('id', tiendaId)
    await loadData()
    setSuccess('✓ Contacte registrat')
    setTimeout(() => setSuccess(null), 2000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const avui = new Date().toISOString().split('T')[0]

      if (action === 'entrada') {
        if (!form.producto_id || !form.numero_lot || !form.quantitat_rebuda) { alert('Omple els camps obligatoris.'); setSaving(false); return }
        const isKg = form.tipus_rebuda === 'kg', qty = parseFloat(form.quantitat_rebuda)
        if (isKg) {
          const { data: lot, error } = await supabase.from('lots').insert({ producto_id: form.producto_id, numero_lot: form.numero_lot, data_caducitat: form.data_caducitat || null, kg_inicials: qty, kg_restants: qty, unitats_produides: 0, unitats_magatzem: 0, estat: 'actiu', notes: form.notes || null }).select().single()
          if (error) throw error
          await supabase.from('moviments').insert({ lot_id: lot.id, producto_id: form.producto_id, tipus: 'entrada_kg', quantitat: qty, unitat: 'kg', data: avui, notes: form.notes || null })
        } else {
          const ud = parseInt(qty)
          const { data: lot, error } = await supabase.from('lots').insert({ producto_id: form.producto_id, numero_lot: form.numero_lot, data_caducitat: form.data_caducitat || null, kg_inicials: null, kg_restants: null, unitats_produides: ud, unitats_magatzem: ud, estat: 'actiu', notes: form.notes || null }).select().single()
          if (error) throw error
          await supabase.from('moviments').insert({ lot_id: lot.id, producto_id: form.producto_id, tipus: 'entrada_ud', quantitat: ud, unitat: 'ud', data: avui, notes: form.notes || null })
        }
      }

      else if (action === 'conversio') {
        if (!form.lot_id || !form.kg_usats || !form.unitats_produides) { alert('Omple tots els camps.'); setSaving(false); return }
        const lot = lots.find(l => l.id === form.lot_id)
        const kgU = parseFloat(form.kg_usats), udP = parseInt(form.unitats_produides)
        if (kgU > (lot.kg_restants || 0)) { alert(`Només tens ${lot.kg_restants}kg disponibles.`); setSaving(false); return }
        await supabase.from('lots').update({ kg_restants: (lot.kg_restants || 0) - kgU, unitats_produides: (lot.unitats_produides || 0) + udP, unitats_magatzem: (lot.unitats_magatzem || 0) + udP }).eq('id', form.lot_id)
        await supabase.from('moviments').insert({ lot_id: form.lot_id, producto_id: lot.producto_id, tipus: 'conversio_ud', quantitat: udP, unitat: 'ud', data: avui, notes: `${kgU}kg → ${udP} unitats${form.notes ? ' · ' + form.notes : ''}` })
      }

      else if (action === 'enviament') {
        if (!form.tienda_id) { alert('Selecciona una botiga.'); setSaving(false); return }
        const linies = form.linies || []
        if (linies.length === 0 || linies.some(l => !l.lot_id || !l.quantitat || parseInt(l.quantitat) <= 0)) {
          alert('Omple totes les línies correctament.'); setSaving(false); return
        }
        for (const linia of linies) {
          const lot = lots.find(l => l.id === linia.lot_id)
          const q = parseInt(linia.quantitat)
          if (q > (lot?.unitats_magatzem || 0)) { alert(`${lot?.numero_lot}: només tens ${lot?.unitats_magatzem} unitats.`); setSaving(false); return }
          await supabase.from('lots').update({ unitats_magatzem: (lot.unitats_magatzem || 0) - q, unitats_botigues: (lot.unitats_botigues || 0) + q }).eq('id', linia.lot_id)
          await supabase.from('moviments').insert({ lot_id: linia.lot_id, producto_id: lot.producto_id, tienda_id: form.tienda_id, tipus: 'enviament', quantitat: q, unitat: 'ud', data: avui, notes: form.notes || null })
          await updateLotEstat(linia.lot_id)
        }
      }

      else if (action === 'mostra') {
        if (!form.lot_id || !form.quantitat) { alert('Omple els camps obligatoris.'); setSaving(false); return }
        const lot = lots.find(l => l.id === form.lot_id), q = parseInt(form.quantitat)
        const update = { unitats_mostres: (lot.unitats_mostres || 0) + q }
        if (form.origen === 'botiga') update.unitats_botigues = Math.max(0, (lot.unitats_botigues || 0) - q)
        else update.unitats_magatzem = Math.max(0, (lot.unitats_magatzem || 0) - q)
        await supabase.from('lots').update(update).eq('id', form.lot_id)
        await supabase.from('moviments').insert({ lot_id: form.lot_id, producto_id: lot.producto_id, tienda_id: form.tienda_id || null, tipus: 'mostra', quantitat: q, unitat: 'ud', data: avui, notes: form.notes || null })
      }

      else if (action === 'merma') {
        if (!form.lot_id || !form.quantitat) { alert('Omple els camps obligatoris.'); setSaving(false); return }
        const lot = lots.find(l => l.id === form.lot_id), q = parseFloat(form.quantitat), isKg = form.tipus_merma === 'kg'
        const update = {}
        if (isKg) update.kg_restants = Math.max(0, (lot.kg_restants || 0) - q)
        else { update.unitats_magatzem = Math.max(0, (lot.unitats_magatzem || 0) - q); update.unitats_merma = (lot.unitats_merma || 0) + q }
        await supabase.from('lots').update(update).eq('id', form.lot_id)
        await supabase.from('moviments').insert({ lot_id: form.lot_id, producto_id: lot.producto_id, tipus: 'merma', quantitat: q, unitat: isKg ? 'kg' : 'ud', motiu_merma: form.motiu, data: avui, notes: form.notes || null })
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
      {/* Toast */}
      {success && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#2D6A4F', color: 'white', padding: '10px 24px', borderRadius: 20, fontSize: 13, fontWeight: 500, zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          {success}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 26, fontWeight: 300, letterSpacing: '0.04em' }}>Operacions</h1>
        <div style={{ width: 28, height: 2, background: '#956C58', marginTop: 8 }} />
      </div>

      {/* Estoc per SKU */}
      <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05),0 2px 10px rgba(0,0,0,0.06)', padding: '1.1rem 1.25rem', marginBottom: '1.5rem', border: '0.5px solid rgba(26,25,24,0.07)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#ABA7A4', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
          Estoc al magatzem
        </div>
        {stockPerSKU.length === 0 ? (
          <div style={{ fontSize: 13, color: '#ABA7A4' }}>Sense lots actius.</div>
        ) : (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {stockPerSKU.map(([sku, ud]) => {
              const baixEstoc = ud < LOW_STOCK
              return (
                <div key={sku} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ background: baixEstoc ? '#F8EFEF' : '#F5F0EA', color: baixEstoc ? '#8B2A2A' : '#956C58', borderRadius: 5, padding: '1px 9px', fontSize: 11, fontWeight: 700 }}>{sku}</span>
                  <span style={{ fontSize: 28, fontWeight: 300, lineHeight: 1, color: baixEstoc ? '#8B2A2A' : '#1A1918' }}>{ud}</span>
                  <span style={{ fontSize: 11, color: '#ABA7A4' }}>ud{baixEstoc && ' ⚠️'}</span>
                </div>
              )
            })}
          </div>
        )}
        {cadAlerta > 0 && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #F0EBE4', fontSize: 12, color: '#8B2A2A' }}>
            ⚠️ {cadAlerta} lot{cadAlerta > 1 ? 's' : ''} caduca{cadAlerta > 1 ? 'n' : ''} en menys de {DIES_ALERTA} dies
          </div>
        )}
      </div>

      {/* Bombolles d'acció */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '2rem' }}>
        {ACTIONS.map((a, i) => (
          <button key={a.id} onClick={() => setAction(a.id)} style={{
            background: a.bg, border: `1px solid ${a.color}18`,
            borderRadius: 16, padding: '1.25rem 0.75rem',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            transition: 'transform 0.12s, box-shadow 0.12s', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            ...(ACTIONS.length % 3 !== 0 && i === ACTIONS.length - 1 ? { gridColumn: '2' } : {}),
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <div style={{ fontSize: 26 }}>{a.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: a.color, textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3 }}>{a.label}</div>
            <div style={{ fontSize: 10, color: a.color + '99', textAlign: 'center', lineHeight: 1.3 }}>{a.desc}</div>
          </button>
        ))}
      </div>

      {/* Seguiment botigues — DESPRÉS dels botons */}
      {seguiment.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#ABA7A4', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
            Seguiment botigues
          </div>
          <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05),0 2px 10px rgba(0,0,0,0.06)', border: '0.5px solid rgba(26,25,24,0.07)' }}>
            {seguiment.map((t, i) => {
              const limit = t.dies_seguiment || 15
              const overdue = t.dies >= limit
              return (
                <div key={t.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '11px 16px',
                  borderBottom: i < seguiment.length - 1 ? '1px solid rgba(26,25,24,0.06)' : 'none',
                  background: overdue ? 'rgba(139,42,42,0.025)' : 'transparent',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: overdue ? '#8B2A2A' : '#1A1918' }}>{t.nombre}</span>
                    <span style={{ fontSize: 12, marginLeft: 8, color: overdue ? 'rgba(139,42,42,0.65)' : '#ABA7A4' }}>
                      {t.dies === 0 ? 'avui' : `fa ${t.dies} dies`}
                    </span>
                  </div>
                  <button onClick={() => handleContactat(t.id)} style={{
                    flexShrink: 0, marginLeft: 12,
                    background: overdue ? '#8B2A2A' : '#F5F0EA',
                    color: overdue ? 'white' : '#6E6A67',
                    border: 'none', borderRadius: 8, padding: '5px 13px',
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'Inter Tight, sans-serif', transition: 'all 0.12s',
                  }}>
                    Contactat ✓
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {action && (
        <div className="modal-overlay" onClick={() => setAction(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{ACTIONS.find(a2 => a2.id === action)?.icon}</span>
                <h2>{ACTIONS.find(a2 => a2.id === action)?.label.replace('\n', ' ')}</h2>
              </div>
              <button className="btn btn-sm" onClick={() => setAction(null)} style={{ borderRadius: '50%', width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>×</button>
            </div>

            {/* ENTRADA */}
            {action === 'entrada' && (
              <div>
                <div className="form-group"><label>Producte *</label>
                  <select value={form.producto_id} onChange={f('producto_id')}>
                    <option value="">Selecciona producte...</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.sku ? `${p.sku} — ` : ''}{p.nombre}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label>Número de lot *</label><input value={form.numero_lot} onChange={f('numero_lot')} placeholder="G4171 / LL005" /></div>
                  <div className="form-group"><label>Data caducitat</label><input type="date" value={form.data_caducitat} onChange={f('data_caducitat')} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <div className="form-group"><label>Format</label>
                    <select value={form.tipus_rebuda} onChange={f('tipus_rebuda')}>
                      <option value="ud">Unitats</option>
                      <option value="kg">Kg</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Rebuda *</label>
                    <input type="number" step={form.tipus_rebuda === 'kg' ? '0.001' : '1'} min="0" value={form.quantitat_rebuda} onChange={f('quantitat_rebuda')} placeholder={form.tipus_rebuda === 'kg' ? '12.000' : '144'} />
                  </div>
                </div>
                {form.tipus_rebuda === 'kg' && <div style={{ background: '#F5F0EA', borderRadius: 8, padding: '7px 12px', marginBottom: '1rem', fontSize: 12, color: '#956C58' }}>⚖️ Caldrà fer una Conversió per obtenir unitats</div>}
                <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={f('notes')} placeholder="Proveïdor, albarà..." /></div>
              </div>
            )}

            {/* CONVERSIÓ */}
            {action === 'conversio' && (
              <div>
                <div className="form-group"><label>Lot *</label>
                  <select value={form.lot_id} onChange={f('lot_id')}>
                    <option value="">Selecciona lot...</option>
                    {lotsConversio.map(l => <option key={l.id} value={l.id}>{lotLabel(l, productos)} · {l.kg_restants}kg</option>)}
                  </select>
                </div>
                {lotsConversio.length === 0 && <p style={{ color: '#ABA7A4', fontSize: 13, marginBottom: '1rem' }}>Sense lots amb kg pendents.</p>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label>Kg usats *</label><input type="number" step="0.001" min="0" value={form.kg_usats} onChange={f('kg_usats')} placeholder="5.000" /></div>
                  <div className="form-group"><label>Unitats produïdes *</label><input type="number" min="1" value={form.unitats_produides} onChange={f('unitats_produides')} placeholder="47" /></div>
                </div>
                {form.kg_usats && form.unitats_produides && (
                  <div style={{ background: '#F5F0EA', borderRadius: 8, padding: '7px 12px', fontSize: 12, marginBottom: '1rem', color: '#6E6A67' }}>
                    Rendiment: {(parseFloat(form.unitats_produides) / parseFloat(form.kg_usats)).toFixed(1)} ud/kg
                  </div>
                )}
                <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={f('notes')} /></div>
              </div>
            )}

            {/* ENVIAR A BOTIGA — multi-línia */}
            {action === 'enviament' && (
              <div>
                {/* Botiga primer */}
                <div className="form-group">
                  <label>Botiga *</label>
                  <select value={form.tienda_id} onChange={f('tienda_id')}>
                    <option value="">Selecciona botiga...</option>
                    {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>

                {/* Línies de producte */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ABA7A4', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Productes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '0.75rem' }}>
                  {(form.linies || []).map((linia, idx) => {
                    const lot = lots.find(l => l.id === linia.lot_id)
                    return (
                      <div key={linia.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, alignItems: 'center' }}>
                        <select value={linia.lot_id} onChange={e => updateLinia(linia.id, 'lot_id', e.target.value)}
                          style={{ padding: '9px 10px', border: '1px solid rgba(26,25,24,0.13)', borderRadius: 8, background: '#FAF8F5', fontSize: 13, outline: 'none' }}>
                          <option value="">Lot...</option>
                          {lotsEnviament.map(l => {
                            const prod = productos.find(p => p.id === l.producto_id)
                            return <option key={l.id} value={l.id}>{l.numero_lot} · {prod?.sku} · {l.unitats_magatzem}ud</option>
                          })}
                        </select>
                        <input
                          type="number" min="1" max={lot?.unitats_magatzem}
                          value={linia.quantitat} placeholder="ud"
                          onChange={e => updateLinia(linia.id, 'quantitat', e.target.value)}
                          style={{ padding: '9px 8px', border: '1px solid rgba(26,25,24,0.13)', borderRadius: 8, background: '#FAF8F5', fontSize: 13, outline: 'none', textAlign: 'center' }}
                        />
                        <button onClick={() => removeLinia(linia.id)} disabled={(form.linies || []).length <= 1}
                          style={{ width: 32, height: 36, border: '1px solid rgba(26,25,24,0.1)', borderRadius: 8, background: 'white', cursor: (form.linies || []).length <= 1 ? 'default' : 'pointer', color: '#ABA7A4', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (form.linies || []).length <= 1 ? 0.3 : 1 }}>
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>

                {lotsEnviament.length === 0 && <p style={{ color: '#ABA7A4', fontSize: 13, marginBottom: '1rem' }}>Sense unitats al magatzem.</p>}

                <button type="button" onClick={addLinia} style={{ fontSize: 13, color: '#956C58', background: '#F5EDE3', border: '1px solid rgba(149,108,88,0.2)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'Inter Tight, sans-serif', fontWeight: 500, marginBottom: '1rem' }}>
                  + Afegir línia
                </button>

                <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={f('notes')} /></div>
              </div>
            )}

            {/* MOSTRA */}
            {action === 'mostra' && (
              <div>
                <div className="form-group"><label>Lot *</label>
                  <select value={form.lot_id} onChange={f('lot_id')}>
                    <option value="">Selecciona lot...</option>
                    {lotsMostra.map(l => <option key={l.id} value={l.id}>{lotLabel(l, productos)} / bot:{l.unitats_botigues}</option>)}
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

            {/* MERMA */}
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
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardant…' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
