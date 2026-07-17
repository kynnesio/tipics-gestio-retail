import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const nav = [
  { to: '/', label: 'Operacions', icon: '◉', end: true },
  { to: '/lots', label: 'Lots', icon: '◈' },
  { to: '/tracabilitat', label: 'Traçabilitat', icon: '◎' },
  { to: '/tiendas', label: 'Botigues', icon: '◫' },
  { to: '/proveedores', label: 'Proveïdors', icon: '◧' },
  { to: '/productos', label: 'Productes', icon: '◱' },
  { to: '/dashboard', label: 'Dashboard', icon: '◰' },
]

export default function Layout() {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login') }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <style>{`
        @media (max-width: 640px) {
          .sidebar { transform: translateX(-230px); transition: transform 0.25s; }
          .sidebar.open { transform: translateX(0); }
          .main-content { margin-left: 0 !important; }
          .mobile-header { display: flex !important; }
        }
        @media (min-width: 641px) {
          .sidebar { transform: none !important; }
          .mobile-header { display: none !important; }
          .mobile-overlay { display: none !important; }
        }
      `}</style>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 98 }} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} style={{
        width: 230, background: '#212322',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 99,
      }}>
        <div style={{ padding: '1.75rem 1.5rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 300, fontSize: 22, color: '#E0C6AD', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Típics
          </div>
          <div style={{ fontSize: 10, color: 'rgba(224,198,173,0.4)', marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Gestió interna</div>
        </div>
        <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
          {nav.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end}
              onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 1.5rem', fontSize: 13,
                color: isActive ? '#E0C6AD' : 'rgba(224,198,173,0.5)',
                background: isActive ? 'rgba(224,198,173,0.07)' : 'transparent',
                borderLeft: isActive ? '2px solid #956C58' : '2px solid transparent',
                fontWeight: isActive ? 500 : 400,
                transition: 'all 0.12s', letterSpacing: '0.01em',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '7px 0', background: 'transparent',
            border: '1px solid rgba(224,198,173,0.18)', borderRadius: 6,
            color: 'rgba(224,198,173,0.45)', fontSize: 12, cursor: 'pointer',
            fontFamily: 'Inter Tight, sans-serif', letterSpacing: '0.04em',
          }}>
            Tancar sessió
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="mobile-header" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 97,
        background: '#212322', padding: '12px 16px',
        alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{ color: '#E0C6AD', fontWeight: 300, fontSize: 18, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Típics</span>
        <button onClick={() => setMobileOpen(o => !o)} style={{ background: 'transparent', border: 'none', color: '#E0C6AD', fontSize: 20, cursor: 'pointer', padding: 4 }}>
          ☰
        </button>
      </div>

      <main className="main-content" style={{ marginLeft: 230, flex: 1, padding: '2rem 2.5rem', maxWidth: 1300, minHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  )
}
