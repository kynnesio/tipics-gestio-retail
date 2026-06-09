import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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
        const byProducto = {}
        rec.data.forEach(r => {
          const key = r.producto_id
          if (!byProducto[key]) byProducto[key] = { nombre: r.productos?.nombre || 'Desconegut', unitats: 0, ingressos: 0 }
          byProducto[key].unitats += Number(r.unidades_vendidas || 0)
          byProducto[key].ingressos += Number(r.unidades_vendidas || 0) * Number(r.productos?.pvp || 0)
        })
        setTopProductos(Object.values(byProducto).sort((a, b) => b.ingressos - a.ingressos).slice(0, 5))

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

  useEffect(() => {
    if (loading) return
    if (mapLoaded) return

    // Carrega Leaflet dinàmicament
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      setMapLoaded(true)
    }
    document.head.appendChild(script)
  }, [loading])

  useEffect(() => {
    if (!mapLoaded) return
    const L = window.L
    if (!L) return

    const container = document.getElementById('mapa-tipics')
    if (!container) return

    // Evita reinicialitzar si ja existeix
    if (container._leaflet_id) return

    const map = L.map('mapa-tipics', {
      center: [41.7, 1.8],
      zoom: 8,
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width: 28px; height: 28px;
        background: #1D9E75;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; color: white; font-weight: 700;
      ">T</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })

    const ambCoords = tiendas.filter(t => t.lat && t.lng)
    ambCoords.forEach(t => {
      L.marker([t.lat, t.lng], { icon })
        .addTo(map)
        .bindPopup(`<strong>${t.nombre}</strong>${t.direccion ? '<br>' + t.direccion : ''}${t.zona ? '<br><span style="color:#6b6b68;font-size:12px">' + t.zona + '</span>' : ''}`)
    })

    if (ambCoords.length > 1) {
      const bounds = L.latLngBounds(ambCoords.map(t => [t.lat, t.lng]))
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }, [mapLoaded, tiendas])

  const senseCoords = tiendas.filter(t => !t.lat || !t.lng).length

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

      {/* MAPA */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500 }}>Botigues a Catalunya</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge badge-green">{tiendas.filter(t => t.lat && t.lng).length} ubicades</span>
            {senseCoords > 0 && (
              <span className="badge badge-amber">{senseCoords} sense coordenades</span>
            )}
          </div>
        </div>
        <div
          id="mapa-tipics"
          style={{ height: 380, borderRadius: 8, overflow: 'hidden', background: '#f0f0f0' }}
        />
        {senseCoords > 0 && (
          <div style={{ fontSize: 12, color: '#6b6b68', marginTop: '0.5rem' }}>
            Ves a Botigues → Editar i clica "Ubicar" per afegir coordenades a les botigues que falten.
          </div>
        )}
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
