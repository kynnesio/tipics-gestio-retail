import { useState, useEffect, useRef } from 'react'

const COLORS = ['#2D6A4F','#B5451B','#4A3F8F','#7B5E2A','#1A5F7A','#6B2D3E','#3D6B45','#8B4513']
const SHELF_COLS = 4
const SHELF_ROWS = 4

function colorForProduct(productoId, allIds) {
  const idx = allIds.indexOf(productoId)
  return COLORS[idx % COLORS.length]
}

// Caixa 3D d'un producte
function Caixa({ item, color, animIn, animOut, onClick }) {
  const [visible, setVisible] = useState(!animIn)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (animIn) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    }
  }, [animIn])

  useEffect(() => {
    if (animOut) {
      setLeaving(true)
    }
  }, [animOut])

  const baixEstoc = Number(item.unidades_actuales) < 3
  const darken = color + 'bb'

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        cursor: 'pointer',
        transition: leaving
          ? 'transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s'
          : 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s',
        transform: leaving ? 'translateX(80px) scale(0.5)' : (visible ? 'translateY(0) scale(1)' : 'translateY(-30px) scale(0.7)'),
        opacity: leaving ? 0 : (visible ? 1 : 0),
        transformOrigin: 'bottom center',
      }}
    >
      {/* Cara frontal */}
      <div style={{
        width: '100%',
        paddingBottom: '120%',
        position: 'relative',
        borderRadius: '4px 4px 2px 2px',
        background: `linear-gradient(135deg, ${color} 0%, ${darken} 100%)`,
        boxShadow: `3px 3px 0 ${darken}, 4px 4px 8px rgba(0,0,0,0.25)`,
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '6px 5px 5px' }}>
          {/* Etiqueta */}
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 3,
            padding: '3px 4px',
            fontSize: 9,
            fontWeight: 700,
            color: '#1a1a18',
            lineHeight: 1.2,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            marginBottom: 5,
            overflow: 'hidden',
          }}>
            <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
              {item.productos?.nombre}
            </span>
          </div>
          {/* Unitats */}
          <div style={{
            background: baixEstoc ? 'rgba(200,40,20,0.85)' : 'rgba(0,0,0,0.3)',
            color: 'white',
            borderRadius: 8,
            padding: '1px 5px',
            fontSize: 10,
            fontWeight: 700,
            textAlign: 'center',
          }}>
            {item.unidades_actuales} ud
          </div>
        </div>
      </div>
      {/* Cara lateral dreta (efecte 3D) */}
      <div style={{
        position: 'absolute',
        top: 3,
        right: -3,
        bottom: -3,
        width: 3,
        background: darken,
        borderRadius: '0 2px 2px 0',
        transform: 'skewY(-0deg)',
      }} />
      {/* Cara inferior */}
      <div style={{
        position: 'absolute',
        bottom: -3,
        left: 3,
        right: 0,
        height: 3,
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '0 0 2px 2px',
      }} />
    </div>
  )
}

// Slot buit a l'estanteria
function SlotBuit({ onDrop }) {
  return (
    <div style={{
      width: '100%',
      paddingBottom: '120%',
      border: '1.5px dashed rgba(0,0,0,0.12)',
      borderRadius: 4,
      background: 'rgba(0,0,0,0.02)',
    }} />
  )
}

export default function Estanteria3D({ stockItems, onDeleteStock, animatingIn, animatingOut }) {
  const allProductoIds = stockItems.map(s => s.producto_id)

  // Omplim graella: SHELF_ROWS x SHELF_COLS = 16 slots
  const totalSlots = SHELF_ROWS * SHELF_COLS
  const slots = [...stockItems]
  while (slots.length < totalSlots) slots.push(null)

  const shelves = []
  for (let i = 0; i < SHELF_ROWS; i++) {
    shelves.push(slots.slice(i * SHELF_COLS, (i + 1) * SHELF_COLS))
  }

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Estructura de l'estanteria */}
      <div style={{
        background: 'linear-gradient(180deg, #f9f6f0 0%, #f0ebe0 100%)',
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 12,
        padding: '0 14px',
        boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.08)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Panells laterals de fusta */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 14, background: 'linear-gradient(90deg, #c8a87a 0%, #d4b48a 100%)', borderRadius: '12px 0 0 12px' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 14, background: 'linear-gradient(90deg, #d4b48a 0%, #c8a87a 100%)', borderRadius: '0 12px 12px 0' }} />

        {shelves.map((shelf, si) => (
          <div key={si}>
            {/* Productes */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${SHELF_COLS}, 1fr)`,
              gap: 8,
              padding: '14px 0 10px',
              position: 'relative',
              zIndex: 1,
            }}>
              {shelf.map((item, ii) => {
                const idx = si * SHELF_COLS + ii
                if (!item) return <SlotBuit key={idx} />
                const color = colorForProduct(item.producto_id, allProductoIds)
                const isAnimIn = animatingIn?.includes(item.producto_id)
                const isAnimOut = animatingOut?.includes(item.producto_id)
                return (
                  <Caixa
                    key={item.id}
                    item={item}
                    color={color}
                    animIn={isAnimIn}
                    animOut={isAnimOut}
                    onClick={() => {
                      if (confirm(`Treure "${item.productos?.nombre}" de la botiga?`)) {
                        onDeleteStock(item.id)
                      }
                    }}
                  />
                )
              })}
            </div>

            {/* Prestatge de fusta */}
            <div style={{
              height: 12,
              background: 'linear-gradient(180deg, #d4b48a 0%, #b8956a 50%, #a07848 100%)',
              borderRadius: 2,
              boxShadow: '0 4px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
              position: 'relative',
              zIndex: 2,
              marginBottom: si < SHELF_ROWS - 1 ? 0 : 8,
            }}>
              {/* Veta de la fusta */}
              <div style={{ position: 'absolute', top: 4, left: '10%', right: '10%', height: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
