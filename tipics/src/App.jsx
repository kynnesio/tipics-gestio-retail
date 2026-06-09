import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Proveedores from './pages/Proveedores'
import Productos from './pages/Productos'
import Tiendas from './pages/Tiendas'
import Stock from './pages/Stock'
import Recuentos from './pages/Recuentos'
import Liquidaciones from './pages/Liquidaciones'

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6b6b68' }}>
      Carregant...
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="proveedores" element={<Proveedores />} />
          <Route path="productos" element={<Productos />} />
          <Route path="tiendas" element={<Tiendas />} />
          <Route path="stock" element={<Stock />} />
          <Route path="recuentos" element={<Recuentos />} />
          <Route path="liquidaciones" element={<Liquidaciones />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
