import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Stock() {
  const [tiendas, setTiendas] = useState([])
  const [productos, setProductos] = useState([])
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ tienda_id: '', producto_id: '', unidades_actuales: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filterTienda, setFilterTienda] = useState('')

  const load = async () => {
    const [{ data: t }, { data: p }, { data: s }] = await Promise.all([
      supabase.from('tiendas').select('id, nombre').eq('activa', true).order('nombre'),
      supabase.from('productos').select('id, nombre, pvp').eq('activo', true).order('nombre'),
      supabase.from('stock_tienda').select('*, tiendas(nombre), productos(nombre, pvp)').order('fecha_ultimo_recuento', { ascending: false }),
    ])
    setTiendas(t || [])
    setProductos(p || [])
    setStock(s || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm({ tienda_id: filterTienda || '', producto_id: '', unidades_actuales: '' }); setEditId(null); setModal(true) }
  const openEdit = (r) => { setForm({ tienda_id: r.tienda_id, producto_id: r.producto_id, unidades_actuales: String(r.unidades_actuales) }); setEditId(r.id); setModal(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      tienda_id: form.tienda_id,
      producto_id: form.producto_id,
      unidades_actuales: parseFloat(form.unidades_actuales) || 0,
      fecha_ultimo_recuento: new Date().toISOString().split('T')[0],
    }
    if (editId) {
      await supabase.from('stock_tienda').update(payload).eq('id', editId)
    } else {
      await supabase.from('stock_tienda').upsert(payload, { onConflict: 'tienda_id,producto_id' })
    }
    setSaving(false)
    setModal(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Treure aquest producte de la botiga?')) return
    await supabase.from('stock_tienda').delete().eq('id', id)
    load()
  }

  const filtered = filterTienda ? stock.filter(s => s.tienda_id === filterTienda) : stock
  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>Estoc per botiga</h1>
        <button className="btn btn-primary" onClick={openNew}>+ Assignar producte</button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <select value={filterTienda} onChange={e => setFilterTienda(e.target.value)} style={{ padding: '8px 10px', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, background: 'white', minWidth: 220 }}>
          <option value="">Totes les botigues</option>
          {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>

      {loading ? <div style={{ color: '#6b6b68' }}>Carregant...</div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Botiga</th>
                <th>Producte</th>
                <th>Unitats actuals</th>
                <th>Valor estoc</th>
                <th>Darrer recompte</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b6b68', padding: '2rem' }}>Sense estoc assignat. Utilitza el botó per assignar productes a botigues.</td></tr>
              )}
              {filtered.map(r => {
                const valorEstoc = Number(r.unidades_actuales) * Number(r.productos?.pvp || 0)
                const baixEstoc = Number(r.unidades_actuales) < 3
                return (
                  <tr key={r.id}>
                    <td>{r.tiendas?.nombre || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{r.productos?.nombre || '—'}</td>
                    <td>
                      <span className={`badge badge-${baixEstoc ? 'red' : 'green'}`}>
                        {Number(r.unidades_actuales)} ud
                      </span>
                    </td>
                    <td>{valorEstoc.toFixed(2)}€</td>
                    <td style={{ color: '#6b6b68', fontSize: 12 }}>{r.fecha_ultimo_recuento || '—'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(r)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>Treure</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Actualitzar estoc' : 'Assignar producte a botiga'}</h2>
              <button className="btn btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Botiga *</label>
                <select required value={form.tienda_id} onChange={f('tienda_id')}>
                  <option value="">Selecciona botiga</option>
                  {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Producte *</label>
                <select required value={form.producto_id} onChange={f('producto_id')}>
                  <option value="">Selecciona producte</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} — {Number(p.pvp).toFixed(2)}€</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Unitats actuals *</label>
                <input required type="number" step="1" min="0" value={form.unidades_actuales} onChange={f('unidades_actuales')} placeholder="0" />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setModal(false)}>Cancel·lar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardant...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
