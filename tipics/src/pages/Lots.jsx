import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DIES_ALERTA = 75

function Toggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: !value ? 'var(--c-text)' : 'var(--c-text-muted)', fontWeight: !value ? 600 : 400 }}>Actius</span>
      <div onClick={() => onChange(!value)} style={{
        width: 40, height: 22, borderRadius: 11,
        background: value ? '#956C58' : '#E0C6AD',
        cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
        flexShrink: 0,
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 3, left: value ? 21 : 3,
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }} />
      </div>
      <span style={{ fontSize: 12, color: value ? 'var(--c-text)' : 'var(--c-text-muted)', fontWeight: value ? 600 : 400 }}>Tots</span>
    </div>
  )
}

function DiesLabel({ data }) {
  if (!data) return null
  const dies = Math.ceil((new Date(data) - new Date()) / 86400000)
  const color = dies < 0 ? '#8B2A2A' : dies <= 15 ? '#8B2A2A' : dies <= DIES_ALERTA ? '#7A4F1A' : '#2A5A3A'
  const bg    = dies < 0 ? '#F0E3E3' : dies <= 15 ? '#F0E3E3' : dies <= DIES_ALERTA ? '#F0E8DC' : '#E3EFE7'
  return (
    <span style={{ background: bg, color, fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
      {dies < 0 ? `Caducat fa ${Math.abs(dies)}d` : dies === 0 ? 'Caduca avui!' : `${dies}d`}
    </span>
  )
}

function BarraDistribucio({ lot }) {
  const total = lot.unitats_produides || 0

  // Lot only in kg (not yet converted)
  if (total === 0 && lot.kg_inicials) {
    const kgIni = lot.kg_inicials || 1
    const pct = Math.min(100, ((kgIni - (lot.kg_restants || 0)) / kgIni) * 100)
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-text-muted)', marginBottom: 4 }}>
          <span>Pendent conversió</span>
          <span>{lot.kg_restants || 0}kg restants de {lot.kg_inicials}kg</span>
        </div>
        <div style={{ background: 'var(--c-cream)', borderRadius: 4, height: 8 }}>
          <div style={{ width: `${pct}%`, background: '#956C58', height: '100%', borderRadius: 4 }} />
        </div>
      </div>
    )
  }
  if (total === 0) return null

  const mag = lot.unitats_magatzem || 0
  // venut i botigues és el mateix — s'ajunten
  const distrib = (lot.unitats_botigues || 0) + (lot.unitats_venudes || 0)
  const mos = lot.unitats_mostres || 0
  const mer = lot.unitats_merma   || 0
  const sortida = total - mag
  const pct = Math.min(100, (sortida / total) * 100)

  const segments = [
    { val: distrib, color: '#956C58', label: 'Distribuït' },
    { val: mos,     color: '#7A4F1A', label: 'Mostres' },
    { val: mer,     color: '#8B2A2A', label: 'Merma' },
  ].filter(s => s.val > 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-text-muted)', marginBottom: 4 }}>
        <span style={{ fontWeight: mag > 0 ? 600 : 400, color: mag > 0 ? 'var(--c-text)' : 'var(--c-text-light)' }}>
          {mag > 0 ? `${mag} ud al magatzem` : 'Sense estoc al magatzem'}
        </span>
        <span>{pct.toFixed(0)}% distribuït</span>
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--c-cream)' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${(s.val / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.val} ud`} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
        {segments.map(s => (
          <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--c-text-muted)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 1, background: s.color, display: 'inline-block' }} />
            {s.label} {s.val}
          </span>
        ))}
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

  const load = async () => {
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from('lots').select('*').order('created_at', { ascending: false }),
      supabase.from('productos').select('id, nombre, sku').order('sku'),
    ])
    setLots(l || [])
    setProductos(p || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggleLot = async (lot) => {
    if (expanded === lot.id) { setExpanded(null); setMoviments([]); return }
    setExpanded(lot.id)
    const { data } = await supabase.from('moviments').select('*, tiendas(nombre)')
      .eq('lot_id', lot.id).order('created_at', { ascending: true })
    setMoviments(data || [])
  }

  const handleRetira = async (lotId, e) => {
    e.stopPropagation()
    if (!confirm('Marcar com a retirat?')) return
    await supabase.from('lots').update({ estat: 'retirat' }).eq('id', lotId)
    load()
  }

  const lotsFiltered = mostrarTots ? lots : lots.filter(l => l.estat === 'actiu')
  const grouped = productos
    .map(p => ({ prod: p, lots: lotsFiltered.filter(l => l.producto_id === p.id) }))
    .filter(g => g.lots.length > 0)

  const ESTAT_BADGE = { actiu: 'badge-green', esgotat: 'badge-gray', retirat: 'badge-red', caducat: 'badge-red' }
  const tipusLabel = { entrada_kg: '📦 Entrada kg', entrada_ud: '📦 Entrada ud', conversio_ud: '⚖️ Conversió', enviament: '🚚 Botiga', venda: '🏪 Botiga', mostra: '🎁 Mostra', merma: '⚠️ Merma', devolucio: '↩️ Devolució' }
  const tipusColor = { entrada_kg: '#956C58', entrada_ud: '#956C58', conversio_ud: '#6B4F3A', enviament: '#212322', venda: '#212322', mostra: '#7A4F1A', merma: '#8B2A2A', devolucio: '#4A3F8F' }

  const alertes = lots.filter(l => l.estat === 'actiu' && l.data_caducitat && Math.ceil((new Date(l.data_caducitat) - new Date()) / 86400000) <= DIES_ALERTA)

  if (loading) return <div style={{ color: 'var(--c-text-muted)' }}>Carregant...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, letterSpacing: '0.06em' }}>Lots</h1>
          <div style={{ width: 28, height: 2, background: '#956C58', marginTop: 6 }} />
        </div>
        <Toggle value={mostrarTots} onChange={setMostrarTots} />
      </div>

      {alertes.length > 0 && (
        <div style={{ background: '#F0E3E3', border: '1px solid rgba(139,42,42,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: '1.25rem', fontSize: 13, color: '#8B2A2A' }}>
          ⚠️ <strong>{alertes.length} lot{alertes.length > 1 ? 's' : ''}</strong> caduca{alertes.length > 1 ? 'n' : ''} en menys de {DIES_ALERTA} dies:
          {alertes.map(l => {
            const p = productos.find(p => p.id === l.producto_id)
            return ` ${l.numero_lot} (${p?.sku || p?.nombre})`
          }).join(' ·')}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {grouped.map(({ prod, lots: prodLots }) => (
          <div key={prod.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--c-border)' }}>
              <span style={{ background: 'var(--c-cream)', color: '#956C58', borderRadius: 5, padding: '3px 12px', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
                {prod.sku || prod.nombre}
              </span>
              <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{prod.nombre}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--c-text-light)' }}>
                {prodLots.filter(l => l.estat === 'actiu').length} actius · {prodLots.length} mostrats
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {prodLots.map(lot => (
                <div key={lot.id}>
                  <div onClick={() => toggleLot(lot)} style={{
                    background: 'white',
                    border: `1px solid ${expanded === lot.id ? '#956C58' : 'var(--c-border)'}`,
                    borderRadius: expanded === lot.id ? '8px 8px 0 0' : 8,
                    padding: '0.9rem 1rem', cursor: 'pointer', transition: 'border-color 0.12s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{lot.numero_lot}</span>
                        <span className={`badge ${ESTAT_BADGE[lot.estat] || 'badge-gray'}`}>{lot.estat}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DiesLabel data={lot.data_caducitat} />
                        {lot.estat === 'actiu' && (
                          <button className="btn btn-sm btn-danger" onClick={e => handleRetira(lot.id, e)} style={{ fontSize: 10, padding: '2px 8px' }}>Retirar</button>
                        )}
                        <span style={{ color: 'var(--c-text-light)', fontSize: 11 }}>{expanded === lot.id ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    <BarraDistribucio lot={lot} />
                    {lot.notes && <div style={{ fontSize: 10, color: 'var(--c-text-light)', marginTop: 6 }}>{lot.notes}</div>}
                  </div>

                  {expanded === lot.id && (
                    <div style={{ background: 'var(--c-bg)', border: '1px solid #956C58', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '0.75rem 1rem' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Historial</div>
                      {moviments.length === 0 ? (
                        <div style={{ color: 'var(--c-text-light)', fontSize: 12 }}>Sense moviments registrats.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {moviments.map(m => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                              <div style={{ width: 7, height: 7, borderRadius: '50%', background: tipusColor[m.tipus] || '#ccc', flexShrink: 0 }} />
                              <span style={{ color: tipusColor[m.tipus], fontWeight: 500, minWidth: 110 }}>{tipusLabel[m.tipus] || m.tipus}</span>
                              <span style={{ fontWeight: 600 }}>{m.quantitat} {m.unitat}</span>
                              {m.tiendas?.nombre ? (
                                <span style={{ color: 'var(--c-text-muted)' }}>→ {m.tiendas.nombre}</span>
                              ) : m.notes ? (
                                <span style={{ color: 'var(--c-text-light)', fontStyle: 'italic' }}>{m.notes}</span>
                              ) : null}
                              <span style={{ marginLeft: 'auto', color: 'var(--c-text-light)', fontSize: 10 }}>{m.data}</span>
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
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--c-text-muted)', fontSize: 13 }}>
            {mostrarTots ? 'Sense lots registrats.' : 'Sense lots actius. Activa el toggle per veure tots els lots.'}
          </div>
        )}
      </div>
    </div>
  )
}
