import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ── Flow tree popup ──────────────────────────────────────────────────────────
function FluxModal({ lot, moviments, productos, proveedores, onClose }) {
  const prod      = productos.find(p => p.id === lot.producto_id)
  const proveidor = proveedores.find(p => p.id === prod?.proveedor_id)
  const provNom   = proveidor?.nombre || lot.notes?.split(' · ')[0] || '—'

  // Agrupar moviments
  // venut = botigues: tractem 'venda' igual que 'enviament'
  const aBotigues  = moviments.filter(m => (m.tipus === 'enviament' || m.tipus === 'venda') && m.tienda_id)
  const aParticular= moviments.filter(m => (m.tipus === 'enviament' || m.tipus === 'venda') && !m.tienda_id)
  const aMostres   = moviments.filter(m => m.tipus === 'mostra')

  // Agrupar per botiga (suma si hi ha múltiples enviaments a la mateixa)
  const byTienda = {}
  aBotigues.forEach(m => {
    const nom = m.tiendas?.nombre || '?'
    byTienda[nom] = (byTienda[nom] || 0) + Number(m.quantitat)
  })

  const totalPart  = aParticular.reduce((s, m) => s + Number(m.quantitat), 0)
  const totalMos   = aMostres.reduce((s, m) => s + Number(m.quantitat), 0)
  const magatzem   = lot.unitats_magatzem || 0
  const total      = lot.unitats_produides || lot.kg_inicials || 0
  const tenimDades = Object.keys(byTienda).length > 0 || totalPart > 0 || totalMos > 0

  const Node = ({ children, color = '#956C58', bg = 'var(--cream-lt)' }) => (
    <div style={{ display:'inline-flex', alignItems:'center', padding:'6px 16px', borderRadius:20, background:bg, color, fontSize:13, fontWeight:500, margin:'0 auto' }}>
      {children}
    </div>
  )

  const Arrow = () => (
    <div style={{ textAlign:'center', color:'var(--text-3)', fontSize:14, lineHeight:'28px' }}>│</div>
  )

  const DestRow = ({ icon, label, val, color, bg }) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 14px', background: bg || 'var(--surface-2)', borderRadius:10, marginBottom:5 }}>
      <span style={{ fontSize:14, color: color || 'var(--text)' }}>{icon} {label}</span>
      <span style={{ fontWeight:600, fontSize:14, color: color || 'var(--text)' }}>{val} ud</span>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:17, fontWeight:600 }}>{lot.numero_lot}</span>
            {lot.numero_lot_extern && (
              <span style={{ fontSize:12, color:'var(--text-3)', background:'var(--cream-lt)', padding:'1px 8px', borderRadius:5 }}>{lot.numero_lot_extern}</span>
            )}
          </div>
            <div style={{ fontSize:12, color:'var(--text-2)', marginTop:1 }}>{prod?.sku} · {prod?.nombre}</div>
          </div>
          <button className="btn btn-sm" onClick={onClose} style={{ borderRadius:'50%', width:32, height:32, padding:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>×</button>
        </div>

        {/* Flux vertical */}
        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

          {/* Productor */}
          <div style={{ textAlign:'center', marginBottom:2 }}>
            <Node color='#7A5445' bg='var(--cream)'>{provNom}</Node>
            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>
              {lot.kg_inicials ? `${lot.kg_inicials}kg → ${total} ud` : `${total} ud rebudes`}
            </div>
          </div>

          <Arrow />

          {/* Magatzem */}
          <div style={{ textAlign:'center', marginBottom:2 }}>
            <Node color='var(--cream-lt)' bg='#1A1918'>Magatzem Típics</Node>
          </div>

          <Arrow />

          {/* Destins */}
          <div>
            {!tenimDades && (
              <div style={{ textAlign:'center', padding:'1rem', color:'var(--text-3)', fontSize:13 }}>
                Sense moviments registrats per aquest lot.
              </div>
            )}

            {Object.keys(byTienda).length > 0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Botigues</div>
                {Object.entries(byTienda).sort((a,b) => b[1]-a[1]).map(([nom, ud]) => (
                  <DestRow key={nom} icon="🏪" label={nom} val={ud} />
                ))}
              </div>
            )}

            {totalPart > 0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Particulars / online</div>
                {aParticular.map(m => (
                  <DestRow key={m.id} icon="👤" label={m.notes || 'Particular'} val={Number(m.quantitat)} />
                ))}
              </div>
            )}

            {totalMos > 0 && <DestRow icon="🎁" label="Mostres / regals" val={totalMos} color='var(--amber)' bg='var(--amber-bg)' />}

            {magatzem > 0 && (
              <div style={{ marginTop: totalMos > 0 ? 5 : 0 }}>
                <DestRow icon="📦" label="Al magatzem (restant)" val={magatzem} color='var(--brand)' bg='var(--cream-lt)' />
              </div>
            )}

            {/* Total */}
            <div style={{ borderTop:'1px solid var(--line)', marginTop:12, paddingTop:10, display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-3)' }}>
              <span>Total {lot.unitats_produides ? 'produït' : 'rebut'}</span>
              <span style={{ fontWeight:600, color:'var(--text)' }}>{total} {lot.unitats_produides ? 'ud' : 'kg'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pàgina ───────────────────────────────────────────────────────────────────
export default function Tracabilitat() {
  const [lots, setLots] = useState([])
  const [productos, setProductos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLot, setSelectedLot] = useState(null)
  const [selectedMovs, setSelectedMovs] = useState([])
  const [filterProd, setFilterProd] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: p }, { data: pr }] = await Promise.all([
        supabase.from('lots').select('*').order('created_at', { ascending: false }),
        supabase.from('productos').select('id, nombre, sku, proveedor_id').order('sku'),
        supabase.from('proveedores').select('id, nombre'),
      ])
      setLots(l || [])
      setProductos(p || [])
      setProveedores(pr || [])
      setLoading(false)
    }
    load()
  }, [])

  const openLot = async (lot) => {
    setSelectedLot(lot)
    const { data } = await supabase
      .from('moviments').select('*, tiendas(nombre)')
      .eq('lot_id', lot.id).order('created_at', { ascending: true })
    setSelectedMovs(data || [])
  }

  const filtered = lots.filter(l => !filterProd || l.producto_id === filterProd)
  const grouped  = productos
    .map(p => ({ prod: p, lots: filtered.filter(l => l.producto_id === p.id) }))
    .filter(g => g.lots.length > 0)

  const ESTAT_DOT = { actiu:'#2D6A4F', esgotat:'#ABA7A4', retirat:'#8B2A2A' }

  if (loading) return <div style={{ color:'var(--text-3)' }}>Carregant...</div>

  return (
    <div>
      <div style={{ marginBottom:'1.75rem' }}>
        <h1 style={{ fontSize:26, fontWeight:300, letterSpacing:'0.04em' }}>Traçabilitat</h1>
        <div style={{ width:28, height:2, background:'var(--brand)', marginTop:8 }} />
      </div>

      {/* Filtre */}
      <div style={{ marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:10 }}>
        <select value={filterProd} onChange={e => setFilterProd(e.target.value)}
          style={{ padding:'8px 12px', border:'1px solid var(--line-dk)', borderRadius:var_r_md_fallback(), background:'var(--surface)', fontSize:14, color:'var(--text)', cursor:'pointer', outline:'none' }}>
          <option value="">Tots els productes</option>
          {productos.map(p => <option key={p.id} value={p.id}>{p.sku || p.nombre}</option>)}
        </select>
        <span style={{ fontSize:12, color:'var(--text-3)' }}>Clica un lot per veure el flux complet</span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
        {grouped.map(({ prod, lots: prodLots }) => (
          <div key={prod.id}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, paddingBottom:8, borderBottom:'1px solid var(--line)' }}>
              <span style={{ background:'var(--cream)', color:'var(--brand-dk)', borderRadius:6, padding:'3px 12px', fontSize:12, fontWeight:700, letterSpacing:'0.04em' }}>
                {prod.sku || prod.nombre}
              </span>
              <span style={{ fontSize:13, color:'var(--text-2)' }}>{prod.nombre}</span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {prodLots.map(lot => {
                const prov = proveedores.find(p => p.id === prod.proveedor_id)
                const provNom = prov?.nombre || lot.notes?.split(' · ')[0] || '—'
                const mag = lot.unitats_magatzem || 0
                const bot = (lot.unitats_botigues || 0) + (lot.unitats_venudes || 0)

                return (
                  <div key={lot.id} onClick={() => openLot(lot)}
                    style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:12, padding:'12px 16px', cursor:'pointer', transition:'box-shadow 0.15s, border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow='var(--shadow-sm)'; e.currentTarget.style.borderColor='rgba(149,108,88,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor='var(--line)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:7, height:7, borderRadius:'50%', background:ESTAT_DOT[lot.estat] || '#ccc', flexShrink:0 }} />
                        <span style={{ fontWeight:600, fontSize:15 }}>{lot.numero_lot}</span>
                        {lot.numero_lot_extern && (
                          <span style={{ fontSize:11, color:'var(--text-3)', background:'var(--cream-lt)', padding:'1px 7px', borderRadius:5 }}>{lot.numero_lot_extern}</span>
                        )}
                        <span style={{ fontSize:12, color:'var(--brand)', fontWeight:500 }}>{provNom}</span>
                        {lot.data_caducitat && <span style={{ fontSize:11, color:'var(--text-3)' }}>· {lot.data_caducitat}</span>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        {mag > 0 && <span style={{ fontSize:12, color:'var(--text-2)' }}>📦 {mag}</span>}
                        {bot > 0 && <span style={{ fontSize:12, color:'var(--text-2)' }}>🏪 {bot}</span>}
                        <span style={{ fontSize:11, color:'var(--text-3)' }}>→</span>
                      </div>
                    </div>
                    {lot.notes && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4, paddingLeft:17 }}>{lot.notes}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {grouped.length === 0 && (
          <div style={{ textAlign:'center', padding:'4rem', color:'var(--text-3)', fontSize:14 }}>Sense lots registrats.</div>
        )}
      </div>

      {selectedLot && (
        <FluxModal lot={selectedLot} moviments={selectedMovs} productos={productos} proveedores={proveedores} onClose={() => { setSelectedLot(null); setSelectedMovs([]) }} />
      )}
    </div>
  )
}

// CSS var fallback helper (per evitar error de template string amb var())
function var_r_md_fallback() { return '10px' }
