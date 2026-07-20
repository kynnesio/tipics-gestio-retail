import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/',            label: 'Operacions',   end: true },
  { to: '/lots',        label: 'Lots' },
  { to: '/tracabilitat',label: 'Traçabilitat' },
  { to: '/tiendas',     label: 'Botigues' },
  { to: '/proveedores', label: 'Proveïdors' },
  { to: '/productos',   label: 'Productes' },
  { to: '/dashboard',   label: 'Dashboard' },
]

export default function Layout() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const logout = async () => { await supabase.auth.signOut(); navigate('/login') }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <style>{`
        .nav-link { display:flex; align-items:center; padding:8px 12px; margin:1px 8px; border-radius:10px; font-size:14px; color:rgba(224,198,173,0.55); transition:all 0.12s; cursor:pointer; font-weight:400; letter-spacing:0.01em; }
        .nav-link:hover { background:rgba(224,198,173,0.08); color:rgba(224,198,173,0.8); }
        .nav-link.active { background:rgba(149,108,88,0.25); color:#E8D8C8; font-weight:500; }
      `}</style>

      {open && <div className="mobile-overlay" onClick={() => setOpen(false)} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:98,backdropFilter:'blur(2px)' }} />}

      <aside className={`sidebar ${open ? 'open' : ''}`} style={{ width:220, background:'#1A1918', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:99 }}>
        {/* Logo */}
        <div style={{ padding:'1.75rem 1.5rem 1.25rem', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:20, fontWeight:300, color:'#E8D8C8', letterSpacing:'0.14em', textTransform:'uppercase' }}>Típics</div>
          <div style={{ fontSize:10, color:'rgba(224,198,173,0.3)', marginTop:2, letterSpacing:'0.1em', textTransform:'uppercase' }}>Gestió</div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'0.75rem 0', overflowY:'auto' }}>
          {NAV.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding:'1rem 1.25rem', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={logout} style={{ width:'100%', padding:'7px 0', background:'transparent', border:'1px solid rgba(224,198,173,0.12)', borderRadius:8, color:'rgba(224,198,173,0.35)', fontSize:12, cursor:'pointer', fontFamily:'Inter Tight, sans-serif', letterSpacing:'0.03em', transition:'all 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='rgba(224,198,173,0.25)'}
            onMouseLeave={e => e.currentTarget.style.borderColor='rgba(224,198,173,0.12)'}>
            Tancar sessió
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="mobile-header" style={{ display:'none', position:'fixed', top:0, left:0, right:0, zIndex:97, background:'#1A1918', padding:'12px 16px', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ color:'#E8D8C8', fontWeight:300, fontSize:17, letterSpacing:'0.12em', textTransform:'uppercase' }}>Típics</span>
        <button onClick={() => setOpen(o => !o)} style={{ background:'transparent', border:'none', color:'rgba(224,198,173,0.6)', fontSize:18, cursor:'pointer', padding:'4px 6px', lineHeight:1 }}>☰</button>
      </div>

      <main className="main-content" style={{ marginLeft:220, flex:1, padding:'2rem 2.5rem', maxWidth:1280, minHeight:'100vh' }}>
        <Outlet />
      </main>
    </div>
  )
}
