import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ESTAT_BADGE = { actiu: 'badge-green', esgotat: 'badge-gray', retirat: 'badge-red', caducat: 'badge-red' }

function DiesLabel({ data }) {
  if (!data) return <span style={{ color: 'var(--c-text-light)', fontSize: 11 }}>Sense data</span>
  const dies = Math.ceil((new Date(data) - new Date()) / 86400000)
  const color = dies < 0 ? '#8B2A2A' : dies <= 15 ? '#8B2A2A' : dies <= 30 ? '#7A4F1A' : '#2A5A3A'
  const bg = dies < 0 ? '#F0E3E3' : dies <= 15 ? '#F0E3E3' : dies <= 30 ? '#F0E8DC' : '#E3EFE7'
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10 }}>
      {dies < 0 ? `Caducat fa ${Math.abs(dies)}d` : dies === 0 ? 'Caduca avui!' : `${dies}d`}
    </span>
  )
}

function BarraEstoc({ lot }) {
  const total = (lot.unitats_produides || 0) || 1
  const mag = lot.unitats_magatzem || 0
  const bot = lot.unitats_botigues || 0
  const ven = lot.unitats_venudes || 0
  const mos = lot.unitats_mostres || 0
  const mer = lot.unitats_merma || 0

  const pct = (v) => Math.min(100, (v / total) * 100).toFixed(1)

  const segments = [
    { val: mag, color: '#956C58', label: 'Magatzem' },
    { val: bot, color: '#212322', label: 'Botigues' },
    { val: ven, color: '#2A5A3A', label: 'Venut' },
    { val: mos, color: '#7A4F1A', label: 'Mostres' },
    { val: mer, color: '#8B2A2A', label: 'Merma' },
  ].filter(s => s.val > 0)

  return (
    <div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--c-cream-light)', marginBottom: 6 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${pct(s.val)}%`, background: s.color, transition: 'width 0.3s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--c-text-muted)' }}>
            <div style={{ width: 6, height: 6, borderRadius: 1, background: s.color }} />
            {s.label}: <strong style={{ color: 'var(--c-text)' }}>{s.val}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Lots() {
  const [lots, setLots] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterEstat, setFilterEstat] = useState('actiu')
  const [filterProd, setFilterProd] = useState('')
  const [selectedLot, setSelectedLot] = useState(null)
  const [moviments, setMoviments] = useState([])
  const [tiendas, setTiendas] = useState([])

  const load = async () => {
    const [{ data: l }, { data: p }, { data: t }] = await Promise.all([
      supabase.from('lots').select('*').order('created_at', { ascending: false }),
      supabase.from('productos').select('id, nombre, sku').order('sku'),
      supabase.from('tiendas').select('id, nombre'),
    ])
    setLots(l || [])
    setProductos(p || [])
    setTiendas(t || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const loadMoviments = async (lotId) => {
    const { data } = await supabase.from('moviments').select('*, tiendas(nombre)').eq('lot_id', lotId).order('created_at', { ascending: false })
    setMoviments(data || [])
  }

  const selectLot = (lot) => {
    if (selectedLot?.id === lot.id) { setSelectedLot(null); setMoviments([]); return }
    setSelectedLot(lot)
    loadMoviments(lot.id)
  }

  const handleRetira = async (lotId) => {
    if (!confirm('Marcar com a retirat?')) return
    await supabase.from('lots').update({ estat: 'retirat' }).eq('id', lotId)
    load()
  }

  const filtered = lots
    .filter(l => !filterEstat || l.estat === filterEstat)
    .filter(l => !filterProd || l.producto_id === filterProd)

  const alertes = lots.filter(l => l.estat === 'actiu' && l.data_caducitat && Math.ceil((new Date(l.data_caducitat) - new Date()) / 86400000) <= 30)

  const tipusLabel = { entrada_kg: 'Entrada kg', conversio_ud: 'Conversió', enviament: 'Enviament', venda: 'Venda', mostra: 'Mostra', merma: 'Merma', devolucio: 'Devolució' }
  const tipusColor = { entrada_kg: '#956C58', conversio_ud: '#6B4F3A', enviament: '#212322', venda: '#2A5A3A', mostra: '#7A4F1A', merma: '#8B2A2A', devolucio: '#4A3F8F' }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 300, letterSpacing: '0.06em' }}>Lots</h1>
        <div style={{ width: 28, height: 2, background: '#956C58', marginTop: 6 }} />
      </div>

      {/* Alertes caducitat */}
      {alertes.length > 0 && (
        <div style={{ background: '#F0E3E3', border: '1px solid rgba(139,42,42,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: '1.25rem', fontSize: 13, color: '#8B2A2A' }}>
          ⚠️ <strong>{alertes.length} lot{alertes.length > 1 ? 's' : ''}</strong> caduca{alertes.length > 1 ? 'n' : ''} en menys de 30 dies:
          {alertes.map(l => {
            const prod = productos.find(p => p.id === l.producto_id)
            return ` ${l.numero_lot} (${prod?.sku || prod?.nombre})`
          }).join(' ·')}
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <select value={filterEstat} onChange={e => setFilterEstat(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--c-border-strong)', borderRadius: 6, background: 'white', fontSize: 13 }}>
          <option value="">Tots els estats</option>
          <option value="actiu">Actiu</option>
          <option value="esgotat">Esgotat</option>
          <option value="retirat">Retirat</option>
          <option value="caducat">Caducat</option>
        </select>
        <select value={filterProd} onChange={e => setFilterProd(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--c-border-strong)', borderRadius: 6, background: 'white', fontSize: 13 }}>
          <option value="">Tots els productes</option>
          {productos.map(p => <option key={p.id} value={p.id}>{p.sku || p.nombre}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--c-text-muted)', alignSelf: 'center' }}>{filtered.length} lots</span>
      </div>

      {loading ? <div style={{ color: 'var(--c-text-muted)' }}>Carregant...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 && <div style={{ color: 'var(--c-text-muted)', fontSize: 13, padding: '2rem 0', textAlign: 'center' }}>Sense lots. Afegeix el primer des d'Operacions → Entrada de lot.</div>}
          {filtered.map(lot => {
            const prod = productos.find(p => p.id === lot.producto_id)
            const isSelected = selectedLot?.id === lot.id
            return (
              <div key={lot.id}>
                <div onClick={() => selectLot(lot)} style={{
                  background: 'white', border: `1px solid ${isSelected ? '#956C58' : 'var(--c-border)'}`,
                  borderRadius: 8, padding: '1rem', cursor: 'pointer',
                  transition: 'border-color 0.12s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>{lot.numero_lot}</span>
                        <span style={{ fontSize: 12, color: '#956C58', fontWeight: 500 }}>{prod?.sku || prod?.nombre || '?'}</span>
                        <span className={`badge ${ESTAT_BADGE[lot.estat] || 'badge-gray'}`}>{lot.estat}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                        {lot.kg_inicials && <span>{lot.kg_inicials}kg inicials · {lot.kg_restants}kg restants · </span>}
                        {lot.unitats_produides || 0} ud produïdes
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DiesLabel data={lot.data_caducitat} />
                      {lot.estat === 'actiu' && (
                        <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); handleRetira(lot.id) }} style={{ fontSize: 10 }}>Retirar</button>
                      )}
                    </div>
                  </div>
                  <BarraEstoc lot={lot} />
                </div>

                {/* Moviments del lot */}
                {isSelected && (
                  <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '1rem' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                      Historial de moviments
                    </div>
                    {moviments.length === 0 ? (
                      <div style={{ color: 'var(--c-text-light)', fontSize: 12 }}>Sense moviments.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {moviments.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: tipusColor[m.tipus] || '#ccc', flexShrink: 0 }} />
                            <span style={{ color: tipusColor[m.tipus], fontWeight: 500, minWidth: 80 }}>{tipusLabel[m.tipus]}</span>
                            <span style={{ fontWeight: 600 }}>{m.quantitat} {m.unitat}</span>
                            {m.tiendas?.nombre && <span style={{ color: 'var(--c-text-muted)' }}>→ {m.tiendas.nombre}</span>}
                            {m.total > 0 && <span style={{ color: '#2A5A3A', fontWeight: 500 }}>{m.total.toFixed(2)}€</span>}
                            {m.motiu_merma && <span style={{ color: '#8B2A2A' }}>({m.motiu_merma})</span>}
                            <span style={{ color: 'var(--c-text-light)', marginLeft: 'auto' }}>{m.data}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
