import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function FluxModal({ lot, moviments, productos, proveedores, onClose }) {
  const prod = productos.find(p => p.id === lot.producto_id)
  const proveidor = proveedores.find(p => p.id === prod?.proveedor_id)
  const proveidorNom = proveidor?.nombre || lot.notes?.split(' · ')[0] || '—'

  // Agrupar moviments
  const enviaments = moviments.filter(m => m.tipus === 'enviament' && m.tienda_id)
  const particulars = moviments.filter(m => m.tipus === 'enviament' && !m.tienda_id)
  const mostres = moviments.filter(m => m.tipus === 'mostra')
  const merma = moviments.filter(m => m.tipus === 'merma')

  // Agrupar enviaments per botiga
  const byTienda = {}
  enviaments.forEach(m => {
    const nom = m.tiendas?.nombre || '?'
    byTienda[nom] = (byTienda[nom] || 0) + Number(m.quantitat)
  })

  const totalParticulars = particulars.reduce((s, m) => s + Number(m.quantitat), 0)
  const totalMostres = mostres.reduce((s, m) => s + Number(m.quantitat), 0)
  const totalMerma = merma.reduce((s, m) => s + Number(m.quantitat), 0)
  const magatzem = lot.unitats_magatzem || 0
  const total = lot.unitats_produides || lot.kg_inicials || 0

  const Row = ({ icon, label, val, color, bg }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: bg || 'var(--c-bg)', borderRadius: 6, marginBottom: 4 }}>
      <span style={{ color: color || 'var(--c-text)', fontSize: 13 }}>{icon} {label}</span>
      <span style={{ fontWeight: 600, color: color || 'var(--c-text)', fontSize: 13 }}>{val} ud</span>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{lot.numero_lot} · {prod?.sku || prod?.nombre}</h2>
            {lot.data_caducitat && <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>Caducitat: {lot.data_caducitat}</div>}
          </div>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Productor */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-block', background: 'var(--c-cream)', color: '#956C58', padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            {proveidorNom}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4 }}>
            {lot.kg_inicials ? `${lot.kg_inicials}kg rebuts → ${total} ud produïdes` : `${total} ud rebudes directament`}
          </div>
        </div>

        {/* Fletxa */}
        <div style={{ textAlign: 'center', fontSize: 18, color: 'var(--c-text-light)', margin: '0 0 0.75rem' }}>↓</div>

        {/* Magatzem Típics */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'inline-block', background: '#212322', color: '#E0C6AD', padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500 }}>
            Magatzem Típics
          </div>
        </div>

        {/* Fletxa */}
        <div style={{ textAlign: 'center', fontSize: 18, color: 'var(--c-text-light)', margin: '0 0 0.75rem' }}>↓</div>

        {/* Destins */}
        <div>
          {/* Botigues */}
          {Object.keys(byTienda).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Botigues</div>
              {Object.entries(byTienda).sort((a, b) => b[1] - a[1]).map(([nom, ud]) => (
                <Row key={nom} icon="🏪" label={nom} val={ud} />
              ))}
            </div>
          )}

          {/* Particulars / online */}
          {totalParticulars > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Particulars / online</div>
              {particulars.map(m => (
                <Row key={m.id} icon="👤" label={m.notes || 'Particular'} val={Number(m.quantitat)} />
              ))}
            </div>
          )}

          {/* Mostres */}
          {totalMostres > 0 && <Row icon="🎁" label="Mostres / regals" val={totalMostres} color="#7A4F1A" bg="#F0E8DC" />}

          {/* Merma */}
          {totalMerma > 0 && <Row icon="⚠️" label="Merma" val={totalMerma} color="#8B2A2A" bg="#F0E3E3" />}

          {/* Magatzem restant */}
          {magatzem > 0 && (
            <div style={{ marginTop: 8 }}>
              <Row icon="📦" label="Al magatzem (restant)" val={magatzem} color="#956C58" bg="var(--c-cream-light)" />
            </div>
          )}

          {/* Total */}
          <div style={{ borderTop: '1px solid var(--c-border)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--c-text-muted)' }}>
            <span>Total produït</span>
            <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{total} {lot.unitats_produides ? 'ud' : 'kg'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Tracabilitat() {
  const [lots, setLots] = useState([])
  const [productos, setProductos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLot, setSelectedLot] = useState(null)
  const [selectedMoviments, setSelectedMoviments] = useState([])
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
      .from('moviments')
      .select('*, tiendas(nombre)')
      .eq('lot_id', lot.id)
      .order('created_at', { ascending: true })
    setSelectedMoviments(data || [])
  }

  const filtered = lots.filter(l => !filterProd || l.producto_id === filterProd)
  const grouped = productos
    .map(p => ({ prod: p, lots: filtered.filter(l => l.producto_id === p.id) }))
    .filter(g => g.lots.length > 0)

  const ESTAT_COLORS = { actiu: '#2A5A3A', esgotat: '#6b6b68', retirat: '#8B2A2A', caducat: '#8B2A2A' }

  if (loading) return <div style={{ color: 'var(--c-text-muted)' }}>Carregant...</div>

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 300, letterSpacing: '0.06em' }}>Traçabilitat</h1>
        <div style={{ width: 28, height: 2, background: '#956C58', marginTop: 6 }} />
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <select value={filterProd} onChange={e => setFilterProd(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--c-border-strong)', borderRadius: 6, background: 'white', fontSize: 13 }}>
          <option value="">Tots els productes</option>
          {productos.map(p => <option key={p.id} value={p.id}>{p.sku || p.nombre}</option>)}
        </select>
        <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--c-text-muted)' }}>Clica un lot per veure el flux</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {grouped.map(({ prod, lots: prodLots }) => (
          <div key={prod.id}>
            {/* Capçalera SKU */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--c-border)' }}>
              <span style={{ background: 'var(--c-cream)', color: '#956C58', borderRadius: 5, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>
                {prod.sku || prod.nombre}
              </span>
              <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{prod.nombre}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {prodLots.map(lot => {
                const proveidor = proveedores.find(p => p.id === prod.proveedor_id)
                const proveidorNom = proveidor?.nombre || lot.notes?.split(' · ')[0] || '—'
                const total = lot.unitats_produides || lot.kg_inicials || 0
                const mag = lot.unitats_magatzem || 0
                const bot = lot.unitats_botigues || 0

                return (
                  <div key={lot.id} onClick={() => openLot(lot)} style={{
                    background: 'white', border: '1px solid var(--c-border)', borderRadius: 8,
                    padding: '0.85rem 1rem', cursor: 'pointer',
                    transition: 'border-color 0.12s, box-shadow 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#956C58'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{lot.numero_lot}</span>
                        <span style={{ fontSize: 11, color: '#956C58' }}>de {proveidorNom}</span>
                        {lot.data_caducitat && (
                          <span style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>· cad {lot.data_caducitat}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--c-text-muted)' }}>
                        {mag > 0 && <span>📦 {mag} mag</span>}
                        {bot > 0 && <span>🏪 {bot} bot</span>}
                        <span style={{ color: ESTAT_COLORS[lot.estat] || '#ccc', fontSize: 10, fontWeight: 500 }}>●</span>
                        <span style={{ fontSize: 11, color: 'var(--c-text-light)' }}>→ veure flux</span>
                      </div>
                    </div>
                    {lot.notes && (
                      <div style={{ fontSize: 10, color: 'var(--c-text-light)', marginTop: 4 }}>{lot.notes}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal flux */}
      {selectedLot && (
        <FluxModal
          lot={selectedLot}
          moviments={selectedMoviments}
          productos={productos}
          proveedores={proveedores}
          onClose={() => { setSelectedLot(null); setSelectedMoviments([]) }}
        />
      )}
    </div>
  )
}
