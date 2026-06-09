import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const [stats, setStats] = useState({ tiendas: 0, productos: 0, proveedores: 0 })
  const [topProductos, setTopProductos] = useState([])
  const [topTiendas, setTopTiendas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [t, p, pr, rec] = await Promise.all([
        supabase.from('tiendas').select('id', { count: 'exact', head: true }).eq('activa', true),
        supabase.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
        supabase.from('proveedores').select('id', { count: 'exact', head: true }),
        supabase.from('recuentos').select('unidades_vendidas, producto_id, tienda_id, productos(nombre, pvp), tiendas(nombre)'),
      ])
      setStats({ tiendas: t.count || 0, productos: p.count || 0, proveedores: pr.count || 0 })

      if (rec.data) {
        // Agrupar por producto
        const byProducto = {}
        rec.data.forEach(r => {
          const key = r.producto_id
          if (!byProducto[key]) byProducto[key] = { nombre: r.productos?.nombre || 'Desconegut', unitats: 0, ingressos: 0 }
          byProducto[key].unitats += Number(r.unidades_vendidas || 0)
          byProducto[key].ingressos += Number(r.unidades_vendidas || 0) * Number(r.productos?.pvp || 0)
        })
        setTopProductos(Object.values(byProducto).sort((a, b) => b.ingressos - a.ingressos).slice(0, 5))

        // Agrupar per tienda
        const byTienda = {}
        rec.data.forEach(r => {
          const key = r.tienda_id
          if (!byTienda[key]) byTienda[key] = { nombre: r.tiendas?.nombre || 'Desconeguda', ingressos: 0 }
          byTienda[key].ingressos += Number(r.unidades_vendidas || 0) * Number(r.productos?.pvp || 0)
        })
        setTopTiendas(Object.values(byTienda).sort((a, b) => b.ingressos - a.ingressos).slice(0, 8))
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ color: '#6b6b68' }}>Carregant...</div>

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: '1.5rem' }}>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '2rem' }}>
        {[
          { label: 'Botigues actives', value: stats.tiendas },
          { label: 'Productes actius', value: stats.productos },
          { label: 'Proveïdors', value: stats.proveedores },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 13, color: '#6b6b68', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 500 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: '1rem' }}>Ingressos per producte</h2>
          {topProductos.length === 0 ? (
            <p style={{ color: '#6b6b68', fontSize: 13 }}>Encara no hi ha recomptes registrats.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topProductos}>
                <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v.toFixed(0)}€`} />
                <Tooltip formatter={v => [`${v.toFixed(2)}€`, 'Ingressos']} />
                <Bar dataKey="ingressos" fill="#1D9E75" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: '1rem' }}>Top botigues</h2>
          {topTiendas.length === 0 ? (
            <p style={{ color: '#6b6b68', fontSize: 13 }}>Encara no hi ha recomptes registrats.</p>
          ) : (
            <table>
              <thead><tr><th>Botiga</th><th style={{ textAlign: 'right' }}>Ingressos</th></tr></thead>
              <tbody>
                {topTiendas.map(t => (
                  <tr key={t.nombre}>
                    <td>{t.nombre}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{t.ingressos.toFixed(2)}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
