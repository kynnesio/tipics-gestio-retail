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
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#212322' }}>
      {/* Franja esquerra */}
      <div style={{
        width: '42%', background: '#956C58',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', padding: '3rem',
      }}>
        <div style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 300, fontSize: 48, color: '#F7F2EC', letterSpacing: '0.15em', textTransform: 'uppercase', lineHeight: 1 }}>
          Típics
        </div>
        <div style={{ fontSize: 12, color: 'rgba(247,242,236,0.6)', marginTop: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Gestió interna · tipics.cat
        </div>
      </div>

      {/* Formulari */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: 320 }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#E0C6AD', marginBottom: 6 }}>Benvingut</div>
            <div style={{ fontSize: 13, color: 'rgba(224,198,173,0.5)' }}>Introdueix les teves credencials</div>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(224,198,173,0.5)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="aleix@tipics.cat"
                style={{ width: '100%', padding: '10px 12px', background: 'rgba(224,198,173,0.07)', border: '1px solid rgba(224,198,173,0.15)', borderRadius: 6, color: '#E0C6AD', outline: 'none', fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(224,198,173,0.5)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Contrasenya</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                style={{ width: '100%', padding: '10px 12px', background: 'rgba(224,198,173,0.07)', border: '1px solid rgba(224,198,173,0.15)', borderRadius: 6, color: '#E0C6AD', outline: 'none', fontSize: 14 }}
              />
            </div>
            {error && <div style={{ color: '#E0A0A0', fontSize: 12, marginBottom: '1rem' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '11px', background: '#956C58',
              border: 'none', borderRadius: 6, color: '#F7F2EC',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'Inter Tight, sans-serif', letterSpacing: '0.04em',
              transition: 'background 0.12s',
            }}>
              {loading ? 'Entrant...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
