import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const empty = {
  nombre: '', direccion: '', zona: '',
  contacto_nombre: '', contacto_email: '', contacto_telefono: '',
  alquiler_fijo_mensual: '0', comision_variable_pct: '10',
  dies_seguiment: '15', activa: true, lat: '', lng: '',
}

async function geocodificar(adreca) {
  if (!adreca) return null
  try {
    const q = encodeURIComponent(adreca + ', Catalunya, Spain')
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, { headers: { 'Accept-Language': 'ca', 'User-Agent': 'Tipics-Gestio/1.0' } })
    const data = await res.json()
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {}
  return null
}

export default function Tiendas() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [geocodificant, setGeocodificant] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('tiendas').select('*').order('nombre')
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(empty); setEditId(null); setModal(true) }
  const openEdit = (r, e) => {
    e?.stopPropagation()
    setForm({ ...r, alquiler_fijo_mensual: String(r.alquiler_fijo_mensual || 0), comision_variable_pct: String(r.comision_variable_pct || 10), dies_seguiment: String(r.dies_seguiment || 15), lat: r.lat || '', lng: r.lng || '' })
    setEditId(r.id)
    setModal(true)
  }

  const handleGeocodificar = async () => {
    if (!form.direccion) return
    setGeocodificant(true)
    const coords = await geocodificar(form.direccion)
    if (coords) setForm(p => ({ ...p, lat: coords.lat, lng: coords.lng }))
    else alert('No s\'han pogut trobar les coordenades.')
    setGeocodificant(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nombre: form.nombre, direccion: form.direccion, zona: form.zona,
      contacto_nombre: form.contacto_nombre, contacto_email: form.contacto_email, contacto_telefono: form.contacto_telefono,
      alquiler_fijo_mensual: parseFloat(form.alquiler_fijo_mensual) || 0,
      comision_variable_pct: parseFloat(form.comision_variable_pct) || 10,
      dies_seguiment: parseInt(form.dies_seguiment) || 15,
      activa: form.activa,
      lat: form.lat !== '' ? parseFloat(form.lat) : null,
      lng: form.lng !== '' ? parseFloat(form.lng) : null,
    }
    if (editId) await supabase.from('tiendas').update(payload).eq('id', editId)
    else await supabase.from('tiendas').insert(payload)
    setSaving(false)
    setModal(false)
    load()
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.75rem' }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:300, letterSpacing:'0.04em' }}>Botigues</h1>
          <div style={{ width:28, height:2, background:'var(--brand)', marginTop:8 }} />
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nova botiga</button>
      </div>

      {loading ? <div style={{ color:'var(--text-3)' }}>Carregant...</div> : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Botiga</th><th>Zona</th><th>Contacte</th>
                <th>Lloguer fix</th><th>Seguiment</th><th>Mapa</th><th>Estat</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--text-3)', padding:'2rem' }}>Cap botiga registrada.</td></tr>}
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight:500 }}>{r.nombre}</div>
                    {r.direccion && <div style={{ fontSize:12, color:'var(--text-3)' }}>{r.direccion}</div>}
                  </td>
                  <td style={{ color:'var(--text-2)', fontSize:13 }}>{r.zona || '—'}</td>
                  <td>
                    {r.contacto_nombre && <div style={{ fontSize:13 }}>{r.contacto_nombre}</div>}
                    {r.contacto_telefono && <div style={{ fontSize:12, color:'var(--text-3)' }}>{r.contacto_telefono}</div>}
                  </td>
                  <td style={{ fontSize:13 }}>{Number(r.alquiler_fijo_mensual).toFixed(0)}€/mes</td>
                  <td>
                    <span style={{ fontSize:12, color:'var(--text-2)' }}>cada {r.dies_seguiment || 15}d</span>
                  </td>
                  <td>
                    {r.lat && r.lng
                      ? <span className="badge badge-green">✓</span>
                      : <span className="badge badge-gray">—</span>}
                  </td>
                  <td><span className={`badge badge-${r.activa ? 'green' : 'gray'}`}>{r.activa ? 'Activa' : 'Inactiva'}</span></td>
                  <td><button className="btn btn-sm" onClick={e => openEdit(r, e)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth:500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Editar botiga' : 'Nova botiga'}</h2>
              <button className="btn btn-sm" onClick={() => setModal(false)} style={{ borderRadius:'50%', width:32, height:32, padding:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group"><label>Nom *</label><input required value={form.nombre} onChange={f('nombre')} /></div>

              <div className="form-group">
                <label>Adreça</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={form.direccion} onChange={f('direccion')} placeholder="Carrer, número, municipi" style={{ flex:1 }} />
                  <button type="button" className="btn btn-sm" onClick={handleGeocodificar} disabled={!form.direccion || geocodificant} style={{ whiteSpace:'nowrap', flexShrink:0 }}>
                    {geocodificant ? '…' : '📍 Ubicar'}
                  </button>
                </div>
              </div>

              {form.lat && form.lng && (
                <div style={{ background:'var(--green-bg)', borderRadius:8, padding:'7px 12px', marginBottom:'1rem', fontSize:12, color:'var(--green)' }}>
                  ✓ {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)}
                </div>
              )}

              <div className="form-group"><label>Zona / comarca</label><input value={form.zona} onChange={f('zona')} placeholder="Maresme, Barcelona…" /></div>
              <div className="form-group"><label>Persona de contacte</label><input value={form.contacto_nombre} onChange={f('contacto_nombre')} /></div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group"><label>Email</label><input type="email" value={form.contacto_email} onChange={f('contacto_email')} /></div>
                <div className="form-group"><label>Telèfon</label><input value={form.contacto_telefono} onChange={f('contacto_telefono')} /></div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <div className="form-group"><label>Lloguer fix (€/mes)</label><input type="number" step="0.01" min="0" value={form.alquiler_fijo_mensual} onChange={f('alquiler_fijo_mensual')} /></div>
                <div className="form-group"><label>Comissió (%)</label><input type="number" step="0.1" min="0" max="100" value={form.comision_variable_pct} onChange={f('comision_variable_pct')} /></div>
                <div className="form-group">
                  <label>Dies seguiment</label>
                  <input type="number" min="1" max="90" value={form.dies_seguiment} onChange={f('dies_seguiment')} placeholder="15" />
                </div>
              </div>

              <div style={{ background:'var(--cream-lt)', borderRadius:8, padding:'8px 12px', marginBottom:'1rem', fontSize:12, color:'var(--text-2)' }}>
                ⏰ S'avisarà de fer seguiment cada <strong>{form.dies_seguiment || 15} dies</strong> des de l'últim enviament
              </div>

              <div className="form-group" style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <input type="checkbox" id="activa" checked={form.activa} onChange={e => setForm(p => ({ ...p, activa: e.target.checked }))} style={{ width:'auto', cursor:'pointer' }} />
                <label htmlFor="activa" style={{ margin:0, cursor:'pointer', fontSize:14, fontWeight:400, textTransform:'none', letterSpacing:0, color:'var(--text)' }}>Botiga activa</label>
              </div>

              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:'0.5rem' }}>
                <button type="button" className="btn" onClick={() => setModal(false)}>Cancel·lar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardant…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
