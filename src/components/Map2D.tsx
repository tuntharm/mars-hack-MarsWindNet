import { useEffect, useRef, type MouseEvent } from 'react'
import type { CityLayout, CitySceneProps, VelocityField } from '../contracts/marswindnet.ts'
import { colourForValue, legendGradient } from '../field/colour.ts'
import { cellCentre, gridIndex } from '../field/grid.ts'
import { DOMAIN_M } from '../contracts/marswindnet.ts'

const ARROW_STEP = 8
const MAP_PADDING_PX = 25

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  length: number,
) {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + dx * length, y + dy * length)
  ctx.stroke()
  const hx = x + dx * length
  const hy = y + dy * length
  const leftX = -dy
  const leftY = dx
  ctx.beginPath()
  ctx.moveTo(hx, hy)
  ctx.lineTo(hx - dx * 5 + leftX * 3, hy - dy * 5 + leftY * 3)
  ctx.lineTo(hx - dx * 5 - leftX * 3, hy - dy * 5 - leftY * 3)
  ctx.closePath()
  ctx.fill()
}

function paintMap(
  canvas: HTMLCanvasElement,
  city: CityLayout,
  field: VelocityField | null,
  colour: CitySceneProps['colour'],
  selectedSensorId: string | null,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const css = canvas.getBoundingClientRect()
  const width = Math.max(1, Math.round(css.width * dpr))
  const height = Math.max(1, Math.round(css.height * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const padding = Math.min(MAP_PADDING_PX * dpr, width / 8, height / 8)
  const plotWidth = Math.max(1, width - padding * 2)
  const plotHeight = Math.max(1, height - padding * 2)
  const toX = (x: number) => padding + (x / DOMAIN_M) * plotWidth
  const toY = (y: number) => padding + (1 - y / DOMAIN_M) * plotHeight

  ctx.fillStyle = '#0b141b'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#493223'
  ctx.fillRect(padding, padding, plotWidth, plotHeight)

  if (colour.values.length > 0) {
    const nx = field?.grid.nx ?? 128
    const ny = field?.grid.ny ?? 128
    const image = ctx.createImageData(nx, ny)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const src = gridIndex(i, j, nx)
        const dstRow = ny - 1 - j
        const dst = (dstRow * nx + i) * 4
        const tint = colourForValue(colour.values[src] ?? null, colour.min, colour.max, colour.kind)
        if (!tint) {
          image.data[dst] = 58
          image.data[dst + 1] = 28
          image.data[dst + 2] = 16
          image.data[dst + 3] = 255
          continue
        }
        const match = tint.match(/rgb\((\d+), (\d+), (\d+)\)/)
        image.data[dst] = Number(match?.[1] ?? 0)
        image.data[dst + 1] = Number(match?.[2] ?? 0)
        image.data[dst + 2] = Number(match?.[3] ?? 0)
        image.data[dst + 3] = 230
      }
    }
    const off = document.createElement('canvas')
    off.width = nx
    off.height = ny
    off.getContext('2d')?.putImageData(image, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(off, padding, padding, plotWidth, plotHeight)
  }

  for (const pad of city.pads) {
    ctx.beginPath()
    ctx.arc(toX(pad.cx_m), toY(pad.cy_m), (pad.radius_m / DOMAIN_M) * plotWidth, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(214, 168, 112, 0.22)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(246, 236, 214, 0.45)'
    ctx.lineWidth = 1.5 * dpr
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(28, 48, 64, 0.72)'
  for (const bed of city.solar_beds) {
    ctx.fillRect(
      toX(bed.cx_m - bed.width_m / 2),
      toY(bed.cy_m + bed.depth_m / 2),
      (bed.width_m / DOMAIN_M) * plotWidth,
      (bed.depth_m / DOMAIN_M) * plotHeight,
    )
  }

  ctx.fillStyle = '#f3ead8'
  ctx.strokeStyle = '#1b2c38'
  ctx.lineWidth = 1 * dpr
  for (const obstacle of city.obstacles) {
    if (obstacle.kind === 'box') {
      const x = toX(obstacle.cx_m - obstacle.width_m / 2)
      const y = toY(obstacle.cy_m + obstacle.depth_m / 2)
      ctx.fillRect(x, y, (obstacle.width_m / DOMAIN_M) * plotWidth, (obstacle.depth_m / DOMAIN_M) * plotHeight)
      ctx.strokeRect(x, y, (obstacle.width_m / DOMAIN_M) * plotWidth, (obstacle.depth_m / DOMAIN_M) * plotHeight)
    } else {
      ctx.beginPath()
      ctx.arc(
        toX(obstacle.cx_m),
        toY(obstacle.cy_m),
        (obstacle.radius_m / DOMAIN_M) * plotWidth,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.stroke()
    }
  }

  if (field) {
    ctx.strokeStyle = 'rgba(246, 240, 230, 0.92)'
    ctx.fillStyle = 'rgba(246, 240, 230, 0.92)'
    ctx.lineWidth = 1.2 * dpr
    const nx = field.grid.nx
    const ny = field.grid.ny
    for (let j = 4; j < ny; j += ARROW_STEP) {
      for (let i = 4; i < nx; i += ARROW_STEP) {
        const index = gridIndex(i, j, nx)
        if (!field.is_fluid[index]) continue
        const u = field.u[index]
        const v = field.v[index]
        if (u === null || v === null) continue
        const speed = Math.hypot(u, v)
        if (speed < 1e-6) continue
        const { x, y } = cellCentre(i, j)
        const dx = u / speed
        const dy = -v / speed
        drawArrow(ctx, toX(x), toY(y), dx, dy, 9 * dpr)
      }
    }
  }

  ctx.strokeStyle = 'rgba(162, 186, 196, 0.45)'
  ctx.fillStyle = 'rgba(162, 186, 196, 0.85)'
  ctx.lineWidth = 1 * dpr
  ctx.font = `${9 * dpr}px "Spline Sans Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const tick of [0, 100, 200, 300, 400, 500]) {
    const x = toX(tick)
    const y = toY(tick)
    ctx.beginPath()
    ctx.moveTo(x, height - padding + 3 * dpr)
    ctx.lineTo(x, height - padding + 7 * dpr)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(padding - 6 * dpr, y)
    ctx.lineTo(padding - 3 * dpr, y)
    ctx.stroke()
    if (tick > 0 && tick < DOMAIN_M) {
      ctx.textAlign = 'center'
      ctx.fillText(`${tick}`, x, height - padding + 10 * dpr)
      ctx.textAlign = 'right'
      ctx.fillText(`${tick}`, padding - 8 * dpr, y - 4 * dpr)
    }
  }
  ctx.textAlign = 'left'

  for (const sensor of city.sensors) {
    const selected = sensor.id === selectedSensorId
    ctx.beginPath()
    ctx.arc(toX(sensor.x_m), toY(sensor.y_m), (selected ? 7 : 5) * dpr, 0, Math.PI * 2)
    ctx.fillStyle = selected ? '#f0a25d' : '#0d1b2a'
    ctx.fill()
    ctx.strokeStyle = '#f6f0e6'
    ctx.lineWidth = 1.5 * dpr
    ctx.stroke()
    ctx.fillStyle = '#f6f0e6'
    ctx.font = `${10 * dpr}px "Spline Sans Mono", monospace`
    const onEast = sensor.x_m > DOMAIN_M * .85
    const onNorth = sensor.y_m > DOMAIN_M * .85
    ctx.textAlign = onEast ? 'right' : 'left'
    ctx.textBaseline = onNorth ? 'top' : 'bottom'
    ctx.fillText(sensor.id, toX(sensor.x_m) + (onEast ? -10 : 10) * dpr, toY(sensor.y_m) + (onNorth ? 10 : -10) * dpr)
  }
}

export function Map2D({
  city,
  field,
  colour,
  selectedSensorId,
  onSensorSelect,
}: {
  city: CityLayout
  field: VelocityField | null
  colour: CitySceneProps['colour']
  selectedSensorId: string | null
  onSensorSelect: (id: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const redraw = () => paintMap(canvas, city, field, colour, selectedSensorId)
    redraw()
    const observer = new ResizeObserver(redraw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [city, field, colour, selectedSensorId])

  function onClick(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const padding = Math.min(MAP_PADDING_PX, rect.width / 8, rect.height / 8)
    const x = ((event.clientX - rect.left - padding) / (rect.width - 2 * padding)) * DOMAIN_M
    const y = (1 - (event.clientY - rect.top - padding) / (rect.height - 2 * padding)) * DOMAIN_M
    let best: { id: string; dist: number } | null = null
    for (const sensor of city.sensors) {
      const dist = Math.hypot(sensor.x_m - x, sensor.y_m - y)
      if (dist < 18 && (!best || dist < best.dist)) best = { id: sensor.id, dist }
    }
    if (best) onSensorSelect(best.id)
  }

  const unit = colour.kind === 'vector-error' ? 'm/s vector error' : 'm/s speed'

  return (
    <section className="map-panel" aria-label="North-up settlement wind map">
      <header className="panel-head">
        <p className="eyebrow">Field inspection</p>
        <h2>Settlement wind map</h2>
        <p>
          {colour.kind === 'vector-error' ? 'Vector error colours · arrows follow prediction velocity.' : 'Wind speed colours · arrows show the direction of flow.'}
        </p>
      </header>
      <div className="map-frame">
        <canvas ref={canvasRef} onClick={onClick} role="img" aria-label="500 by 500 metre north-up wind map" />
      </div>
      <div className="map-caption"><span>500 × 500 m · axes in metres</span><span>N ↑ &nbsp; E →</span></div>
      <div className="legend">
        <span>{colour.min.toFixed(1)}</span>
        <div className="legend__bar" style={{ background: legendGradient(colour.kind) }} />
        <span>
          {colour.max.toFixed(1)} {unit}
        </span>
      </div>
    </section>
  )
}
