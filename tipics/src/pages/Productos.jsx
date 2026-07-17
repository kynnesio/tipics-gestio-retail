import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const empty = { nombre: '', sku: '', tipus_unitat: 'ud', proveedor_id: '', pvp: '', coste_proveedor: '', descripcion: '', activo: true }

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
      supabase.from('productos').select('*, proveedores(nombre)').order('sku').order('nombre'),
      supabase.from('proveedores').select('id, nombre').order('nombre'),
    ])
    setRows(prods || [])
    setProveedores(provs || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(empty); setEditId(null); setModal(true) }
  const openEdit = (r) => {
    setForm({ ...r, proveedor_id: r.proveedor_id || '', sku: r.sku || '', tipus_unitat: r.tipus_unitat || 'ud' })
    setEditId(r.id)
    setModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nombre: form.nombre,
      sku: form.sku || null,
      tipus_unitat: form.tipus_unitat || 'ud',
      proveedor_id: form.proveedor_id || null,
      pvp: parseFloat(form.pvp) || 0,
      coste_proveedor: parseFloat(form.coste_proveedor) || 0,
      descripcion: form.descripcion || null,
      activo: form.activo,
    }
    if (editId) await supabase.from('productos').update(payload).eq('id', editId)
    else await supabase.from('productos').insert(payload)
    setSaving(false)
    setModal(false)
    load()
  }

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))
  const marge = (pvp, cost) => pvp > 0 ? (((pvp - cost) / pvp) * 100).toFixed(0) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, letterSpacing: '0.06em' }}>Productes</h1>
          <div style={{ width: 28, height: 2, background: '#956C58', marginTop: 6 }} />
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nou producte</button>
      </div>

      {loading ? <div style={{ color: 'var(--c-text-muted)' }}>Carregant...</div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nom</th>
                <th>Proveïdor</th>
                <th>Unitat</th>
                <th>PVP</th>
                <th>Cost</th>
                <th>Marge</th>
                <th>Estat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: '2rem' }}>Cap producte registrat.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    {r.sku
                      ? <span style={{ background: 'var(--c-cream)', color: '#956C58', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{r.sku}</span>
                      : <span style={{ color: 'var(--c-text-light)', fontSize: 11 }}>Sense SKU</span>
                    }
                  </td>
                  <td style={{ fontWeight: 500 }}>{r.nombre}</td>
                  <td style={{ color: 'var(--c-text-muted)', fontSize: 12 }}>{r.proveedores?.nombre || '—'}</td>
                  <td><span className="badge badge-gray">{r.tipus_unitat || 'ud'}</span></td>
                  <td>{Number(r.pvp).toFixed(2)}€</td>
                  <td style={{ color: 'var(--c-text-muted)' }}>{Number(r.coste_proveedor).toFixed(2)}€</td>
                  <td>
                    <span className={`badge badge-${marge(r.pvp, r.coste_proveedor) > 40 ? 'green' : marge(r.pvp, r.coste_proveedor) > 20 ? 'amber' : 'red'}`}>
                      {marge(r.pvp, r.coste_proveedor)}%
                    </span>
                  </td>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Nom *</label>
                  <input required value={form.nombre} onChange={f('nombre')} placeholder="Galetes Senyors i Senyores" />
                </div>
                <div className="form-group">
                  <label>SKU</label>
                  <input value={form.sku} onChange={f('sku')} placeholder="SIS-120" style={{ fontFamily: 'monospace' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Unitat de mesura</label>
                  <select value={form.tipus_unitat} onChange={f('tipus_unitat')}>
                    <option value="ud">Unitats (ud)</option>
                    <option value="kg">Quilograms (kg)</option>
                    <option value="l">Litres (l)</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Proveïdor</label>
                  <select value={form.proveedor_id} onChange={f('proveedor_id')}>
                    <option value="">Sense proveïdor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>PVP (€) *</label>
                  <input required type="number" step="0.01" min="0" value={form.pvp} onChange={f('pvp')} />
                </div>
                <div className="form-group">
                  <label>Cost proveïdor (€)</label>
                  <input type="number" step="0.01" min="0" value={form.coste_proveedor} onChange={f('coste_proveedor')} />
                </div>
              </div>

              {form.pvp && form.coste_proveedor && (
                <div style={{ background: 'var(--c-cream-light)', borderRadius: 6, padding: '8px 12px', marginBottom: '1rem', fontSize: 13, color: '#956C58' }}>
                  Marge: <strong>{marge(parseFloat(form.pvp), parseFloat(form.coste_proveedor))}%</strong> · {(parseFloat(form.pvp) - parseFloat(form.coste_proveedor)).toFixed(2)}€ per unitat
                </div>
              )}

              <div className="form-group">
                <label>Descripció</label>
                <textarea rows={2} value={form.descripcion} onChange={f('descripcion')} />
              </div>

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
