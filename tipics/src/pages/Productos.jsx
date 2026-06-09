import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const empty = { nombre: '', proveedor_id: '', pvp: '', coste_proveedor: '', unidad: 'ud', descripcion: '', activo: true }

export default function Productos() {
  const [rows, setRows] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: prods }, { data: provs }] = await Promise.all([
      supabase.from('productos').select('*, proveedores(nombre)').order('nombre'),
      supabase.from('proveedores').select('id, nombre').order('nombre'),
    ])
    setRows(prods || [])
    setProveedores(provs || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(empty); setEditId(null); setModal(true) }
  const openEdit = (r) => { setForm({ ...r, proveedor_id: r.proveedor_id || '' }); setEditId(r.id); setModal(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nombre: form.nombre,
      proveedor_id: form.proveedor_id || null,
      pvp: parseFloat(form.pvp),
      coste_proveedor: parseFloat(form.coste_proveedor),
      unidad: form.unidad,
      descripcion: form.descripcion,
      activo: form.activo,
    }
    if (editId) {
      await supabase.from('productos').update(payload).eq('id', editId)
    } else {
      await supabase.from('productos').insert(payload)
    }
    setSaving(false)
    setModal(false)
    load()
  }

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))
  const marge = (pvp, cost) => pvp > 0 ? (((pvp - cost) / pvp) * 100).toFixed(0) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>Productes</h1>
        <button className="btn btn-primary" onClick={openNew}>+ Nou producte</button>
      </div>

      {loading ? <div style={{ color: '#6b6b68' }}>Carregant...</div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Producte</th>
                <th>Proveïdor</th>
                <th>PVP</th>
                <th>Cost</th>
                <th>Marge</th>
                <th>Unitat</th>
                <th>Estat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#6b6b68', padding: '2rem' }}>Cap producte registrat.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.nombre}</td>
                  <td>{r.proveedores?.nombre || '—'}</td>
                  <td>{Number(r.pvp).toFixed(2)}€</td>
                  <td>{Number(r.coste_proveedor).toFixed(2)}€</td>
                  <td>
                    <span className={`badge badge-${marge(r.pvp, r.coste_proveedor) > 40 ? 'green' : marge(r.pvp, r.coste_proveedor) > 20 ? 'amber' : 'red'}`}>
                      {marge(r.pvp, r.coste_proveedor)}%
                    </span>
                  </td>
                  <td>{r.unidad}</td>
                  <td><span className={`badge badge-${r.activo ? 'green' : 'gray'}`}>{r.activo ? 'Actiu' : 'Inactiu'}</span></td>
                  <td><button className="btn btn-sm" onClick={() => openEdit(r)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Editar producte' : 'Nou producte'}</h2>
              <button className="btn btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group"><label>Nom *</label><input required value={form.nombre} onChange={f('nombre')} /></div>
              <div className="form-group">
                <label>Proveïdor</label>
                <select value={form.proveedor_id} onChange={f('proveedor_id')}>
                  <option value="">Sense proveïdor</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label>PVP (€) *</label><input required type="number" step="0.01" min="0" value={form.pvp} onChange={f('pvp')} /></div>
                <div className="form-group"><label>Cost proveïdor (€) *</label><input required type="number" step="0.01" min="0" value={form.coste_proveedor} onChange={f('coste_proveedor')} /></div>
              </div>
              {form.pvp && form.coste_proveedor && (
                <div style={{ background: '#E1F5EE', borderRadius: 6, padding: '8px 12px', marginBottom: '1rem', fontSize: 13, color: '#0F6E56' }}>
                  Marge Típics: <strong>{marge(parseFloat(form.pvp), parseFloat(form.coste_proveedor))}%</strong> ({(parseFloat(form.pvp) - parseFloat(form.coste_proveedor)).toFixed(2)}€ per unitat)
                </div>
              )}
              <div className="form-group">
                <label>Unitat</label>
                <select value={form.unidad} onChange={f('unidad')}>
                  <option value="ud">Unitat (ud)</option>
                  <option value="kg">Quilogram (kg)</option>
                  <option value="l">Litre (l)</option>
                  <option value="pack">Pack</option>
                </select>
              </div>
              <div className="form-group"><label>Descripció</label><textarea rows={2} value={form.descripcion} onChange={f('descripcion')} /></div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="activo" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))} style={{ width: 'auto' }} />
                <label htmlFor="activo" style={{ margin: 0 }}>Producte actiu</label>
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
