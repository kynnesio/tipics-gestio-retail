import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DIES_ALERTA = 75

function Toggle({ value, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:12, color: value ? 'var(--text-3)' : 'var(--text)', fontWeight: value ? 400 : 600 }}>Actius</span>
      <div onClick={() => onChange(!value)} style={{ width:40, height:22, borderRadius:11, background: value ? '#956C58' : '#E8D8C8', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
        <div style={{ width:16, height:16, borderRadius:'50%', background:'white', position:'absolute', top:3, left: value ? 21 : 3, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.25)' }} />
      </div>
      <span style={{ fontSize:12, color: value ? 'var(--text)' : 'var(--text-3)', fontWeight: value ? 600 : 400 }}>Tots</span>
    </div>
  )
}

function DiesLabel({ data }) {
  if (!data) return null
  const dies = Math.ceil((new Date(data) - new Date()) / 86400000)
  const color = dies < 0 ? '#8B2A2A' : dies <= 15 ? '#8B2A2A' : dies <= DIES_ALERTA ? '#7A4F1A' : '#2D6A4F'
  const bg    = dies < 0 ? '#F8EFEF' : dies <= 15 ? '#F8EFEF' : dies <= DIES_ALERTA ? '#F5EBE0' : '#EEF5F1'
  return (
    <span style={{ background:bg, color, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:10, whiteSpace:'nowrap' }}>
      {dies < 0 ? `Caducat fa ${Math.abs(dies)}d` : dies === 0 ? 'Caduca avui!' : `${dies}d`}
    </span>
  )
}

function BarraDistribucio({ lot }) {
  const total = lot.unitats_produides || 0
  if (total === 0 && lot.kg_inicials) {
    const kgIni = lot.kg_inicials || 1
    const pct = Math.min(100, ((kgIni - (lot.kg_restants || 0)) / kgIni) * 100)
    return (
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-3)', marginBottom:4 }}>
          <span>Pendent conversió</span><span>{lot.kg_restants||0}kg / {lot.kg_inicials}kg</span>
        </div>
        <div style={{ background:'var(--cream)', borderRadius:4, height:6 }}>
          <div style={{ width:`${pct}%`, background:'#956C58', height:'100%', borderRadius:4 }} />
        </div>
      </div>
    )
  }
  if (total === 0) return null
  const mag    = lot.unitats_magatzem || 0
  const distrib = (lot.unitats_botigues || 0) + (lot.unitats_venudes || 0)
  const mos    = lot.unitats_mostres || 0
  const mer    = lot.unitats_merma   || 0
  const pct    = Math.min(100, ((total - mag) / total) * 100)
  const segments = [
    { val:distrib, color:'#1A1918' },
    { val:mos,     color:'#7A4F1A' },
    { val:mer,     color:'#8B2A2A' },
  ].filter(s => s.val > 0)
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-3)', marginBottom:4 }}>
        <span style={{ fontWeight: mag > 0 ? 600 : 400, color: mag > 0 ? 'var(--text)' : 'var(--text-3)' }}>
          {mag > 0 ? `${mag} ud al magatzem` : 'Sense estoc al magatzem'}
        </span>
        <span>{pct.toFixed(0)}% distribuït</span>
      </div>
      <div style={{ display:'flex', height:6, borderRadius:3, overflow:'hidden', background:'var(--cream)' }}>
        {segments.map((s,i) => <div key={i} style={{ width:`${(s.val/total)*100}%`, background:s.color }} />)}
      </div>
    </div>
  )
}

export default function Lots() {
  const [lots, setLots] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarTots, setMostrarTots] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [moviments, setMoviments] = useState([])
  const [editLot, setEditLot] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data:l }, { data:p }] = await Promise.all([
      supabase.from('lots').select('*').order('created_at', { ascending:false }),
      supabase.from('productos').select('id,nombre,sku').order('sku'),
    ])
    setLots(l||[])
    setProductos(p||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggleLot = async (lot) => {
    if (expanded === lot.id) { setExpanded(null); setMoviments([]); return }
    setExpanded(lot.id)
    const { data } = await supabase.from('moviments').select('*,tiendas(nombre)').eq('lot_id',lot.id).order('created_at',{ascending:true})
    setMoviments(data||[])
  }

  const openEdit = (lot, e) => {
    e.stopPropagation()
    setEditLot(lot)
    setEditForm({
      numero_lot: lot.numero_lot || '',
      numero_lot_extern: lot.numero_lot_extern || '',
      data_caducitat: lot.data_caducitat || '',
      estat: lot.estat || 'actiu',
      notes: lot.notes || '',
    })
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('lots').update({
      numero_lot: editForm.numero_lot,
      numero_lot_extern: editForm.numero_lot_extern || null,
      data_caducitat: editForm.data_caducitat || null,
      estat: editForm.estat,
      notes: editForm.notes || null,
    }).eq('id', editLot.id)
    setSaving(false)
    setEditLot(null)
    load()
  }

  const handleRetira = async (lotId, e) => {
    e.stopPropagation()
    if (!confirm('Marcar com a retirat?')) return
    await supabase.from('lots').update({ estat:'retirat' }).eq('id',lotId)
    load()
  }

  const fe = (k) => (e) => setEditForm(p => ({ ...p, [k]: e.target.value }))

  const lotsFiltered = mostrarTots ? lots : lots.filter(l => l.estat === 'actiu')
  const grouped = productos
    .map(p => ({ prod:p, lots:lotsFiltered.filter(l => l.producto_id === p.id) }))
    .filter(g => g.lots.length > 0)

  const ESTAT_BADGE = { actiu:'badge-green', esgotat:'badge-gray', retirat:'badge-red', caducat:'badge-red' }
  const tipusLabel = { entrada_kg:'📦 Entrada kg', entrada_ud:'📦 Entrada ud', conversio_ud:'⚖️ Conversió', enviament:'🚚 Botiga', venda:'🏪 Botiga', mostra:'🎁 Mostra', merma:'⚠️ Merma', devolucio:'↩️ Devolució' }
  const tipusColor = { entrada_kg:'#956C58', entrada_ud:'#956C58', conversio_ud:'#6B4F3A', enviament:'#1A1918', venda:'#1A1918', mostra:'#7A4F1A', merma:'#8B2A2A' }
  const alertes = lots.filter(l => l.estat==='actiu' && l.data_caducitat && Math.ceil((new Date(l.data_caducitat)-new Date())/86400000) <= DIES_ALERTA)

  if (loading) return <div style={{ color:'var(--text-3)' }}>Carregant...</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.75rem' }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:300, letterSpacing:'0.04em' }}>Lots</h1>
          <div style={{ width:28, height:2, background:'#956C58', marginTop:8 }} />
        </div>
        <Toggle value={mostrarTots} onChange={setMostrarTots} />
      </div>

      {alertes.length > 0 && (
        <div style={{ background:'#F8EFEF', border:'1px solid rgba(139,42,42,0.2)', borderRadius:10, padding:'10px 14px', marginBottom:'1.25rem', fontSize:13, color:'#8B2A2A' }}>
          ⚠️ <strong>{alertes.length} lot{alertes.length>1?'s':''}</strong> caduca{alertes.length>1?'n':''} en menys de {DIES_ALERTA} dies:
          {alertes.map(l => { const p=productos.find(p=>p.id===l.producto_id); return ` ${l.numero_lot} (${p?.sku||p?.nombre})` }).join(' ·')}
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:32 }}>
        {grouped.map(({ prod, lots:prodLots }) => (
          <div key={prod.id}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, paddingBottom:8, borderBottom:'1px solid var(--line)' }}>
              <span style={{ background:'var(--cream)', color:'#956C58', borderRadius:6, padding:'3px 12px', fontSize:12, fontWeight:700, letterSpacing:'0.04em' }}>{prod.sku||prod.nombre}</span>
              <span style={{ fontSize:13, color:'var(--text-2)' }}>{prod.nombre}</span>
              <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-3)' }}>
                {prodLots.filter(l=>l.estat==='actiu').length} actius · {prodLots.length} mostrats
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {prodLots.map(lot => (
                <div key={lot.id}>
                  <div onClick={() => toggleLot(lot)} style={{
                    background:'white', border:`1px solid ${expanded===lot.id?'#956C58':'var(--line)'}`,
                    borderRadius: expanded===lot.id ? '10px 10px 0 0' : 10,
                    padding:'0.9rem 1rem', cursor:'pointer', transition:'border-color 0.12s',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                        <span style={{ fontWeight:600, fontSize:15 }}>{lot.numero_lot}</span>
                        {lot.numero_lot_extern && (
                          <span style={{ fontSize:11, color:'var(--text-3)', background:'var(--cream-lt)', padding:'1px 7px', borderRadius:5 }}>
                            {lot.numero_lot_extern}
                          </span>
                        )}
                        <span className={`badge ${ESTAT_BADGE[lot.estat]||'badge-gray'}`}>{lot.estat}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        <DiesLabel data={lot.data_caducitat} />
                        <button className="btn btn-sm" onClick={e => openEdit(lot, e)} style={{ fontSize:11, padding:'3px 10px' }}>Editar</button>
                        {lot.estat==='actiu' && (
                          <button className="btn btn-sm btn-danger" onClick={e => handleRetira(lot.id,e)} style={{ fontSize:10, padding:'2px 8px' }}>Retirar</button>
                        )}
                        <span style={{ color:'var(--text-3)', fontSize:11 }}>{expanded===lot.id?'▲':'▼'}</span>
                      </div>
                    </div>
                    <BarraDistribucio lot={lot} />
                    {lot.notes && <div style={{ fontSize:10, color:'var(--text-3)', marginTop:6 }}>{lot.notes}</div>}
                  </div>

                  {expanded === lot.id && (
                    <div style={{ background:'var(--surface-2)', border:'1px solid #956C58', borderTop:'none', borderRadius:'0 0 10px 10px', padding:'0.75rem 1rem' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.5rem' }}>Historial</div>
                      {moviments.length === 0 ? (
                        <div style={{ color:'var(--text-3)', fontSize:12 }}>Sense moviments registrats.</div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                          {moviments.map(m => (
                            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                              <div style={{ width:7, height:7, borderRadius:'50%', background:tipusColor[m.tipus]||'#ccc', flexShrink:0 }} />
                              <span style={{ color:tipusColor[m.tipus], fontWeight:500, minWidth:110 }}>{tipusLabel[m.tipus]||m.tipus}</span>
                              <span style={{ fontWeight:600 }}>{m.quantitat} {m.unitat}</span>
                              {m.tiendas?.nombre ? (
                                <span style={{ color:'var(--text-2)' }}>→ {m.tiendas.nombre}</span>
                              ) : m.notes ? (
                                <span style={{ color:'var(--text-3)', fontStyle:'italic' }}>{m.notes}</span>
                              ) : null}
                              <span style={{ marginLeft:'auto', color:'var(--text-3)', fontSize:10 }}>{m.data}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-3)', fontSize:13 }}>
            {mostrarTots ? 'Sense lots.' : 'Sense lots actius. Activa "Tots" per veure l\'historial.'}
          </div>
        )}
      </div>

      {/* Modal editar lot */}
      {editLot && (
        <div className="modal-overlay" onClick={() => setEditLot(null)}>
          <div className="modal" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar lot</h2>
              <button className="btn btn-sm" onClick={() => setEditLot(null)} style={{ borderRadius:'50%', width:30, height:30, padding:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>×</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label>Núm. lot intern *</label>
                  <input required value={editForm.numero_lot} onChange={fe('numero_lot')} placeholder="L018, LL005..." style={{ fontFamily:'monospace' }} />
                </div>
                <div className="form-group">
                  <label>Núm. lot extern (productor)</label>
                  <input value={editForm.numero_lot_extern} onChange={fe('numero_lot_extern')} placeholder="G4172, Sauleda..." />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label>Data caducitat</label>
                  <input type="date" value={editForm.data_caducitat} onChange={fe('data_caducitat')} />
                </div>
                <div className="form-group">
                  <label>Estat</label>
                  <select value={editForm.estat} onChange={fe('estat')}>
                    <option value="actiu">Actiu</option>
                    <option value="esgotat">Esgotat</option>
                    <option value="retirat">Retirat</option>
                    <option value="caducat">Caducat</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea rows={3} value={editForm.notes} onChange={fe('notes')} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button type="button" className="btn" onClick={() => setEditLot(null)}>Cancel·lar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardant…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
