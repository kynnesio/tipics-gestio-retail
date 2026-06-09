import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const emptyTienda = { nombre: '', direccion: '', zona: '', contacto_nombre: '', contacto_email: '', contacto_telefono: '', alquiler_fijo_mensual: '0', comision_variable_pct: '10', activa: true, lat: '', lng: '' }

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

// ── Caixa de producte 3D ──
function CaixaProducte({ item, color, onDelete }) {
  const baixEstoc = Number(item.unidades_actuales) < 3
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        background: color,
        borderRadius: '6px 6px 2px 2px',
        padding: '8px 6px 6px',
        boxShadow: `0 4px 0 ${color}99, 0 5px 8px rgba(0,0,0,0.18)`,
        minHeight: 72,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.92)', borderRadius: 3,
          padding: '3px 5px', fontSize: 10, fontWeight: 600,
          color: '#1a1a18', lineHeight: 1.2, marginBottom: 6, minHeight: 28,
          display: 'flex', alignItems: 'center',
        }}>
          {item.productos?.nombre || '?'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            background: baixEstoc ? 'rgba(220,60,40,0.85)' : 'rgba(0,0,0,0.22)',
            color: 'white', borderRadius: 10, padding: '1px 7px',
            fontSize: 11, fontWeight: 700,
          }}>
            {item.unidades_actuales} ud
          </span>
          {onDelete && (
            <button onClick={() => onDelete(item.id)}
              style={{ background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', lineHeight: '18px', padding: 0 }}>
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Estanteria ──
function Estanteria({ items, onDelete }) {
  const COLS = 3
  const colorProd = (idx) => ['#1D9E75','#BA7517','#534AB7','#D85A30','#185FA5','#3B6D11','#993C1D','#0F6E56'][idx % 8]
  const shelves = []
  for (let i = 0; i < items.length; i += COLS) shelves.push(items.slice(i, i + COLS))
  if (shelves.length === 0) shelves.push([])

  return (
    <div style={{
      background: 'linear-gradient(180deg, #f0ebe3 0%, #e8e0d5 100%)',
      borderRadius: 12, padding: '12px 12px 0',
      border: '0.5px solid rgba(0,0,0,0.12)',
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.06)',
      minHeight: 160,
    }}>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#888', fontSize: 13 }}>
          Sense estoc. Afegeix productes des del panell esquerre.
        </div>
      ) : shelves.map((shelf, si) => (
        <div key={si}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, minHeight: 90 }}>
            {shelf.map((item, ii) => (
              <CaixaProducte key={item.id} item={item} color={colorProd(si * COLS + ii)} onDelete={onDelete} />
            ))}
          </div>
          <div style={{ height: 10, marginBottom: 12, background: 'linear-gradient(180deg, #c4a882 0%, #a8896a 100%)', borderRadius: '0 0 3px 3px', boxShadow: '0 3px 6px rgba(0,0,0,0.15)' }} />
        </div>
      ))}
      <div style={{ height: 14, background: 'linear-gradient(180deg, #b89870 0%, #9a7d58 100%)', borderRadius: '0 0 8px 8px' }} />
    </div>
  )
}

// ── Pàgina principal ──
export default function Tiendas() {
  const [tiendas, setTiendas] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTienda, setSelectedTienda] = useState(null)
  const [stockItems, setStockItems] = useState([])
  const [ultimesVendes, setUltimesVendes] = useState([])
  const [loadingStock, setLoadingStock] = useState(false)

  // Modal botiga
  const [modalTienda, setModalTienda] = useState(false)
  const [form, setForm] = useState(emptyTienda)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [geocodificant, setGeocodificant] = useState(false)

  // Modal recompte
  const [modalRecompte, setModalRecompte] = useState(false)
  const [recompteVals, setRecompteVals] = useState({})
  const [savingRecompte, setSavingRecompte] = useState(false)

  // Modal merma
  const [modalMerma, setModalMerma] = useState(false)
  const [mermaForm, setMermaForm] = useState({ producto_id: '', unitats: '', motiu: 'caducitat' })
  const [savingMerma, setSavingMerma] = useState(false)

  // Modal afegir estoc
  const [modalAfegir, setModalAfegir] = useState(false)
  const [afegirForm, setAfegirForm] = useState({ producto_id: '', unidades_actuales: '' })
  const [savingAfegir, setSavingAfegir] = useState(false)

  const colorProd = (idx) => ['#1D9E75','#BA7517','#534AB7','#D85A30','#185FA5','#3B6D11','#993C1D','#0F6E56'][idx % 8]

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
      .from('stock_tienda')
      .select('*, productos(id, nombre, pvp)')
      .eq('tienda_id', tiendaId)
      .order('created_at')

    // Últim recompte: agafem la data màxima i els registres d'aquell dia
    const { data: recs } = await supabase
      .from('recuentos')
      .select('*, productos(nombre, pvp)')
      .eq('tienda_id', tiendaId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    setStockItems(stock || [])

    // Agrupar per data: agafem els de l'última data
    if (recs && recs.length > 0) {
      const darreraData = recs[0].fecha
      const darrers = recs.filter(r => r.fecha === darreraData)
      setUltimesVendes(darrers)
    } else {
      setUltimesVendes([])
    }
    setLoadingStock(false)
  }

  const selectTienda = (t) => {
    setSelectedTienda(t)
    loadStock(t.id)
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
    const avui = new Date().toISOString().split('T')[0]
    for (const s of stockItems) {
      const nouEstoc = parseFloat(recompteVals[s.producto_id])
      await supabase.from('recuentos').insert({
        tienda_id: selectedTienda.id,
        producto_id: s.producto_id,
        stock_anterior: s.unidades_actuales,
        stock_nuevo: nouEstoc,
        fecha: avui,
      })
      await supabase.from('stock_tienda')
        .update({ unidades_actuales: nouEstoc, fecha_ultimo_recuento: avui })
        .eq('id', s.id)
    }
    setSavingRecompte(false)
    setModalRecompte(false)
    loadStock(selectedTienda.id)
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
        tienda_id: selectedTienda.id,
        producto_id: mermaForm.producto_id,
        stock_anterior: stockItem.unidades_actuales,
        stock_nuevo: nouEstoc,
        fecha: avui,
        notas: `Merma: ${mermaForm.motiu}`,
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

  // ── Afegir estoc ──
  const handleAfegirEstoc = async (e) => {
    e.preventDefault()
    setSavingAfegir(true)
    const productoId = afegirForm.producto_id
    const unitats = parseFloat(afegirForm.unidades_actuales) || 0
    const existent = stockItems.find(s => s.producto_id === productoId)
    const avui = new Date().toISOString().split('T')[0]
    if (existent) {
      const nouTotal = Number(existent.unidades_actuales) + unitats
      await supabase.from('stock_tienda')
        .update({ unidades_actuales: nouTotal, fecha_ultimo_recuento: avui })
        .eq('id', existent.id)
    } else {
      await supabase.from('stock_tienda').insert({
        tienda_id: selectedTienda.id,
        producto_id: productoId,
        unidades_actuales: unitats,
        fecha_ultimo_recuento: avui,
      })
    }
    setSavingAfegir(false)
    setModalAfegir(false)
    setAfegirForm({ producto_id: '', unidades_actuales: '' })
    loadStock(selectedTienda.id)
  }

  const handleDeleteStock = async (stockId) => {
    if (!confirm('Treure aquest producte de la botiga?')) return
    await supabase.from('stock_tienda').delete().eq('id', stockId)
    loadStock(selectedTienda.id)
  }

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div>
      {/* ── Capçalera ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Columna botigues ── */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: 18, fontWeight: 500 }}>Botigues</h1>
            <button className="btn btn-primary btn-sm" onClick={openNewTienda}>+ Nova</button>
          </div>
          {loading ? <div style={{ color: '#6b6b68', fontSize: 13 }}>Carregant...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tiendas.map(t => (
                <div key={t.id} onClick={() => selectTienda(t)} style={{
                  background: selectedTienda?.id === t.id ? '#E1F5EE' : 'white',
                  border: selectedTienda?.id === t.id ? '1.5px solid #1D9E75' : '0.5px solid rgba(0,0,0,0.1)',
                  borderRadius: 8, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13, color: selectedTienda?.id === t.id ? '#0F6E56' : '#1a1a18' }}>{t.nombre}</div>
                      {t.zona && <div style={{ fontSize: 11, color: '#6b6b68', marginTop: 1 }}>{t.zona}</div>}
                      <span className={`badge badge-${t.activa ? 'green' : 'gray'}`} style={{ fontSize: 10, marginTop: 4, display: 'inline-block' }}>{t.activa ? 'Activa' : 'Inactiva'}</span>
                    </div>
                    <button className="btn btn-sm" style={{ fontSize: 10, padding: '2px 7px' }} onClick={(e) => openEditTienda(t, e)}>Editar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Zona principal ── */}
        {!selectedTienda ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#6b6b68', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 36 }}>🏪</div>
            <div style={{ fontSize: 13 }}>Selecciona una botiga</div>
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Capçalera botiga seleccionada */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 500 }}>{selectedTienda.nombre}</h2>
                {selectedTienda.direccion && <div style={{ fontSize: 11, color: '#6b6b68' }}>{selectedTienda.direccion}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => setModalMerma(true)}>⚠️ Merma</button>
                <button className="btn btn-sm" onClick={() => { setAfegirForm({ producto_id: '', unidades_actuales: '' }); setModalAfegir(true) }}>+ Afegir estoc</button>
                <button className="btn btn-primary btn-sm" onClick={openRecompte}>🔢 Recompte</button>
              </div>
            </div>

            {loadingStock ? <div style={{ color: '#6b6b68', fontSize: 13 }}>Carregant...</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 16, alignItems: 'start' }}>

                {/* ── Esquerra: afegir estoc ── */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#6b6b68', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>← Entrada</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {productos.map((p, idx) => {
                      const enEstoc = stockItems.find(s => s.producto_id === p.id)
                      return (
                        <div key={p.id} style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: colorProd(idx), flexShrink: 0 }} />
                            <div style={{ fontSize: 12, fontWeight: 500, flex: 1, lineHeight: 1.2 }}>{p.nombre}</div>
                          </div>
                          <div style={{ fontSize: 11, color: '#6b6b68', marginBottom: 6 }}>
                            Estoc actual: <strong>{enEstoc ? enEstoc.unidades_actuales : 0} ud</strong>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input
                              type="number" min="1" placeholder="ud"
                              id={`afegir-${p.id}`}
                              style={{ flex: 1, padding: '4px 6px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 5, fontSize: 12 }}
                            />
                            <button
                              onClick={async () => {
                                const input = document.getElementById(`afegir-${p.id}`)
                                const val = parseFloat(input.value)
                                if (!val || val <= 0) return
                                const avui = new Date().toISOString().split('T')[0]
                                if (enEstoc) {
                                  await supabase.from('stock_tienda').update({ unidades_actuales: Number(enEstoc.unidades_actuales) + val, fecha_ultimo_recuento: avui }).eq('id', enEstoc.id)
                                } else {
                                  await supabase.from('stock_tienda').insert({ tienda_id: selectedTienda.id, producto_id: p.id, unidades_actuales: val, fecha_ultimo_recuento: avui })
                                }
                                input.value = ''
                                loadStock(selectedTienda.id)
                              }}
                              style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
                            >+</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Centre: estanteria ── */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#6b6b68', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Estanteria</div>
                  <Estanteria items={stockItems} onDelete={handleDeleteStock} />
                  {stockItems.some(s => Number(s.unidades_actuales) < 3) && (
                    <div style={{ marginTop: 8, background: '#FAECE7', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#993C1D' }}>
                      ⚠️ Estoc baix en algun producte
                    </div>
                  )}
                </div>

                {/* ── Dreta: últim recompte ── */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#6b6b68', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Vendes →</div>
                  {ultimesVendes.length === 0 ? (
                    <div style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '1.5rem 1rem', textAlign: 'center', color: '#6b6b68', fontSize: 12 }}>
                      Sense recomptes.<br />Fes el primer recompte.
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 11, color: '#6b6b68', marginBottom: 6, textAlign: 'right' }}>
                        Darrera visita: <strong>{ultimesVendes[0]?.fecha}</strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {ultimesVendes.map((r, idx) => {
                          const venudes = Number(r.unidades_vendidas || 0)
                          const esMerma = r.notas?.startsWith('Merma')
                          return (
                            <div key={r.id} style={{
                              background: esMerma ? '#FAECE7' : (venudes > 0 ? '#EAF3DE' : 'white'),
                              border: `0.5px solid ${esMerma ? 'rgba(216,90,48,0.2)' : (venudes > 0 ? 'rgba(59,109,17,0.2)' : 'rgba(0,0,0,0.1)')}`,
                              borderRadius: 8, padding: '8px 10px',
                            }}>
                              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{r.productos?.nombre}</div>
                              {esMerma ? (
                                <div style={{ fontSize: 11, color: '#993C1D' }}>⚠️ {r.notas} · {venudes} ud</div>
                              ) : (
                                <>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: venudes > 0 ? '#3B6D11' : '#6b6b68' }}>
                                    {venudes > 0 ? `${venudes} ud venudes` : 'Sense vendes'}
                                  </div>
                                  {venudes > 0 && (
                                    <div style={{ fontSize: 11, color: '#6b6b68', marginTop: 2 }}>
                                      {(venudes * Number(r.productos?.pvp || 0)).toFixed(2)}€ PVP
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )
                        })}
                        {/* Total */}
                        <div style={{ background: '#E1F5EE', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
                          <div style={{ fontSize: 11, color: '#6b6b68' }}>Total darrer recompte</div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#0F6E56' }}>
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
              Introdueix les unitats que hi ha <strong>ara mateix</strong> a la botiga:
            </div>
            {stockItems.length === 0 ? (
              <div style={{ color: '#6b6b68', fontSize: 13, marginBottom: '1rem' }}>No hi ha productes a l'estanteria.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.25rem' }}>
                {stockItems.map(s => {
                  const nouVal = recompteVals[s.producto_id]
                  const venudes = nouVal !== '' && nouVal !== undefined ? Math.max(0, Number(s.unidades_actuales) - parseFloat(nouVal || 0)) : null
                  return (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', background: '#f8f7f4', borderRadius: 8, padding: '10px 12px' }}>
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
                      <div style={{ minWidth: 60, textAlign: 'right' }}>
                        {venudes !== null && (
                          <span className={`badge badge-${venudes > 0 ? 'green' : 'gray'}`}>
                            {venudes > 0 ? `-${venudes} ud` : '='}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setModalRecompte(false)}>Cancel·lar</button>
              <button className="btn btn-primary" onClick={handleRecompte} disabled={savingRecompte || stockItems.length === 0}>
                {savingRecompte ? 'Guardant...' : '✓ Recompte complet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal merma ── */}
      {modalMerma && (
        <div className="modal-overlay" onClick={() => setModalMerma(false)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
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
