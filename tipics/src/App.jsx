import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Lots from './pages/Lots'
import Tracabilitat from './pages/Tracabilitat'
import Tiendas from './pages/Tiendas'
import Proveedores from './pages/Proveedores'
import Productos from './pages/Productos'
import Dashboard from './pages/Dashboard'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6b6b68', background: '#212322' }}>
      <div style={{ color: '#E0C6AD', fontFamily: 'Inter Tight, sans-serif', letterSpacing: '0.1em' }}>Típics</div>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Home />} />
          <Route path="lots" element={<Lots />} />
          <Route path="tracabilitat" element={<Tracabilitat />} />
          <Route path="tiendas" element={<Tiendas />} />
          <Route path="proveedores" element={<Proveedores />} />
          <Route path="productos" element={<Productos />} />
          <Route path="dashboard" element={<Dashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
