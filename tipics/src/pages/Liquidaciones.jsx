import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Liquidaciones() {
  const [tiendas, setTiendas] = useState([])
  const [liq, setLiq] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [calcData, setCalcData] = useState(null)
  const [form, setForm] = useState({ tienda_id: '', mes: new Date().getMonth() + 1, anyo: new Date().getFullYear() })
  const [saving, setSaving] = useState(false)
  const [loadingCalc, setLoadingCalc] = useState(false)

  const mesos = ['Gener','Febrer','Març','Abril','Maig','Juny','Juliol','Agost','Setembre','Octubre','Novembre','Desembre']

  const load = async () => {
    const [{ data: t }, { data: l }] = await Promise.all([
      supabase.from('tiendas').select('id, nombre, alquiler_fijo_mensual, comision_variable_pct').eq('activa', true).order('nombre'),
      supabase.from('liquidaciones').select('*, tiendas(nombre)').order('periodo_anyo', { ascending: false }).order('periodo_mes', { ascending: false }),
    ])
    setTiendas(t || [])
    setLiq(l || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const calcularLiquidacio = async () => {
    if (!form.tienda_id) return
    setLoadingCalc(true)
    const tienda = tiendas.find(t => t.id === form.tienda_id)
    const mesStr = String(form.mes).padStart(2, '0')
    const dateFrom = `${form.anyo}-${mesStr}-01`
    const dateToDate = new Date(form.anyo, form.mes, 0)
    const dateTo = dateToDate.toISOString().split('T')[0]

    const { data: recs } = await supabase
      .from('recuentos')
      .select('unidades_vendidas, productos(pvp, coste_proveedor, nombre)')
      .eq('tienda_id', form.tienda_id)
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)

    let totalVendesAmbPvp = 0
    let totalCostProveidor = 0
    const detall = []

    recs?.forEach(r => {
      const venudes = Number(r.unidades_vendidas || 0)
      const pvp = Number(r.productos?.pvp || 0)
      const cost = Number(r.productos?.coste_proveedor || 0)
      totalVendesAmbPvp += venudes * pvp
      totalCostProveidor += venudes * cost
      detall.push({ nom: r.productos?.nombre, venudes, pvp, cost, ingressos: venudes * pvp })
    })

    const alquilerFix = Number(tienda.alquiler_fijo_mensual)
    const comissioVar = totalVendesAmbPvp * (Number(tienda.comision_variable_pct) / 100)
    const totalCobrarTienda = totalVendesAmbPvp + alquilerFix + comissioVar
    const margeTypics = totalVendesAmbPvp - totalCostProveidor - comissioVar

    setCalcData({
      tienda,
      detall,
      totalVendesAmbPvp,
      totalCostProveidor,
      alquilerFix,
      comissioVar,
      totalCobrarTienda,
      totalPagarProveidor: totalCostProveidor,
      margeTypics,
    })
    setLoadingCalc(false)
  }

  const handleGuardar = async () => {
    if (!calcData) return
    setSaving(true)
    await supabase.from('liquidaciones').upsert({
      tienda_id: form.tienda_id,
      periodo_mes: form.mes,
      periodo_anyo: form.anyo,
      importe_cobrar_tienda: calcData.totalCobrarTienda,
      alquiler_fijo: calcData.alquilerFix,
      comision_variable: calcData.comissioVar,
      importe_pagar_proveedor: calcData.totalPagarProveidor,
      margen_tipics: calcData.margeTypics,
      estado: 'pendiente',
    }, { onConflict: 'tienda_id,periodo_mes,periodo_anyo' })
    setSaving(false)
    setModal(false)
    setCalcData(null)
    load()
  }

  const updateEstado = async (id, estado) => {
    await supabase.from('liquidaciones').update({ estado }).eq('id', id)
    load()
  }

  const estadoBadge = (e) => ({ pendiente: 'amber', cobrado: 'green', pagado: 'green', cerrado: 'gray' }[e] || 'gray')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>Liquidacions</h1>
        <button className="btn btn-primary" onClick={() => { setCalcData(null); setModal(true) }}>+ Nova liquidació</button>
      </div>

      {loading ? <div style={{ color: '#6b6b68' }}>Carregant...</div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Botiga</th>
                <th>Període</th>
                <th>Cobrar a botiga</th>
                <th>Pagar proveïdor</th>
                <th>Marge Típics</th>
                <th>Estat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {liq.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6b6b68', padding: '2rem' }}>Cap liquidació. Genera-ne una al final de cada mes.</td></tr>
              )}
              {liq.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.tiendas?.nombre}</td>
                  <td>{mesos[r.periodo_mes - 1]} {r.periodo_anyo}</td>
                  <td style={{ fontWeight: 500 }}>{Number(r.importe_cobrar_tienda).toFixed(2)}€</td>
                  <td style={{ color: '#6b6b68' }}>{Number(r.importe_pagar_proveedor).toFixed(2)}€</td>
                  <td style={{ color: '#1D9E75', fontWeight: 500 }}>{Number(r.margen_tipics).toFixed(2)}€</td>
                  <td>
                    <span className={`badge badge-${estadoBadge(r.estado)}`}>{r.estado}</span>
                  </td>
                  <td>
                    <select
                      value={r.estado}
                      onChange={e => updateEstado(r.id, e.target.value)}
                      style={{ padding: '4px 8px', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 12 }}
                    >
                      <option value="pendiente">Pendent</option>
                      <option value="cobrado">Cobrat</option>
                      <option value="pagado">Pagat proveïdor</option>
                      <option value="cerrado">Tancat</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nova liquidació</h2>
              <button className="btn btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Botiga *</label>
                <select value={form.tienda_id} onChange={e => { setForm(p => ({ ...p, tienda_id: e.target.value })); setCalcData(null) }}>
                  <option value="">Selecciona</option>
                  {tiendas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Mes</label>
                <select value={form.mes} onChange={e => { setForm(p => ({ ...p, mes: parseInt(e.target.value) })); setCalcData(null) }}>
                  {mesos.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Any</label>
                <input type="number" value={form.anyo} onChange={e => { setForm(p => ({ ...p, anyo: parseInt(e.target.value) })); setCalcData(null) }} />
              </div>
            </div>

            <button className="btn" style={{ marginBottom: '1.25rem' }} onClick={calcularLiquidacio} disabled={!form.tienda_id || loadingCalc}>
              {loadingCalc ? 'Calculant...' : '🔢 Calcular liquidació'}
            </button>

            {calcData && (
              <div>
                <div style={{ background: '#f8f7f4', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: '0.75rem', color: '#1a1a18' }}>Detall de vendes</div>
                  {calcData.detall.length === 0 ? (
                    <div style={{ color: '#6b6b68', fontSize: 13 }}>Sense vendes registrades aquest mes.</div>
                  ) : calcData.detall.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{d.nom} × {d.venudes} ud</span>
                      <span style={{ fontWeight: 500 }}>{d.ingressos.toFixed(2)}€</span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.1)', paddingTop: '1rem', marginBottom: '1rem' }}>
                  {[
                    { label: 'Vendes (PVP)', val: calcData.totalVendesAmbPvp, color: '#1a1a18' },
                    { label: `Lloguer fix`, val: calcData.alquilerFix, color: '#1a1a18' },
                    { label: `Comissió variable (${calcData.tienda.comision_variable_pct}%)`, val: calcData.comissioVar, color: '#1a1a18' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: '#6b6b68' }}>{row.label}</span>
                      <span>{row.val.toFixed(2)}€</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, borderTop: '0.5px solid rgba(0,0,0,0.1)', paddingTop: 8, marginTop: 4 }}>
                    <span>Total a cobrar a la botiga</span>
                    <span style={{ color: '#D85A30' }}>{calcData.totalCobrarTienda.toFixed(2)}€</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, marginTop: 8 }}>
                    <span>Total a pagar al proveïdor</span>
                    <span style={{ color: '#6b6b68' }}>{calcData.totalPagarProveidor.toFixed(2)}€</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 500, marginTop: 8, background: '#E1F5EE', padding: '8px 12px', borderRadius: 6 }}>
                    <span style={{ color: '#0F6E56' }}>Marge Típics</span>
                    <span style={{ color: '#0F6E56' }}>{calcData.margeTypics.toFixed(2)}€</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setModal(false)}>Cancel·lar</button>
              <button className="btn btn-primary" onClick={handleGuardar} disabled={!calcData || saving}>
                {saving ? 'Guardant...' : 'Guardar liquidació'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
