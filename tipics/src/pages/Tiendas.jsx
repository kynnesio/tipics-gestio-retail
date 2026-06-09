import { useState, useEffect, useRef } from 'react'
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

// ── Estanteria 3D ──────────────────────────────────────────
function Estanteria({ items, productos, onAdd, onUpdate, onDelete, onRecompte }) {
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [recompteId, setRecompteId] = useState(null)
  const [recompteVal, setRecompteVal] = useState('')

  const SHELF_COLS = 3
  const shelves = []
  for (let i = 0; i < Math.max(items.length + 1, 3); i += SHELF_COLS) {
    shelves.push(items.slice(i, i + SHELF_COLS))
  }
  // afegir slot buit a l'última prestatge per botó +
  const lastShelf = shelves[shelves.length - 1]
  if (lastShelf && lastShelf.length < SHELF_COLS) {
    // ja hi ha espai
  }

  const colorProd = (idx) => {
    const colors = ['#1D9E75','#BA7517','#534AB7','#D85A30','#185FA5','#3B6D11','#993C1D','#0F6E56']
    return colors[idx % colors.length]
  }

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Estructura estanteria */}
      <div style={{
        background: 'linear-gradient(180deg, #f0ebe3 0%, #e8e0d5 100%)',
        borderRadius: 12,
        padding: '12px 12px 0',
        border: '0.5px solid rgba(0,0,0,0.12)',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.06)',
        minHeight: 200,
      }}>
        {shelves.length === 0 || (shelves.length === 1 && shelves[0].length === 0) ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#888' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ fontSize: 13 }}>Sense productes. Afegeix-ne amb el botó de baix.</div>
          </div>
        ) : shelves.map((shelf, si) => (
          <div key={si}>
            {/* Productes de la prestatge */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 0, minHeight: 90 }}>
              {shelf.map((item, ii) => {
                const idx = si * SHELF_COLS + ii
                const color = colorProd(idx)
                const baixEstoc = Number(item.unidades_actuales) < 3
                const isEditingThis = editingId === item.id
                const isRecompteThis = recompteId === item.id
                return (
                  <div key={item.id} style={{ position: 'relative' }}>
                    {/* Producte (caixa 3D) */}
                    <div style={{
                      background: color,
                      borderRadius: '6px 6px 2px 2px',
                      padding: '8px 6px 6px',
                      cursor: 'pointer',
                      boxShadow: `0 4px 0 ${color}88, 0 5px 8px rgba(0,0,0,0.2)`,
                      transform: 'translateY(0)',
                      transition: 'transform 0.1s',
                      userSelect: 'none',
                      minHeight: 72,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}>
                      {/* Etiqueta blanc */}
                      <div style={{
                        background: 'rgba(255,255,255,0.92)',
                        borderRadius: 3,
                        padding: '3px 5px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#1a1a18',
                        lineHeight: 1.2,
                        marginBottom: 6,
                        minHeight: 28,
                        display: 'flex',
                        alignItems: 'center',
                      }}>
                        {item.productos?.nombre || '?'}
                      </div>
                      {/* Unitats */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {isEditingThis ? (
                          <input
                            type="number" min="0" value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onBlur={() => { onUpdate(item.id, editVal); setEditingId(null) }}
                            onKeyDown={e => { if (e.key === 'Enter') { onUpdate(item.id, editVal); setEditingId(null) } }}
                            autoFocus
                            style={{ width: 42, fontSize: 12, padding: '2px 4px', borderRadius: 3, border: 'none', textAlign: 'center' }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            onClick={() => { setEditingId(item.id); setEditVal(String(item.unidades_actuales)) }}
                            style={{
                              background: baixEstoc ? 'rgba(252,100,80,0.9)' : 'rgba(0,0,0,0.25)',
                              color: 'white', borderRadius: 10, padding: '1px 7px',
                              fontSize: 11, fontWeight: 700, cursor: 'text',
                            }}
                            title="Clica per editar"
                          >
                            {item.unidades_actuales} ud
                          </span>
                        )}
                        <button
                          onClick={() => onDelete(item.id)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', lineHeight: '18px', padding: 0 }}
                          title="Treure producte"
                        >✕</button>
                      </div>
                    </div>
                    {/* Recompte ràpid */}
                    {isRecompteThis ? (
                      <div style={{ position: 'absolute', bottom: -60, left: 0, right: 0, background: 'white', borderRadius: 6, padding: '6px 8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 10, border: '1px solid rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: 10, color: '#6b6b68', marginBottom: 4 }}>Nou estoc:</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input type="number" min="0" value={recompteVal} onChange={e => setRecompteVal(e.target.value)} autoFocus
                            style={{ flex: 1, fontSize: 12, padding: '3px 6px', borderRadius: 4, border: '1px solid #ccc' }} />
                          <button onClick={() => { onRecompte(item, recompteVal); setRecompteId(null) }}
                            style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: 4, padding: '3px 7px', fontSize: 11, cursor: 'pointer' }}>✓</button>
                          <button onClick={() => setRecompteId(null)}
                            style={{ background: '#eee', border: 'none', borderRadius: 4, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}>✕</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', marginTop: 2, marginBottom: 2 }}>
                        <button
                          onClick={() => { setRecompteId(item.id); setRecompteVal(String(item.unidades_actuales)) }}
                          style={{ fontSize: 9, color: '#888', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                        >recompte</button>
                      </div>
                    )}
                  </div>
                )
              })}
              {/* Slot buit al final */}
              {si === shelves.length - 1 && shelf.length < SHELF_COLS && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 72 }}>
                  <button onClick={onAdd}
                    style={{ width: 40, height: 40, borderRadius: '50%', border: '2px dashed rgba(0,0,0,0.2)', background: 'rgba(255,255,255,0.5)', fontSize: 20, color: 'rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >+</button>
                </div>
              )}
            </div>
            {/* Plataforma de la prestatge */}
            <div style={{
              height: 10, marginBottom: 12,
              background: 'linear-gradient(180deg, #c4a882 0%, #a8896a 100%)',
              borderRadius: '0 0 3px 3px',
              boxShadow: '0 3px 6px rgba(0,0,0,0.15)',
            }} />
          </div>
        ))}
        {/* Botó afegir si la darrera prestatge és plena */}
        {shelves.length > 0 && shelves[shelves.length - 1].length === SHELF_COLS && (
          <div style={{ textAlign: 'center', paddingBottom: 12 }}>
            <button onClick={onAdd}
              style={{ padding: '6px 16px', borderRadius: 6, border: '1.5px dashed rgba(0,0,0,0.2)', background: 'rgba(255,255,255,0.5)', fontSize: 13, color: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
            >+ Afegir producte</button>
          </div>
        )}
        {/* Sòl */}
        <div style={{ height: 14, background: 'linear-gradient(180deg, #b89870 0%, #9a7d58 100%)', borderRadius: '0 0 8px 8px', marginTop: 0 }} />
      </div>
    </div>
  )
}

// ── Pàgina principal ──────────────────────────────────────
export default function Tiendas() {
  const [tiendas, setTiendas] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTienda, setSelectedTienda] = useState(null)
  const [stockItems, setStockItems] = useState([])
  const [loadingStock, setLoadingStock] = useState(false)

  // Modal botiga
  const [modalTienda, setModalTienda] = useState(false)
  const [form, setForm] = useState(emptyTienda)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [geocodificant, setGeocodificant] = useState(false)

  // Modal afegir producte a estanteria
  const [modalAfegir, setModalAfegir] = useState(false)
  const [afegirForm, setAfegirForm] = useState({ producto_id: '', unidades_actuales: '' })
  const [savingAfegir, setSavingAfegir] = useState(false)

  const loadTiendas = async () => {
    const { data } = await supabase.from('tiendas').select('*').order('nombre')
    setTiendas(data || [])
    setLoading(false)
  }
  const loadProductos = async () => {
    const { data } = await supabase.from('productos').select('id, nombre, pvp').eq('activo', true).order('nombre')
    setProductos(data || [])
  }
  useEffect(() => { loadTiendas(); loadProductos() }, [])

  const loadStock = async (tiendaId) => {
    setLoadingStock(true)
    const { data } = await supabase
      .from('stock_tienda')
      .select('*, productos(id, nombre, pvp)')
      .eq('tienda_id', tiendaId)
      .order('created_at')
    setStockItems(data || [])
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
    else alert('No s\'han pogut trobar les coordenades. Prova una adreça més completa.')
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
    if (editId && selectedTienda?.id === editId) setSelectedTienda({ ...selectedTienda, ...payload })
  }

  // ── Estanteria: accions ──
  const handleUpdateUnitats = async (stockId, nouVal) => {
    const val = parseFloat(nouVal)
    if (isNaN(val) || val < 0) return
    await supabase.from('stock_tienda').update({ unidades_actuales: val, fecha_ultimo_recuento: new Date().toISOString().split('T')[0] }).eq('id', stockId)
    loadStock(selectedTienda.id)
  }

  const handleDeleteStock = async (stockId) => {
    if (!confirm('Treure aquest producte de la botiga?')) return
    await supabase.from('stock_tienda').delete().eq('id', stockId)
    loadStock(selectedTienda.id)
  }

  const handleRecompte = async (item, nouVal) => {
    const nouEstoc = parseFloat(nouVal)
    if (isNaN(nouEstoc) || nouEstoc < 0) return
    const anterior = Number(item.unidades_actuales)
    await supabase.from('recuentos').insert({
      tienda_id: selectedTienda.id,
      producto_id: item.producto_id,
      stock_anterior: anterior,
      stock_nuevo: nouEstoc,
      fecha: new Date().toISOString().split('T')[0],
    })
    await supabase.from('stock_tienda').update({ unidades_actuales: nouEstoc, fecha_ultimo_recuento: new Date().toISOString().split('T')[0] }).eq('id', item.id)
    loadStock(selectedTienda.id)
  }

  const handleAfegirProducte = async (e) => {
    e.preventDefault()
    setSavingAfegir(true)
    await supabase.from('stock_tienda').upsert({
      tienda_id: selectedTienda.id,
      producto_id: afegirForm.producto_id,
      unidades_actuales: parseFloat(afegirForm.unidades_actuales) || 0,
      fecha_ultimo_recuento: new Date().toISOString().split('T')[0],
    }, { onConflict: 'tienda_id,producto_id' })
    setSavingAfegir(false)
    setModalAfegir(false)
    setAfegirForm({ producto_id: '', unidades_actuales: '' })
    loadStock(selectedTienda.id)
  }

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* ── Columna esquerra: llista botigues ── */}
      <div style={{ width: 300, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>Botigues</h1>
          <button className="btn btn-primary btn-sm" onClick={openNewTienda}>+ Nova</button>
        </div>

        {loading ? <div style={{ color: '#6b6b68' }}>Carregant...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tiendas.length === 0 && (
              <div style={{ color: '#6b6b68', fontSize: 13, padding: '1rem 0' }}>Cap botiga. Afegeix-ne una!</div>
            )}
            {tiendas.map(t => (
              <div
                key={t.id}
                onClick={() => selectTienda(t)}
                style={{
                  background: selectedTienda?.id === t.id ? '#E1F5EE' : 'white',
                  border: selectedTienda?.id === t.id ? '1.5px solid #1D9E75' : '0.5px solid rgba(0,0,0,0.1)',
                  borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14, color: selectedTienda?.id === t.id ? '#0F6E56' : '#1a1a18' }}>{t.nombre}</div>
                    {t.zona && <div style={{ fontSize: 12, color: '#6b6b68', marginTop: 2 }}>{t.zona}</div>}
                    <div style={{ marginTop: 4 }}>
                      <span className={`badge badge-${t.activa ? 'green' : 'gray'}`} style={{ fontSize: 10 }}>{t.activa ? 'Activa' : 'Inactiva'}</span>
                    </div>
                  </div>
                  <button className="btn btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={(e) => openEditTienda(t, e)}>
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Columna dreta: estanteria ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedTienda ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#6b6b68', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 40 }}>🏪</div>
            <div style={{ fontSize: 14 }}>Selecciona una botiga per veure l'estoc</div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 500 }}>{selectedTienda.nombre}</h2>
                {selectedTienda.direccion && <div style={{ fontSize: 12, color: '#6b6b68' }}>{selectedTienda.direccion}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#6b6b68' }}>
                  <strong style={{ color: '#1D9E75' }}>{stockItems.length}</strong> productes · {Number(selectedTienda.alquiler_fijo_mensual).toFixed(0)}€/mes fix
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setAfegirForm({ producto_id: '', unidades_actuales: '' }); setModalAfegir(true) }}>
                  + Afegir producte
                </button>
              </div>
            </div>

            {loadingStock ? (
              <div style={{ color: '#6b6b68', padding: '2rem 0' }}>Carregant estoc...</div>
            ) : (
              <Estanteria
                items={stockItems}
                productos={productos}
                onAdd={() => { setAfegirForm({ producto_id: '', unidades_actuales: '' }); setModalAfegir(true) }}
                onUpdate={handleUpdateUnitats}
                onDelete={handleDeleteStock}
                onRecompte={handleRecompte}
              />
            )}

            {stockItems.some(s => Number(s.unidades_actuales) < 3) && (
              <div style={{ marginTop: '1rem', background: '#FAECE7', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#993C1D' }}>
                ⚠️ Algun producte té estoc baix (menys de 3 unitats). Revisa l'estanteria.
              </div>
            )}
          </div>
        )}
      </div>

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

      {/* ── Modal afegir producte ── */}
      {modalAfegir && (
        <div className="modal-overlay" onClick={() => setModalAfegir(false)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Afegir producte</h2>
              <button className="btn btn-sm" onClick={() => setModalAfegir(false)}>✕</button>
            </div>
            <form onSubmit={handleAfegirProducte}>
              <div className="form-group">
                <label>Producte *</label>
                <select required value={afegirForm.producto_id} onChange={e => setAfegirForm(p => ({ ...p, producto_id: e.target.value }))}>
                  <option value="">Selecciona producte</option>
                  {productos
                    .filter(p => !stockItems.find(s => s.producto_id === p.id))
                    .map(p => <option key={p.id} value={p.id}>{p.nombre} — {Number(p.pvp).toFixed(2)}€</option>)
                  }
                </select>
              </div>
              <div className="form-group">
                <label>Unitats inicials *</label>
                <input required type="number" min="0" step="1" value={afegirForm.unidades_actuales} onChange={e => setAfegirForm(p => ({ ...p, unidades_actuales: e.target.value }))} placeholder="0" />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setModalAfegir(false)}>Cancel·lar</button>
                <button type="submit" className="btn btn-primary" disabled={savingAfegir}>{savingAfegir ? 'Guardant...' : 'Afegir'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
