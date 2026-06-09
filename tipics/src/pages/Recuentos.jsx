import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Recuentos() {
  const [tiendas, setTiendas] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [selectedTienda, setSelectedTienda] = useState('')
  const [stockItems, setStockItems] = useState([])
  const [stockNuevo, setStockNuevo] = useState({})
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [loadingStock, setLoadingStock] = useState(false)

  const load = async () => {
    const [{ data: t }, { data: h }] = await Promise.all([
      supabase.from('tiendas').select('id, nombre').eq('activa', true).order('nombre'),
      supabase.from('recuentos').select('*, tiendas(nombre), productos(nombre, pvp, coste_proveedor)').order('fecha', { ascending: false }).limit(50),
    ])
    setTiendas(t || [])
    setHistorial(h || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openModal = async () => {
    setModal(true)
    setSelectedTienda('')
    setStockItems([])
    setStockNuevo({})
  }

  const onSelectTienda = async (tiendaId) => {
    setSelectedTienda(tiendaId)
    if (!tiendaId) { setStockItems([]); return }
    setLoadingStock(true)
    const { data } = await supabase
      .from('stock_tienda')
      .select('*, productos(id, nombre, pvp, coste_proveedor)')
      .eq('tienda_id', tiendaId)
    setStockItems(data || [])
    const initNous = {}
    data?.forEach(s => { initNous[s.producto_id] = '' })
    setStockNuevo(initNous)
    setLoadingStock(false)
  }

  const handleGuardarRecompte = async () => {
    if (!selectedTienda || stockItems.length === 0) return
    const allFilled = stockItems.every(s => stockNuevo[s.producto_id] !== '')
    if (!allFilled) { alert('Omple el nou estoc de tots els productes.'); return }

    setSaving(true)

    const recuentosPayload = stockItems.map(s => ({
      tienda_id: selectedTienda,
      producto_id: s.producto_id,
      stock_anterior: s.unidades_actuales,
      stock_nuevo: parseFloat(stockNuevo[s.producto_id]),
      fecha,
    }))

    await supabase.from('recuentos').insert(recuentosPayload)

    // Actualitzar stock_tienda
    for (const s of stockItems) {
      await supabase.from('stock_tienda')
        .update({ unidades_actuales: parseFloat(stockNuevo[s.producto_id]), fecha_ultimo_recuento: fecha })
        .eq('id', s.id)
    }

    setSaving(false)
    setModal(false)
    load()
  }

  const tiendaNom = (id) => tiendas.find(t => t.id === id)?.nombre || id

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>Recomptes mensuals</h1>
        <button className="btn btn-primary" onClick={openModal}>+ Nou recompte</button>
      </div>

      {loading ? <div style={{ color: '#6b6b68' }}>Carregant...</div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Botiga</th>
                <th>Producte</th>
                <th>Estoc anterior</th>
                <th>Estoc nou</th>
                <th>Unitats venudes</th>
                <th>Ingressos (PVP)</th>
                <th>Cost proveïdor</th>
                <th>Marge Típics</th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#6b6b68', padding: '2rem' }}>Encara no hi ha recomptes. Quan vagis a una botiga, registra el recompte aquí.</td></tr>
              )}
              {historial.map(r => {
                const pvp = Number(r.productos?.pvp || 0)
                const cost = Number(r.productos?.coste_proveedor || 0)
                const venudes = Number(r.unidades_vendidas || 0)
                const ingressos = venudes * pvp
                const costTotal = venudes * cost
                const marge = ingressos - costTotal
                return (
                  <tr key={r.id}>
                    <td style={{ color: '#6b6b68', fontSize: 12 }}>{r.fecha}</td>
                    <td>{r.tiendas?.nombre || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{r.productos?.nombre || '—'}</td>
                    <td>{r.stock_anterior} ud</td>
                    <td>{r.stock_nuevo} ud</td>
                    <td>
                      <span className={`badge badge-${venudes > 0 ? 'green' : 'gray'}`}>{venudes} ud</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{ingressos.toFixed(2)}€</td>
                    <td style={{ color: '#6b6b68' }}>{costTotal.toFixed(2)}€</td>
                    <td style={{ color: '#1D9E75', fontWeight: 500 }}>{marge.toFixed(2)}€</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nou recompte</h2>
              <button className="btn btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Botiga *</label>
                <select value={selectedTienda} onChange={e => onSelectTienda(e.target.value)}>
                  <option value="">Selecciona botiga</option>
                  {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Data</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
            </div>

            {loadingStock && <div style={{ color: '#6b6b68', padding: '1rem 0' }}>Carregant estoc...</div>}

            {stockItems.length > 0 && (
              <div>
                <div style={{ fontSize: 13, color: '#6b6b68', marginBottom: '0.75rem' }}>
                  Introdueix el <strong>nou estoc</strong> que queda a la botiga després del recompte:
                </div>
                <div style={{ background: '#f8f7f4', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }}>
                  <table style={{ margin: 0 }}>
                    <thead>
                      <tr style={{ background: 'transparent' }}>
                        <th>Producte</th>
                        <th>Anterior</th>
                        <th>Nou estoc</th>
                        <th>Venudes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockItems.map(s => {
                        const nou = stockNuevo[s.producto_id]
                        const venudes = nou !== '' ? Math.max(0, s.unidades_actuales - parseFloat(nou || 0)) : '—'
                        return (
                          <tr key={s.producto_id}>
                            <td style={{ fontWeight: 500 }}>{s.productos?.nombre}</td>
                            <td>{s.unidades_actuales} ud</td>
                            <td>
                              <input
                                type="number" min="0" step="1"
                                value={nou}
                                onChange={e => setStockNuevo(prev => ({ ...prev, [s.producto_id]: e.target.value }))}
                                style={{ width: 70, padding: '4px 6px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 6, textAlign: 'center', background: 'white' }}
                              />
                            </td>
                            <td>
                              <span className={`badge badge-${venudes > 0 ? 'green' : 'gray'}`}>
                                {venudes === '—' ? '—' : `${venudes} ud`}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {stockItems.length === 0 && selectedTienda && !loadingStock && (
              <div style={{ color: '#6b6b68', fontSize: 13, padding: '1rem 0' }}>
                Aquesta botiga no té cap producte assignat. Ves a "Estoc" per assignar productes.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setModal(false)}>Cancel·lar</button>
              <button
                className="btn btn-primary"
                onClick={handleGuardarRecompte}
                disabled={saving || stockItems.length === 0}
              >
                {saving ? 'Guardant...' : 'Guardar recompte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
