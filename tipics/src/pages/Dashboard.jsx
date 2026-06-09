import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function Dashboard() {
  const [stats, setStats] = useState({ tiendas: 0, productos: 0, proveedores: 0 })
  const [topProductos, setTopProductos] = useState([])
  const [topTiendas, setTopTiendas] = useState([])
  const [tiendas, setTiendas] = useState([])
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const [t, p, pr, rec, tiendasData] = await Promise.all([
        supabase.from('tiendas').select('id', { count: 'exact', head: true }).eq('activa', true),
        supabase.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
        supabase.from('proveedores').select('id', { count: 'exact', head: true }),
        supabase.from('recuentos').select('unidades_vendidas, producto_id, tienda_id, productos(nombre, pvp), tiendas(nombre)'),
        supabase.from('tiendas').select('id, nombre, direccion, zona, lat, lng, activa').eq('activa', true),
      ])
      setStats({ tiendas: t.count || 0, productos: p.count || 0, proveedores: pr.count || 0 })
      setTiendas(tiendasData.data || [])
      if (rec.data) {
        const byProd = {}
        rec.data.forEach(r => {
          const k = r.producto_id
          if (!byProd[k]) byProd[k] = { nombre: r.productos?.nombre || '?', ingressos: 0 }
          byProd[k].ingressos += Number(r.unidades_vendidas || 0) * Number(r.productos?.pvp || 0)
        })
        setTopProductos(Object.values(byProd).sort((a, b) => b.ingressos - a.ingressos).slice(0, 5))
        const byTienda = {}
        rec.data.forEach(r => {
          const k = r.tienda_id
          if (!byTienda[k]) byTienda[k] = { nombre: r.tiendas?.nombre || '?', ingressos: 0 }
          byTienda[k].ingressos += Number(r.unidades_vendidas || 0) * Number(r.productos?.pvp || 0)
        })
        setTopTiendas(Object.values(byTienda).sort((a, b) => b.ingressos - a.ingressos).slice(0, 8))
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (loading || mapLoaded) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => setMapLoaded(true)
    document.head.appendChild(script)
  }, [loading])

  useEffect(() => {
    if (!mapLoaded) return
    const L = window.L
    if (!L) return
    const container = document.getElementById('mapa-tipics')
    if (!container || container._leaflet_id) return
    const map = L.map('mapa-tipics', { center: [41.7, 1.8], zoom: 8, scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map)
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:26px;height:26px;background:#956C58;border:2px solid #F7F2EC;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:11px;color:#F7F2EC;font-weight:700;font-family:Inter Tight,sans-serif;">T</div>`,
      iconSize: [26, 26], iconAnchor: [13, 13],
    })
    const ambCoords = tiendas.filter(t => t.lat && t.lng)
    ambCoords.forEach(t => {
      L.marker([t.lat, t.lng], { icon }).addTo(map)
        .bindPopup(`<strong style="font-family:Inter Tight,sans-serif">${t.nombre}</strong>${t.direccion ? '<br><span style="font-size:11px;color:#666">' + t.direccion + '</span>' : ''}`)
    })
    if (ambCoords.length > 1) map.fitBounds(L.latLngBounds(ambCoords.map(t => [t.lat, t.lng])), { padding: [30, 30] })
  }, [mapLoaded, tiendas])

  const senseCoords = tiendas.filter(t => !t.lat || !t.lng).length

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#212322', color: '#E0C6AD', padding: '8px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'Inter Tight, sans-serif' }}>
        {payload[0].payload.nombre}<br />
        <strong>{payload[0].value.toFixed(2)}€</strong>
      </div>
    )
  }

  if (loading) return <div style={{ color: 'var(--c-text-muted)', paddingTop: '2rem' }}>Carregant...</div>

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 24, fontWeight: 300, letterSpacing: '0.06em', color: 'var(--c-text)' }}>Dashboard</h1>
        <div style={{ width: 32, height: 2, background: '#956C58', marginTop: 8 }} />
      </div>

      {/* Mètriques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '2rem' }}>
        {[
          { label: 'Botigues actives', value: stats.tiendas },
          { label: 'Productes actius', value: stats.productos },
          { label: 'Proveïdors', value: stats.proveedores },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--c-white)', border: '1px solid var(--c-border)', borderRadius: 8, padding: '1.25rem 1.5rem' }}>
            <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 300, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Mapa */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--c-text-muted)' }}>Botigues a Catalunya</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-brown">{tiendas.filter(t => t.lat && t.lng).length} ubicades</span>
            {senseCoords > 0 && <span className="badge badge-amber">{senseCoords} sense coords</span>}
          </div>
        </div>
        <div id="mapa-tipics" style={{ height: 340, borderRadius: 6, overflow: 'hidden', background: 'var(--c-cream-light)' }} />
        {senseCoords > 0 && <div style={{ fontSize: 11, color: 'var(--c-text-light)', marginTop: 8 }}>Edita les botigues i clica "Ubicar" per afegir coordenades.</div>}
      </div>

      {/* Gràfics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--c-text-muted)', marginBottom: '1.25rem' }}>Ingressos per producte</div>
          {topProductos.length === 0 ? (
            <p style={{ color: 'var(--c-text-light)', fontSize: 13 }}>Sense recomptes registrats.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topProductos} barCategoryGap="35%">
                <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#7A6A5E', fontFamily: 'Inter Tight' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#7A6A5E', fontFamily: 'Inter Tight' }} tickFormatter={v => `${v.toFixed(0)}€`} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(149,108,88,0.06)' }} />
                <Bar dataKey="ingressos" radius={[3,3,0,0]}>
                  {topProductos.map((_, i) => <Cell key={i} fill={i === 0 ? '#956C58' : '#E0C6AD'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--c-text-muted)', marginBottom: '1.25rem' }}>Top botigues</div>
          {topTiendas.length === 0 ? (
            <p style={{ color: 'var(--c-text-light)', fontSize: 13 }}>Sense recomptes registrats.</p>
          ) : (
            <table>
              <thead><tr><th>Botiga</th><th style={{ textAlign: 'right' }}>Ingressos</th></tr></thead>
              <tbody>
                {topTiendas.map((t, i) => (
                  <tr key={t.nombre}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? '#956C58' : '#E0C6AD', flexShrink: 0 }} />
                      {t.nombre}
                    </td>
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
