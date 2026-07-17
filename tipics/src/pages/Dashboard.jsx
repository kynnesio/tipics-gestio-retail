import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function BarraEstocSKU({ sku, nom, total, restant }) {
  if (total === 0) return null
  const pct = Math.min(100, (restant / total) * 100)
  const color = pct > 50 ? '#956C58' : pct > 20 ? '#7A4F1A' : '#8B2A2A'
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'var(--c-cream)', color: '#956C58', borderRadius: 4, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{sku}</span>
          <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{nom}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color }}>
          {restant} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--c-text-muted)' }}>de {total} ud</span>
        </div>
      </div>
      <div style={{ background: 'var(--c-cream)', borderRadius: 6, height: 12, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: 6, transition: 'width 0.5s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
        }}>
          {pct > 15 && <span style={{ fontSize: 9, color: 'white', fontWeight: 600 }}>{pct.toFixed(0)}%</span>}
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--c-text-light)', marginTop: 3 }}>
        {total - restant} ud distribuïdes · {restant} ud al magatzem
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [skuStats, setSkuStats] = useState([])
  const [topBotigues, setTopBotigues] = useState([])
  const [resum, setResum] = useState({ lots_actius: 0, ud_magatzem: 0, ud_botigues: 0, ud_venudes: 0 })

  useEffect(() => {
    async function load() {
      const [{ data: lots }, { data: prods }, { data: movs }] = await Promise.all([
        supabase.from('lots').select('*'),
        supabase.from('productos').select('id, nombre, sku').order('sku'),
        supabase.from('moviments').select('*, tiendas(nombre)').eq('tipus', 'enviament'),
      ])

      const lotsData = lots || []
      const prodsData = prods || []
      const movsData = movs || []
      const actius = lotsData.filter(l => l.estat === 'actiu')

      // Stats per SKU: total produït vs restant al magatzem
      const skuMap = {}
      prodsData.forEach(p => {
        const prodLots = lotsData.filter(l => l.producto_id === p.id)
        const totalProduides = prodLots.reduce((s, l) => s + (l.unitats_produides || 0), 0)
        const totalMagatzem = actius.filter(l => l.producto_id === p.id).reduce((s, l) => s + (l.unitats_magatzem || 0), 0)
        if (totalProduides > 0) {
          skuMap[p.sku || p.nombre] = { nom: p.nombre, total: totalProduides, restant: totalMagatzem }
        }
      })
      setSkuStats(Object.entries(skuMap))

      // Resum global
      setResum({
        lots_actius: actius.length,
        ud_magatzem: actius.reduce((s, l) => s + (l.unitats_magatzem || 0), 0),
        ud_botigues: actius.reduce((s, l) => s + (l.unitats_botigues || 0), 0),
        ud_venudes: lotsData.reduce((s, l) => s + (l.unitats_venudes || 0), 0),
      })

      // Top botigues per unitats rebudes (enviaments)
      const byTienda = {}
      movsData.forEach(m => {
        if (!m.tienda_id) return
        const nom = m.tiendas?.nombre || '?'
        byTienda[nom] = (byTienda[nom] || 0) + Number(m.quantitat)
      })
      const sorted = Object.entries(byTienda).sort((a, b) => b[1] - a[1]).slice(0, 8)
      setTopBotigues(sorted)

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ color: 'var(--c-text-muted)' }}>Carregant...</div>
  const topVal = topBotigues[0]?.[1] || 1

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 24, fontWeight: 300, letterSpacing: '0.06em' }}>Dashboard</h1>
        <div style={{ width: 32, height: 2, background: '#956C58', marginTop: 8 }} />
      </div>

      {/* Mètriques globals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '2rem' }}>
        {[
          { label: 'Lots actius',    value: resum.lots_actius },
          { label: 'Al magatzem',    value: `${resum.ud_magatzem} ud` },
          { label: 'A botigues',     value: `${resum.ud_botigues} ud` },
          { label: 'Total distribuït', value: `${resum.ud_venudes + resum.ud_botigues} ud` },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid var(--c-border)', borderRadius: 8, padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: 10, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 300 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Estoc per SKU */}
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem' }}>
            Estoc al magatzem per SKU
          </div>
          {skuStats.length === 0 ? (
            <p style={{ color: 'var(--c-text-light)', fontSize: 13 }}>Sense lots registrats.</p>
          ) : skuStats.map(([sku, d]) => (
            <BarraEstocSKU key={sku} sku={sku} nom={d.nom} total={d.total} restant={d.restant} />
          ))}
        </div>

        {/* Top botigues per unitats rebudes */}
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem' }}>
            Botigues — unitats rebudes
          </div>
          {topBotigues.length === 0 ? (
            <p style={{ color: 'var(--c-text-light)', fontSize: 13 }}>Sense enviaments registrats.</p>
          ) : topBotigues.map(([nom, ud], i) => (
            <div key={nom} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? '#956C58' : 'var(--c-cream)', border: '1px solid #956C58', display: 'inline-block' }} />
                  {nom}
                </span>
                <span style={{ fontWeight: 500 }}>{ud} ud</span>
              </div>
              <div style={{ background: 'var(--c-cream)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(ud / topVal) * 100}%`, background: i === 0 ? '#956C58' : '#E0C6AD', height: '100%', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
