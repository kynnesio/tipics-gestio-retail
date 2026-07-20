import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Credencials incorrectes')
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#1A1918', display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>
      <div style={{ width:'100%', maxWidth:360 }}>
        {/* Logotip */}
        <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
          <div style={{ fontSize:32, fontWeight:300, color:'#E8D8C8', letterSpacing:'0.18em', textTransform:'uppercase' }}>Típics</div>
          <div style={{ fontSize:12, color:'rgba(232,216,200,0.35)', marginTop:4, letterSpacing:'0.08em' }}>Gestió interna</div>
        </div>

        {/* Form card */}
        <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'2rem' }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:'1rem' }}>
              <label style={{ display:'block', fontSize:11, color:'rgba(232,216,200,0.4)', marginBottom:6, letterSpacing:'0.07em', textTransform:'uppercase', fontWeight:600 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="aleix@tipics.cat"
                style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#E8D8C8', outline:'none', fontSize:15, transition:'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor='rgba(149,108,88,0.6)'}
                onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'} />
            </div>
            <div style={{ marginBottom:'1.5rem' }}>
              <label style={{ display:'block', fontSize:11, color:'rgba(232,216,200,0.4)', marginBottom:6, letterSpacing:'0.07em', textTransform:'uppercase', fontWeight:600 }}>Contrasenya</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#E8D8C8', outline:'none', fontSize:15, transition:'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor='rgba(149,108,88,0.6)'}
                onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'} />
            </div>
            {error && <div style={{ color:'#E0A0A0', fontSize:13, marginBottom:'1rem', textAlign:'center' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width:'100%', padding:'12px', background:'#956C58', border:'none', borderRadius:24, color:'#F5F0EA', fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:'Inter Tight, sans-serif', letterSpacing:'0.02em', transition:'background 0.12s, transform 0.08s', boxShadow:'0 2px 12px rgba(149,108,88,0.35)' }}
              onMouseEnter={e => e.currentTarget.style.background='#7A5445'}
              onMouseLeave={e => e.currentTarget.style.background='#956C58'}
              onMouseDown={e => e.currentTarget.style.transform='scale(0.98)'}
              onMouseUp={e => e.currentTarget.style.transform=''}>
              {loading ? 'Entrant...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
