import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const nav = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/tiendas', label: 'Tiendas', icon: '🏪' },
  { to: '/proveedores', label: 'Proveedors', icon: '🤝' },
  { to: '/productos', label: 'Productes', icon: '📦' },
  { to: '/stock', label: 'Estoc', icon: '📋' },
  { to: '/recuentos', label: 'Recomptes', icon: '🔢' },
  { to: '/liquidaciones', label: 'Liquidacions', icon: '💶' },
]

export default function Layout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220, background: 'white',
        borderRight: '0.5px solid rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column',
        padding: '1.5rem 0',
        position: 'fixed', top: 0, left: 0, bottom: 0,
      }}>
        <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: 18, color: '#1D9E75' }}>Típics</div>
          <div style={{ fontSize: 11, color: '#6b6b68' }}>Gestió interna</div>
        </div>
        <nav style={{ flex: 1 }}>
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 1.25rem',
                fontSize: 14,
                color: isActive ? '#1D9E75' : '#3a3a38',
                background: isActive ? '#E1F5EE' : 'transparent',
                borderRight: isActive ? '2px solid #1D9E75' : '2px solid transparent',
                fontWeight: isActive ? 500 : 400,
              })}
            >
              <span style={{ fontSize: 16 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '0 1.25rem' }}>
          <button onClick={handleLogout} className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', color: '#6b6b68' }}>
            Tancar sessió
          </button>
        </div>
      </aside>
      <main style={{ marginLeft: 220, flex: 1, padding: '2rem', maxWidth: 1100 }}>
        <Outlet />
      </main>
    </div>
  )
}
