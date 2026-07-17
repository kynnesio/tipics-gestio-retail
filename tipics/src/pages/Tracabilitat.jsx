import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Tracabilitat() {
  const [lots, setLots] = useState([])
  const [productos, setProductos] = useState([])
  const [tiendas, setTiendas] = useState([])
  const [moviments, setMoviments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterProd, setFilterProd] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: p }, { data: t }, { data: m }] = await Promise.all([
        supabase.from('lots').select('*').order('data_caducitat', { ascending: true }),
        supabase.from('productos').select('id, nombre, sku').order('sku'),
        supabase.from('tiendas').select('id, nombre').order('nombre'),
        supabase.from('moviments').select('*, tiendas(nombre), productos(nombre, sku)').order('data', { ascending: false }),
      ])
      setLots(l || [])
      setProductos(p || [])
      setTiendas(t || [])
      setMoviments(m || [])
      setLoading(false)
    }
    load()
  }, [])

  const activeLots = lots.filter(l => l.estat === 'actiu' || l.estat === 'esgotat')
  const filtered = activeLots.filter(l => !filterProd || l.producto_id === filterProd)

  // Per lot: agrupem els enviaments per botiga
  function enviamentsPerBotiga(lotId) {
    const env = moviments.filter(m => m.lot_id === lotId && m.tipus === 'enviament')
    const vendes = moviments.filter(m => m.lot_id === lotId && m.tipus === 'venda')
    const byTienda = {}
    env.forEach(m => {
      const nom = m.tiendas?.nombre || '?'
      if (!byTienda[nom]) byTienda[nom] = { enviats: 0, venuts: 0 }
      byTienda[nom].enviats += Number(m.quantitat || 0)
    })
    vendes.forEach(m => {
      const nom = m.tiendas?.nombre || '?'
      if (!byTienda[nom]) byTienda[nom] = { enviats: 0, venuts: 0 }
      byTienda[nom].venuts += Number(m.quantitat || 0)
    })
    return byTienda
  }

  // Vendes totals
  const totalVendes = moviments.filter(m => m.tipus === 'venda').reduce((s, m) => s + (m.total || 0), 0)
  const totalUnitats = moviments.filter(m => m.tipus === 'venda').reduce((s, m) => s + Number(m.quantitat || 0), 0)
  const totalMostres = moviments.filter(m => m.tipus === 'mostra').reduce((s, m) => s + Number(m.quantitat || 0), 0)

  const tipusIcon = { entrada_kg: '📦', conversio_ud: '⚖️', enviament: '🚚', venda: '💰', mostra: '🎁', merma: '⚠️', devolucio: '↩️' }
  const tipusColor = { entrada_kg: '#956C58', conversio_ud: '#6B4F3A', enviament: '#212322', venda: '#2A5A3A', mostra: '#7A4F1A', merma: '#8B2A2A', devolucio: '#4A3F8F' }

  if (loading) return <div style={{ color: 'var(--c-text-muted)' }}>Carregant...</div>

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 300, letterSpacing: '0.06em' }}>Traçabilitat</h1>
        <div style={{ width: 28, height: 2, background: '#956C58', marginTop: 6 }} />
      </div>

      {/* Resum global */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '2rem' }}>
        {[
          { label: 'Lots actius', value: lots.filter(l => l.estat === 'actiu').length },
          { label: 'Ud. venudes', value: totalUnitats },
          { label: 'Ingressos totals', value: `${totalVendes.toFixed(2)}€` },
          { label: 'Mostres donades', value: totalMostres },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: 22, fontWeight: 300 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtre per producte */}
      <div style={{ marginBottom: '1.25rem' }}>
        <select value={filterProd} onChange={e => setFilterProd(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--c-border-strong)', borderRadius: 6, background: 'white', fontSize: 13 }}>
          <option value="">Tots els productes</option>
          {productos.map(p => <option key={p.id} value={p.id}>{p.sku || p.nombre}</option>)}
        </select>
      </div>

      {/* Mapa de traçabilitat per lot */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filtered.map(lot => {
          const prod = productos.find(p => p.id === lot.producto_id)
          const botiques = enviamentsPerBotiga(lot.id)
          const lotMovs = moviments.filter(m => m.lot_id === lot.id)
          const ingressosLot = lotMovs.filter(m => m.tipus === 'venda').reduce((s, m) => s + (m.total || 0), 0)
          const dies = lot.data_caducitat ? Math.ceil((new Date(lot.data_caducitat) - new Date()) / 86400000) : null
          const cadAlerta = dies !== null && dies <= 30

          return (
            <div key={lot.id} className="card" style={{ padding: '1.25rem', borderLeft: `3px solid ${cadAlerta ? '#8B2A2A' : '#956C58'}` }}>
              {/* Capçalera del lot */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{lot.numero_lot}</span>
                    <span style={{ background: 'var(--c-cream)', color: '#956C58', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{prod?.sku || prod?.nombre}</span>
                    {cadAlerta && <span style={{ background: '#F0E3E3', color: '#8B2A2A', borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 500 }}>⚠️ Caduca en {dies}d</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                    {lot.kg_inicials && `${lot.kg_inicials}kg inicials · `}{lot.unitats_produides || 0} ud produïdes · {lot.data_caducitat || 'Sense data de caducitat'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#2A5A3A' }}>{ingressosLot.toFixed(2)}€</div>
                  <div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>ingressos lot</div>
                </div>
              </div>

              {/* Flux visual: Magatzem → Botigues → Venut */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: '1rem', background: 'var(--c-bg)', borderRadius: 8, padding: '0.75rem 1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Magatzem</div>
                  <div style={{ fontSize: 22, fontWeight: 300, color: '#956C58' }}>{lot.unitats_magatzem || 0}</div>
                  <div style={{ fontSize: 10, color: 'var(--c-text-light)' }}>ud disponibles</div>
                </div>
                <div style={{ fontSize: 16, color: 'var(--c-text-light)' }}>→</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Botigues</div>
                  <div style={{ fontSize: 22, fontWeight: 300, color: '#212322' }}>{lot.unitats_botigues || 0}</div>
                  <div style={{ fontSize: 10, color: 'var(--c-text-light)' }}>ud distribuïdes</div>
                </div>
                <div style={{ fontSize: 16, color: 'var(--c-text-light)' }}>→</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Venut</div>
                  <div style={{ fontSize: 22, fontWeight: 300, color: '#2A5A3A' }}>{lot.unitats_venudes || 0}</div>
                  <div style={{ fontSize: 10, color: 'var(--c-text-light)' }}>ud venudes</div>
                </div>
              </div>

              {/* On és el lot: botigues */}
              {Object.keys(botiques).length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Distribució per botiga</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(botiques).map(([nom, data]) => (
                      <div key={nom} style={{ background: 'white', border: '1px solid var(--c-border)', borderRadius: 6, padding: '4px 10px', fontSize: 11 }}>
                        <span style={{ fontWeight: 500 }}>{nom}</span>
                        <span style={{ color: 'var(--c-text-muted)', marginLeft: 6 }}>{data.enviats} env. · {data.venuts} ven.</span>
                        {data.enviats - data.venuts > 0 && <span style={{ color: '#212322', fontWeight: 500, marginLeft: 4 }}>({data.enviats - data.venuts} pend.)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extras: mostres i merma */}
              {((lot.unitats_mostres || 0) > 0 || (lot.unitats_merma || 0) > 0) && (
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--c-text-muted)' }}>
                  {(lot.unitats_mostres || 0) > 0 && <span>🎁 {lot.unitats_mostres} mostres/regals</span>}
                  {(lot.unitats_merma || 0) > 0 && <span style={{ color: '#8B2A2A' }}>⚠️ {lot.unitats_merma} ud merma</span>}
                  {(lot.kg_restants || 0) > 0 && <span style={{ color: '#956C58' }}>⚖️ {lot.kg_restants}kg sense convertir</span>}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--c-text-muted)', fontSize: 13 }}>
            Sense lots. Comença registrant una Entrada de lot des d'Operacions.
          </div>
        )}
      </div>
    </div>
  )
}
