import { useState, useEffect } from 'react'

const SHELF_COLS = 4
const SHELF_ROWS = 4

const PROD_COLORS = [
  { bg: '#956C58', side: '#7A5445', label: '#F7F2EC' },
  { bg: '#212322', side: '#111413', label: '#E0C6AD' },
  { bg: '#6B4F3A', side: '#553D2C', label: '#F7F2EC' },
  { bg: '#4A3728', side: '#382A1E', label: '#E0C6AD' },
  { bg: '#8B6B4E', side: '#704F38', label: '#F7F2EC' },
  { bg: '#3D2B1F', side: '#2C1F16', label: '#E0C6AD' },
  { bg: '#C4956A', side: '#A07850', label: '#212322' },
  { bg: '#5C4033', side: '#472E24', label: '#E0C6AD' },
]

function colorForProduct(productoId, allIds) {
  const idx = Math.max(0, allIds.indexOf(productoId))
  return PROD_COLORS[idx % PROD_COLORS.length]
}

function Caixa({ item, color, animIn, animOut, onClick }) {
  const [visible, setVisible] = useState(!animIn)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (animIn) requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }, [animIn])

  useEffect(() => {
    if (animOut) setLeaving(true)
  }, [animOut])

  const baixEstoc = Number(item.unidades_actuales) < 3

  return (
    <div onClick={onClick} title={`Clica per treure "${item.productos?.nombre}"`} style={{
      position: 'relative', cursor: 'pointer',
      transition: leaving
        ? 'transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.45s'
        : 'transform 0.4s cubic-bezier(0.34,1.4,0.64,1), opacity 0.35s',
      transform: leaving
        ? 'translateX(60px) scale(0.4) rotate(5deg)'
        : (visible ? 'translateY(0) scale(1)' : 'translateY(-24px) scale(0.75)'),
      opacity: leaving ? 0 : (visible ? 1 : 0),
      transformOrigin: 'bottom center',
    }}>
      {/* Cara frontal */}
      <div style={{
        width: '100%', paddingBottom: '130%', position: 'relative',
        background: color.bg,
        borderRadius: '5px 5px 2px 2px',
        boxShadow: `2px 0 0 ${color.side}, 2px 2px 0 ${color.side}, 0 3px 0 rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.15)`,
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '6px 5px 5px' }}>
          {/* Etiqueta */}
          <div style={{
            background: 'rgba(247,242,236,0.96)', borderRadius: 3,
            padding: '3px 4px', fontSize: 9, fontWeight: 600,
            color: '#212322', lineHeight: 1.25, flex: 1,
            display: 'flex', alignItems: 'center', marginBottom: 5,
            overflow: 'hidden',
            fontFamily: 'Inter Tight, sans-serif',
          }}>
            <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
              {item.productos?.nombre}
            </span>
          </div>
          {/* Unitats */}
          <div style={{
            background: baixEstoc ? 'rgba(139,42,42,0.9)' : 'rgba(0,0,0,0.28)',
            color: '#F7F2EC', borderRadius: 8,
            padding: '1px 5px', fontSize: 9, fontWeight: 600, textAlign: 'center',
          }}>
            {item.unidades_actuales} ud
          </div>
        </div>
      </div>
    </div>
  )
}

function SlotBuit() {
  return (
    <div style={{
      width: '100%', paddingBottom: '130%',
      border: '1px dashed rgba(149,108,88,0.18)',
      borderRadius: 4, background: 'rgba(149,108,88,0.03)',
    }} />
  )
}

export default function Estanteria3D({ stockItems, onDeleteStock, animatingIn, animatingOut }) {
  const allIds = stockItems.map(s => s.producto_id)
  const totalSlots = SHELF_ROWS * SHELF_COLS
  const slots = [...stockItems]
  while (slots.length < totalSlots) slots.push(null)
  const shelves = []
  for (let i = 0; i < SHELF_ROWS; i++) shelves.push(slots.slice(i * SHELF_COLS, (i + 1) * SHELF_COLS))

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        background: 'linear-gradient(180deg, #FAF7F2 0%, #F2EBE0 100%)',
        border: '1px solid rgba(149,108,88,0.2)',
        borderRadius: 10,
        padding: '0 16px',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.04), 0 2px 16px rgba(33,35,34,0.08)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Laterals de fusta */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 16, background: 'linear-gradient(90deg, #7A5445 0%, #956C58 60%, #B08070 100%)', borderRadius: '10px 0 0 10px' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 16, background: 'linear-gradient(90deg, #B08070 0%, #956C58 40%, #7A5445 100%)', borderRadius: '0 10px 10px 0' }} />

        {shelves.map((shelf, si) => (
          <div key={si}>
            <div style={{
              display: 'grid', gridTemplateColumns: `repeat(${SHELF_COLS}, 1fr)`,
              gap: 8, padding: '12px 0 8px', position: 'relative', zIndex: 1,
            }}>
              {shelf.map((item, ii) => {
                const idx = si * SHELF_COLS + ii
                if (!item) return <SlotBuit key={idx} />
                const color = colorForProduct(item.producto_id, allIds)
                return (
                  <Caixa key={item.id} item={item} color={color}
                    animIn={animatingIn?.includes(item.producto_id)}
                    animOut={animatingOut?.includes(item.producto_id)}
                    onClick={() => { if (confirm(`Treure "${item.productos?.nombre}"?`)) onDeleteStock(item.id) }}
                  />
                )
              })}
            </div>
            {/* Prestatge */}
            <div style={{
              height: 10, marginBottom: si < SHELF_ROWS - 1 ? 0 : 6,
              background: 'linear-gradient(180deg, #C4956A 0%, #A07848 50%, #8B6030 100%)',
              borderRadius: 2,
              boxShadow: '0 3px 6px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)',
              position: 'relative', zIndex: 2,
            }}>
              <div style={{ position: 'absolute', top: 3, left: '8%', right: '8%', height: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 1 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
