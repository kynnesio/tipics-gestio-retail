import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Estanteria3D from '../components/Estanteria3D'

const emptyTienda = { nombre: '', direccion: '', zona: '', contacto_nombre: '', contacto_email: '', contacto_telefono: '', alquiler_fijo_mensual: '0', comision_variable_pct: '10', activa: true, lat: '', lng: '' }
const COLORS = ['#2D6A4F','#B5451B','#4A3F8F','#7B5E2A','#1A5F7A','#6B2D3E','#3D6B45','#8B4513']

async function geocodificar(adreca) {
  if (!adreca) return null
  try {
    const query = encodeURIComponent(adreca + ', Catalunya, Spain')
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'ca', 'User-Agent': 'Tipics-Gestio/1.0' }
    })
    const data = await res.json()
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {}
  return null
}

export default function Tiendas() {
  const [tiendas, setTiendas] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTienda, setSelectedTienda] = useState(null)
  const [stockItems, setStockItems] = useState([])
  const [ultimesVendes, setUltimesVendes] = useState([])
  const [loadingStock, setLoadingStock] = useState(false)

  // Animacions
  const [animIn, setAnimIn] = useState([])
  const [animOut, setAnimOut] = useState([])
  const [vendesAnimant, setVendesAnimant] = useState([])

  // Modals
  const [modalTienda, setModalTienda] = useState(false)
  const [form, setForm] = useState(emptyTienda)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [geocodificant, setGeocodificant] = useState(false)

  const [modalRecompte, setModalRecompte] = useState(false)
  const [recompteVals, setRecompteVals] = useState({})
  const [savingRecompte, setSavingRecompte] = useState(false)

  const [modalMerma, setModalMerma] = useState(false)
  const [mermaForm, setMermaForm] = useState({ producto_id: '', unitats: '', motiu: 'caducitat' })
  const [savingMerma, setSavingMerma] = useState(false)

  const colorForIdx = (productoId) => {
    const idx = productos.findIndex(p => p.id === productoId)
    return COLORS[Math.max(0, idx) % COLORS.length]
  }

  const loadTiendas = async () => {
    const { data } = await supabase.from('tiendas').select('*').order('nombre')
    setTiendas(data || [])
    setLoading(false)
  }
  const loadProductos = async () => {
    const { data } = await supabase.from('productos').select('id, nombre, pvp, coste_proveedor').eq('activo', true).order('nombre')
    setProductos(data || [])
  }
  useEffect(() => { loadTiendas(); loadProductos() }, [])

  const loadStock = async (tiendaId) => {
    setLoadingStock(true)
    const { data: stock } = await supabase
      .from('stock_tienda').select('*, productos(id, nombre, pvp)')
      .eq('tienda_id', tiendaId).order('created_at')
    const { data: recs } = await supabase
      .from('recuentos').select('*, productos(nombre, pvp)')
      .eq('tienda_id', tiendaId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    setStockItems(stock || [])
    if (recs && recs.length > 0) {
      const darreraData = recs[0].fecha
      setUltimesVendes(recs.filter(r => r.fecha === darreraData))
    } else {
      setUltimesVendes([])
    }
    setLoadingStock(false)
  }

  const selectTienda = (t) => {
    setSelectedTienda(t)
    setAnimIn([])
    setAnimOut([])
    setVendesAnimant([])
    loadStock(t.id)
  }

  // ── Afegir estoc inline ──
  const handleAfegirInline = async (productoId, unitats) => {
    if (!unitats || unitats <= 0) return
    const avui = new Date().toISOString().split('T')[0]
    const existent = stockItems.find(s => s.producto_id === productoId)
    if (existent) {
      await supabase.from('stock_tienda')
        .update({ unidades_actuales: Number(existent.unidades_actuales) + unitats, fecha_ultimo_recuento: avui })
        .eq('id', existent.id)
    } else {
      await supabase.from('stock_tienda').insert({
        tienda_id: selectedTienda.id, producto_id: productoId,
        unidades_actuales: unitats, fecha_ultimo_recuento: avui,
      })
    }
    // Animació entrada
    setAnimIn(prev => [...prev, productoId])
    await loadStock(selectedTienda.id)
    setTimeout(() => setAnimIn(prev => prev.filter(id => id !== productoId)), 600)
  }

  // ── Recompte ──
  const openRecompte = () => {
    const vals = {}
    stockItems.forEach(s => { vals[s.producto_id] = '' })
    setRecompteVals(vals)
    setModalRecompte(true)
  }

  const handleRecompte = async () => {
    const allFilled = stockItems.every(s => recompteVals[s.producto_id] !== '')
    if (!allFilled) { alert('Omple el nou estoc de tots els productes.'); return }
    setSavingRecompte(true)

    // Calcular venudes per animar
    const venudes = stockItems
      .filter(s => {
        const nou = parseFloat(recompteVals[s.producto_id])
        return (Number(s.unidades_actuales) - nou) > 0
      })
      .map(s => s.producto_id)

    // Animar sortida
    setModalRecompte(false)
    setAnimOut(venudes)
    await new Promise(r => setTimeout(r, 500))

    const avui = new Date().toISOString().split('T')[0]
    for (const s of stockItems) {
      const nouEstoc = parseFloat(recompteVals[s.producto_id])
      await supabase.from('recuentos').insert({
        tienda_id: selectedTienda.id, producto_id: s.producto_id,
        stock_anterior: s.unidades_actuales, stock_nuevo: nouEstoc, fecha: avui,
      })
      await supabase.from('stock_tienda')
        .update({ unidades_actuales: nouEstoc, fecha_ultimo_recuento: avui })
        .eq('id', s.id)
    }

    setAnimOut([])
    setSavingRecompte(false)
    // Animar aparició a la dreta
    setVendesAnimant(venudes)
    await loadStock(selectedTienda.id)
    setTimeout(() => setVendesAnimant([]), 800)
  }

  // ── Merma ──
  const handleMerma = async (e) => {
    e.preventDefault()
    setSavingMerma(true)
    const unitats = parseFloat(mermaForm.unitats)
    const stockItem = stockItems.find(s => s.producto_id === mermaForm.producto_id)
    if (stockItem) {
      const nouEstoc = Math.max(0, Number(stockItem.unidades_actuales) - unitats)
      const avui = new Date().toISOString().split('T')[0]
      await supabase.from('recuentos').insert({
        tienda_id: selectedTienda.id, producto_id: mermaForm.producto_id,
        stock_anterior: stockItem.unidades_actuales, stock_nuevo: nouEstoc,
        fecha: avui, notas: `Merma: ${mermaForm.motiu}`,
      })
      await supabase.from('stock_tienda')
        .update({ unidades_actuales: nouEstoc, fecha_ultimo_recuento: avui })
        .eq('id', stockItem.id)
    }
    setSavingMerma(false)
    setModalMerma(false)
    setMermaForm({ producto_id: '', unitats: '', motiu: 'caducitat' })
    loadStock(selectedTienda.id)
  }

  const handleDeleteStock = async (stockId) => {
    await supabase.from('stock_tienda').delete().eq('id', stockId)
    loadStock(selectedTienda.id)
  }

  // ── CRUD Botiga ──
  const openNewTienda = () => { setForm(emptyTienda); setEditId(null); setModalTienda(true) }
  const openEditTienda = (r, e) => {
    e.stopPropagation()
    setForm({ ...r, alquiler_fijo_mensual: String(r.alquiler_fijo_mensual), comision_variable_pct: String(r.comision_variable_pct), lat: r.lat || '', lng: r.lng || '' })
    setEditId(r.id)
    setModalTienda(true)
  }
  const handleGeocodificar = async () => {
    if (!form.direccion) return
    setGeocodificant(true)
    const coords = await geocodificar(form.direccion)
    if (coords) setForm(prev => ({ ...prev, lat: coords.lat, lng: coords.lng }))
    else alert('No s\'han pogut trobar les coordenades.')
    setGeocodificant(false)
  }
  const handleSaveTienda = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nombre: form.nombre, direccion: form.direccion, zona: form.zona,
      contacto_nombre: form.contacto_nombre, contacto_email: form.contacto_email, contacto_telefono: form.contacto_telefono,
      alquiler_fijo_mensual: parseFloat(form.alquiler_fijo_mensual) || 0,
      comision_variable_pct: parseFloat(form.comision_variable_pct) || 10,
      activa: form.activa,
      lat: form.lat !== '' ? parseFloat(form.lat) : null,
      lng: form.lng !== '' ? parseFloat(form.lng) : null,
    }
    if (editId) await supabase.from('tiendas').update(payload).eq('id', editId)
    else await supabase.from('tiendas').insert(payload)
    setSaving(false)
    setModalTienda(false)
    loadTiendas()
  }
  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes popIn {
          0% { transform: scale(0.5) translateY(-10px); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .venda-animant { animation: popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── Llista botigues ── */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: 18, fontWeight: 500 }}>Botigues</h1>
            <button className="btn btn-primary btn-sm" onClick={openNewTienda}>+ Nova</button>
          </div>
          {loading ? <div style={{ color: '#6b6b68', fontSize: 13 }}>Carregant...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {tiendas.map(t => (
                <div key={t.id} onClick={() => selectTienda(t)} style={{
                  background: selectedTienda?.id === t.id ? '#E1F5EE' : 'white',
                  border: selectedTienda?.id === t.id ? '1.5px solid #1D9E75' : '0.5px solid rgba(0,0,0,0.1)',
                  borderRadius: 8, padding: '9px 11px', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: selectedTienda?.id === t.id ? '#0F6E56' : '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</div>
                      {t.zona && <div style={{ fontSize: 11, color: '#6b6b68', marginTop: 1 }}>{t.zona}</div>}
                      <span className={`badge badge-${t.activa ? 'green' : 'gray'}`} style={{ fontSize: 10, marginTop: 4, display: 'inline-block' }}>{t.activa ? 'Activa' : 'Inactiva'}</span>
                    </div>
                    <button className="btn btn-sm" style={{ fontSize: 10, padding: '2px 6px', marginLeft: 4, flexShrink: 0 }} onClick={(e) => openEditTienda(t, e)}>✎</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Zona principal ── */}
        {!selectedTienda ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#6b6b68', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 40 }}>🏪</div>
            <div style={{ fontSize: 13 }}>Selecciona una botiga per gestionar l'estoc</div>
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Capçalera */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 500 }}>{selectedTienda.nombre}</h2>
                {selectedTienda.direccion && <div style={{ fontSize: 11, color: '#6b6b68' }}>{selectedTienda.direccion}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => setModalMerma(true)}>⚠️ Merma</button>
                <button className="btn btn-primary btn-sm" onClick={openRecompte} disabled={stockItems.length === 0}>🔢 Recompte</button>
              </div>
            </div>

            {loadingStock ? (
              <div style={{ color: '#6b6b68', fontSize: 13, padding: '2rem 0' }}>Carregant estoc...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 200px', gap: 16, alignItems: 'start' }}>

                {/* ── Panell esquerre: entrada ── */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b6b68', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>↓ Afegir estoc</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {productos.map((p, idx) => {
                      const color = COLORS[idx % COLORS.length]
                      const enEstoc = stockItems.find(s => s.producto_id === p.id)
                      return (
                        <div key={p.id} style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '7px 9px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                            <div style={{ fontSize: 11, fontWeight: 500, flex: 1, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
                          </div>
                          <div style={{ fontSize: 10, color: '#6b6b68', marginBottom: 5 }}>
                            Estoc: <strong>{enEstoc ? enEstoc.unidades_actuales : 0}</strong> ud
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input
                              id={`afegir-${p.id}`}
                              type="number" min="1" placeholder="ud"
                              style={{ flex: 1, padding: '4px 5px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 5, fontSize: 12 }}
                            />
                            <button
                              onClick={() => {
                                const input = document.getElementById(`afegir-${p.id}`)
                                const val = parseFloat(input?.value)
                                if (val > 0) {
                                  handleAfegirInline(p.id, val)
                                  if (input) input.value = ''
                                }
                              }}
                              style={{ background: color, color: 'white', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                            >+</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Centre: estanteria 3D ── */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b6b68', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Estanteria</div>
                  <Estanteria3D
                    stockItems={stockItems}
                    onDeleteStock={handleDeleteStock}
                    animatingIn={animIn}
                    animatingOut={animOut}
                  />
                  {stockItems.some(s => Number(s.unidades_actuales) < 3) && (
                    <div style={{ marginTop: 8, background: '#FAECE7', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#993C1D' }}>
                      ⚠️ Estoc baix en algun producte
                    </div>
                  )}
                </div>

                {/* ── Dreta: últim recompte ── */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b6b68', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Vendes ↓</div>
                  {ultimesVendes.length === 0 ? (
                    <div style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '1.5rem 1rem', textAlign: 'center', color: '#6b6b68', fontSize: 12 }}>
                      Sense recomptes encara.
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 10, color: '#6b6b68', marginBottom: 6, textAlign: 'right' }}>
                        {ultimesVendes[0]?.fecha}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {ultimesVendes.map((r, idx) => {
                          const venudes = Number(r.unidades_vendidas || 0)
                          const esMerma = r.notas?.startsWith('Merma')
                          const color = colorForIdx(r.producto_id)
                          const isNew = vendesAnimant.includes(r.producto_id)
                          return (
                            <div key={r.id}
                              className={isNew ? 'venda-animant' : ''}
                              style={{
                                background: esMerma ? '#FAECE7' : (venudes > 0 ? 'white' : '#f8f7f4'),
                                border: `0.5px solid ${esMerma ? 'rgba(216,90,48,0.2)' : 'rgba(0,0,0,0.08)'}`,
                                borderLeft: `3px solid ${esMerma ? '#D85A30' : color}`,
                                borderRadius: 7, padding: '7px 9px',
                              }}>
                              <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.productos?.nombre}</div>
                              {esMerma ? (
                                <div style={{ fontSize: 10, color: '#993C1D' }}>⚠️ {r.notas?.replace('Merma: ', '')} · {venudes} ud</div>
                              ) : (
                                <div style={{ fontSize: 13, fontWeight: 700, color: venudes > 0 ? '#1D9E75' : '#6b6b68' }}>
                                  {venudes > 0 ? `−${venudes} ud` : '0 ud'}
                                  {venudes > 0 && <span style={{ fontSize: 10, fontWeight: 400, color: '#6b6b68', marginLeft: 4 }}>{(venudes * Number(r.productos?.pvp || 0)).toFixed(2)}€</span>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {/* Total */}
                        <div style={{ background: '#E1F5EE', borderRadius: 7, padding: '8px 10px', marginTop: 2, borderLeft: '3px solid #1D9E75' }}>
                          <div style={{ fontSize: 10, color: '#0F6E56' }}>Total venut</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F6E56' }}>
                            {ultimesVendes.filter(r => !r.notas?.startsWith('Merma')).reduce((acc, r) => acc + Number(r.unidades_vendidas || 0) * Number(r.productos?.pvp || 0), 0).toFixed(2)}€
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal recompte ── */}
      {modalRecompte && (
        <div className="modal-overlay" onClick={() => setModalRecompte(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Recompte — {selectedTienda?.nombre}</h2>
              <button className="btn btn-sm" onClick={() => setModalRecompte(false)}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: '#6b6b68', marginBottom: '1rem' }}>
              Introdueix les unitats que queden <strong>ara mateix</strong> a la botiga:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.25rem' }}>
              {stockItems.map(s => {
                const nouVal = recompteVals[s.producto_id]
                const venudes = nouVal !== '' && nouVal !== undefined ? Math.max(0, Number(s.unidades_actuales) - parseFloat(nouVal || 0)) : null
                const color = colorForIdx(s.producto_id)
                return (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '12px 1fr auto auto', gap: 10, alignItems: 'center', background: '#f8f7f4', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{s.productos?.nombre}</div>
                      <div style={{ fontSize: 11, color: '#6b6b68' }}>Anterior: {s.unidades_actuales} ud</div>
                    </div>
                    <input
                      type="number" min="0" placeholder="ara"
                      value={recompteVals[s.producto_id] || ''}
                      onChange={e => setRecompteVals(prev => ({ ...prev, [s.producto_id]: e.target.value }))}
                      style={{ width: 64, padding: '6px 8px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                    />
                    <div style={{ minWidth: 52, textAlign: 'right' }}>
                      {venudes !== null && (
                        <span className={`badge badge-${venudes > 0 ? 'green' : 'gray'}`} style={{ fontSize: 11 }}>
                          {venudes > 0 ? `−${venudes}` : '='}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setModalRecompte(false)}>Cancel·lar</button>
              <button className="btn btn-primary" onClick={handleRecompte} disabled={savingRecompte}>
                {savingRecompte ? 'Guardant...' : '✓ Recompte complet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal merma ── */}
      {modalMerma && (
        <div className="modal-overlay" onClick={() => setModalMerma(false)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar merma</h2>
              <button className="btn btn-sm" onClick={() => setModalMerma(false)}>✕</button>
            </div>
            <form onSubmit={handleMerma}>
              <div className="form-group">
                <label>Producte *</label>
                <select required value={mermaForm.producto_id} onChange={e => setMermaForm(p => ({ ...p, producto_id: e.target.value }))}>
                  <option value="">Selecciona</option>
                  {stockItems.map(s => <option key={s.id} value={s.producto_id}>{s.productos?.nombre} ({s.unidades_actuales} ud)</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Unitats *</label>
                <input required type="number" min="1" value={mermaForm.unitats} onChange={e => setMermaForm(p => ({ ...p, unitats: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Motiu</label>
                <select value={mermaForm.motiu} onChange={e => setMermaForm(p => ({ ...p, motiu: e.target.value }))}>
                  <option value="caducitat">Caducitat</option>
                  <option value="trencament">Trencament</option>
                  <option value="robatori">Robatori</option>
                  <option value="devolucio_proveidor">Devolució al proveïdor</option>
                  <option value="altre">Altre</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setModalMerma(false)}>Cancel·lar</button>
                <button type="submit" className="btn" style={{ background: '#FAECE7', color: '#993C1D', borderColor: 'rgba(216,90,48,0.3)' }} disabled={savingMerma}>
                  {savingMerma ? 'Guardant...' : 'Registrar merma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal botiga ── */}
      {modalTienda && (
        <div className="modal-overlay" onClick={() => setModalTienda(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Editar botiga' : 'Nova botiga'}</h2>
              <button className="btn btn-sm" onClick={() => setModalTienda(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveTienda}>
              <div className="form-group"><label>Nom *</label><input required value={form.nombre} onChange={f('nombre')} /></div>
              <div className="form-group">
                <label>Adreça</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={form.direccion} onChange={f('direccion')} placeholder="Carrer, número, municipi" style={{ flex: 1 }} />
                  <button type="button" className="btn btn-sm" onClick={handleGeocodificar} disabled={!form.direccion || geocodificant} style={{ whiteSpace: 'nowrap' }}>
                    {geocodificant ? 'Buscant...' : '📍 Ubicar'}
                  </button>
                </div>
              </div>
              {form.lat && form.lng && (
                <div style={{ background: '#E1F5EE', borderRadius: 6, padding: '8px 12px', marginBottom: '1rem', fontSize: 13, color: '#0F6E56' }}>
                  ✓ {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)}
                </div>
              )}
              <div className="form-group"><label>Zona / comarca</label><input value={form.zona} onChange={f('zona')} placeholder="Maresme, Barcelona..." /></div>
              <div className="form-group"><label>Persona de contacte</label><input value={form.contacto_nombre} onChange={f('contacto_nombre')} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label>Email</label><input type="email" value={form.contacto_email} onChange={f('contacto_email')} /></div>
                <div className="form-group"><label>Telèfon</label><input value={form.contacto_telefono} onChange={f('contacto_telefono')} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label>Lloguer fix (€/mes)</label><input type="number" step="0.01" min="0" value={form.alquiler_fijo_mensual} onChange={f('alquiler_fijo_mensual')} /></div>
                <div className="form-group"><label>Comissió variable (%)</label><input type="number" step="0.1" min="0" max="100" value={form.comision_variable_pct} onChange={f('comision_variable_pct')} /></div>
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="activa" checked={form.activa} onChange={e => setForm(p => ({ ...p, activa: e.target.checked }))} style={{ width: 'auto' }} />
                <label htmlFor="activa" style={{ margin: 0 }}>Botiga activa</label>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setModalTienda(false)}>Cancel·lar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardant...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
