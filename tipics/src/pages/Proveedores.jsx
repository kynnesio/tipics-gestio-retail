import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const empty = { nombre: '', contacto_nombre: '', contacto_email: '', contacto_telefono: '', iban: '', condiciones_pago: '', notas: '' }

export default function Proveedores() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('proveedores').select('*').order('nombre')
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(empty); setEditId(null); setModal(true) }
  const openEdit = (r) => { setForm(r); setEditId(r.id); setModal(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = { nombre: form.nombre, contacto_nombre: form.contacto_nombre, contacto_email: form.contacto_email, contacto_telefono: form.contacto_telefono, iban: form.iban, condiciones_pago: form.condiciones_pago, notas: form.notas }
    if (editId) {
      await supabase.from('proveedores').update(payload).eq('id', editId)
    } else {
      await supabase.from('proveedores').insert(payload)
    }
    setSaving(false)
    setModal(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Eliminar aquest proveïdor?')) return
    await supabase.from('proveedores').delete().eq('id', id)
    load()
  }

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>Proveïdors</h1>
        <button className="btn btn-primary" onClick={openNew}>+ Nou proveïdor</button>
      </div>

      {loading ? <div style={{ color: '#6b6b68' }}>Carregant...</div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Contacte</th>
                <th>Email</th>
                <th>Telèfon</th>
                <th>Condicions</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b6b68', padding: '2rem' }}>Cap proveïdor registrat.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.nombre}</td>
                  <td>{r.contacto_nombre || '—'}</td>
                  <td>{r.contacto_email || '—'}</td>
                  <td>{r.contacto_telefono || '—'}</td>
                  <td>{r.condiciones_pago || '—'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => openEdit(r)}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>Eliminar</button>
                  </td>
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
              <h2>{editId ? 'Editar proveïdor' : 'Nou proveïdor'}</h2>
              <button className="btn btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group"><label>Nom *</label><input required value={form.nombre} onChange={f('nombre')} /></div>
              <div className="form-group"><label>Nom de contacte</label><input value={form.contacto_nombre} onChange={f('contacto_nombre')} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.contacto_email} onChange={f('contacto_email')} /></div>
              <div className="form-group"><label>Telèfon</label><input value={form.contacto_telefono} onChange={f('contacto_telefono')} /></div>
              <div className="form-group"><label>IBAN</label><input value={form.iban} onChange={f('iban')} placeholder="ES00 0000..." /></div>
              <div className="form-group"><label>Condicions de pagament</label><input value={form.condiciones_pago} onChange={f('condiciones_pago')} placeholder="30 dies, dipòsit..." /></div>
              <div className="form-group"><label>Notes</label><textarea rows={3} value={form.notas} onChange={f('notas')} /></div>
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
