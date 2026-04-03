import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { resolveFrameAtTime } from '../../features/gif/gifPlayback'
import { useAudioStore } from '../../stores/audioStore'
import { useBoardStore } from '../../stores/boardStore'
import type { GifItem } from '../../types/board'
import { useShallow } from 'zustand/react/shallow'

const MIN_ITEM_SIZE = 48
const CULLING_MARGIN = 180
const MOVE_UPDATE_EPSILON = 0.2
const MIN_RENDER_ZOOM = 0.25
const MAX_RENDER_ZOOM = 3
const ZOOM_KEY_FACTOR = 1.1
const ZOOM_WHEEL_SENSITIVITY = 0.0016

const HIGH_LOAD_VISIBLE_DECODED_COUNT = 10
const MEDIUM_LOAD_VISIBLE_DECODED_COUNT = 5
const FIXED_BOUNCE_CYCLES_PER_BEAT = 1
const FIXED_LOOP_FRACTION_PER_BEAT = 0.5

type PanInteraction = {
  mode: 'pan'
  pointerId: number
  lastX: number
  lastY: number
}

type MoveInteraction = {
  mode: 'move'
  pointerId: number
  itemId: string
  startX: number
  startY: number
  originX: number
  originY: number
}

type ResizeInteraction = {
  mode: 'resize'
  pointerId: number
  itemId: string
  startX: number
  startY: number
  originWidth: number
  originHeight: number
}

type Interaction = PanInteraction | MoveInteraction | ResizeInteraction
type TouchPoint = { x: number; y: number }
type PinchGesture = {
  baseDistance: number
  baseZoom: number
}

type SyncClock = {
  isPlaying: boolean
  currentTime: number
  beatProgress: number
  beatIndex: number
}

type SyncVisual = {
  scale: number
  glowAlpha: number
}

const normalizePhase = (value: number): number => {
  const next = value % 1
  return next < 0 ? next + 1 : next
}

const calculateBeatEdgeImpact = (phase: number): number => {
  const cosine = (Math.cos(phase * Math.PI * 2) + 1) * 0.5
  return Math.pow(cosine, 2.2)
}

const resolveSyncVisual = (
  item: GifItem,
  syncClock: SyncClock,
  isLowPowerMode: boolean,
): SyncVisual => {
  if (!syncClock.isPlaying || item.syncMode === 'off') {
    return { scale: 1, glowAlpha: 0 }
  }

  const syncPhase = normalizePhase(
    syncClock.beatProgress * FIXED_BOUNCE_CYCLES_PER_BEAT + item.phaseOffset,
  )
  const edgeImpact = calculateBeatEdgeImpact(syncPhase)
  const strength = isLowPowerMode ? Math.min(0.6, item.syncStrength) : item.syncStrength

  if (item.syncMode === 'accent') {
    const accentMultiplier = syncClock.beatIndex % 4 === 0 ? 1 : 0.42
    return {
      scale: 1 + edgeImpact * 0.32 * strength * accentMultiplier,
      glowAlpha: edgeImpact * strength * accentMultiplier,
    }
  }

  if (item.syncMode === 'pulse') {
    return {
      scale: 1 + edgeImpact * 0.26 * strength,
      glowAlpha: edgeImpact * Math.min(1, strength * 1.1),
    }
  }

  // tempo mode は速度変調が主効果のため、視覚変化は弱めにする
  return {
    scale: 1 + edgeImpact * 0.14 * strength,
    glowAlpha: edgeImpact * 0.72 * strength,
  }
}

const resolveFrameClockMs = (
  item: GifItem,
  playbackNowMs: number,
  syncClock: SyncClock,
  isLowPowerMode: boolean,
): number => {
  if (item.playback.mode !== 'decoded') {
    return playbackNowMs
  }

  if (item.syncMode === 'off') {
    return playbackNowMs
  }

  if (!syncClock.isPlaying) {
    return syncClock.currentTime * 1000
  }

  if (item.syncMode === 'tempo') {
    const frameCount = item.playback.frames.length
    if (frameCount <= 0) {
      return playbackNowMs
    }
    const phaseFrameOffset = item.phaseOffset * frameCount
    const frameProgress =
      syncClock.beatProgress * frameCount * FIXED_LOOP_FRACTION_PER_BEAT + phaseFrameOffset
    const frameIndex =
      ((((Math.floor(frameProgress) % frameCount) +
        frameCount) %
        frameCount) |
        0)
    return item.playback.frames[frameIndex].startAtMs
  }

  const syncPhase = normalizePhase(
    syncClock.beatProgress * item.beatDivision + item.phaseOffset,
  )
  const wave = Math.sin(syncPhase * Math.PI * 2)
  const strength = isLowPowerMode ? Math.min(0.55, item.syncStrength) : item.syncStrength
  const modulation = 1 + wave * 0.42 * strength

  return syncClock.currentTime * 1000 * modulation
}

type GifSurfaceProps = {
  item: GifItem
  playbackNowMs: number
  syncClock: SyncClock
  isLowPowerMode: boolean
}

const GifSurface = memo(function GifSurface({
  item,
  playbackNowMs,
  syncClock,
  isLowPowerMode,
}: GifSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameClockMs = useMemo(
    () => resolveFrameClockMs(item, playbackNowMs, syncClock, isLowPowerMode),
    [item, playbackNowMs, syncClock, isLowPowerMode],
  )
  const decodedFrame = useMemo(
    () => resolveFrameAtTime(item.playback, frameClockMs),
    [item.playback, frameClockMs],
  )

  useEffect(() => {
    if (!decodedFrame) {
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const targetWidth = item.playback.mode === 'decoded' ? item.playback.width : canvas.width
    const targetHeight =
      item.playback.mode === 'decoded' ? item.playback.height : canvas.height
    if (canvas.width !== targetWidth) {
      canvas.width = targetWidth
    }
    if (canvas.height !== targetHeight) {
      canvas.height = targetHeight
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(decodedFrame.image, 0, 0, canvas.width, canvas.height)
  }, [decodedFrame, item.playback])

  if (item.playback.mode === 'legacy') {
    return <img src={item.src} alt="" draggable={false} loading="lazy" />
  }

  return (
    <canvas
      ref={canvasRef}
      className="gif-frame-canvas"
      width={item.playback.width}
      height={item.playback.height}
      aria-hidden
    />
  )
})

const isOutsideViewport = (
  item: GifItem,
  viewportWidth: number,
  viewportHeight: number,
  cameraX: number,
  cameraY: number,
  zoom: number,
): boolean => {
  const safeZoom = Math.min(MAX_RENDER_ZOOM, Math.max(MIN_RENDER_ZOOM, zoom))
  const screenX = (item.x - cameraX) * safeZoom
  const screenY = (item.y - cameraY) * safeZoom
  const screenWidth = item.width * safeZoom
  const screenHeight = item.height * safeZoom

  return (
    screenX + screenWidth < -CULLING_MARGIN ||
    screenY + screenHeight < -CULLING_MARGIN ||
    screenX > viewportWidth + CULLING_MARGIN ||
    screenY > viewportHeight + CULLING_MARGIN
  )
}

function MainCanvasLayer() {
  const boardRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const touchPointsRef = useRef<Map<number, TouchPoint>>(new Map())
  const pinchGestureRef = useRef<PinchGesture | null>(null)
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const [playbackNowMs, setPlaybackNowMs] = useState(() => performance.now())

  const syncClock = useAudioStore(
    useShallow((state) => ({
      isPlaying: state.isPlaying,
      currentTime: state.currentTime,
      beatProgress: state.beatProgress,
      beatIndex: state.beatIndex,
    })),
  )

  const {
    items,
    selectedItemId,
    camera,
    isGifBounceEnabled,
    updateItem,
    removeItem,
    setSelectedItemId,
    setCamera,
    panCamera,
    bringItemToFront,
  } = useBoardStore(
    useShallow((state) => ({
      items: state.items,
      selectedItemId: state.selectedItemId,
      camera: state.camera,
      isGifBounceEnabled: state.isGifBounceEnabled,
      updateItem: state.updateItem,
      removeItem: state.removeItem,
      setSelectedItemId: state.setSelectedItemId,
      setCamera: state.setCamera,
      panCamera: state.panCamera,
      bringItemToFront: state.bringItemToFront,
    })),
  )

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.zIndex - b.zIndex),
    [items],
  )
  const cameraZoom = Number.isFinite(camera.zoom)
    ? Math.min(MAX_RENDER_ZOOM, Math.max(MIN_RENDER_ZOOM, camera.zoom))
    : 1
  const visibleItems = useMemo(
    () =>
      sortedItems.filter(
        (item) =>
          !isOutsideViewport(
            item,
            viewportSize.width,
            viewportSize.height,
            camera.x,
            camera.y,
            cameraZoom,
          ),
      ),
    [
      sortedItems,
      viewportSize.height,
      viewportSize.width,
      camera.x,
      camera.y,
      cameraZoom,
    ],
  )
  const visibleDecodedCount = useMemo(
    () => visibleItems.filter((item) => item.playback.mode === 'decoded').length,
    [visibleItems],
  )
  const isLowPowerMode = visibleDecodedCount >= HIGH_LOAD_VISIBLE_DECODED_COUNT
  const frameIntervalMs =
    visibleDecodedCount >= HIGH_LOAD_VISIBLE_DECODED_COUNT
      ? 84
      : visibleDecodedCount >= MEDIUM_LOAD_VISIBLE_DECODED_COUNT
        ? 50
        : 33

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const applyZoomAtPoint = useCallback(
    (nextZoom: number, viewportX: number, viewportY: number) => {
      const clampedZoom = Math.min(
        MAX_RENDER_ZOOM,
        Math.max(MIN_RENDER_ZOOM, nextZoom),
      )
      if (Math.abs(clampedZoom - cameraZoom) < 0.0001) {
        return
      }

      const worldX = camera.x + viewportX / cameraZoom
      const worldY = camera.y + viewportY / cameraZoom

      setCamera({
        x: worldX - viewportX / clampedZoom,
        y: worldY - viewportY / clampedZoom,
        zoom: clampedZoom,
      })
    },
    [camera.x, camera.y, cameraZoom, setCamera],
  )

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const node = boardRef.current
    if (!node) {
      return
    }

    // Safari のトラックパッドピンチ（gesture*）でページズームに奪われるのを防ぐ。
    const preventGestureDefault = (event: Event) => {
      event.preventDefault()
    }
    // Chrome 系で ctrl+wheel 扱いになるピンチ時の既定ズームも抑止する。
    const preventCtrlWheelZoom = (event: globalThis.WheelEvent) => {
      if (!event.ctrlKey) {
        return
      }
      event.preventDefault()
    }

    node.addEventListener('gesturestart', preventGestureDefault as EventListener, {
      passive: false,
    })
    node.addEventListener('gesturechange', preventGestureDefault as EventListener, {
      passive: false,
    })
    node.addEventListener('gestureend', preventGestureDefault as EventListener, {
      passive: false,
    })
    node.addEventListener('wheel', preventCtrlWheelZoom, {
      passive: false,
    })

    return () => {
      node.removeEventListener(
        'gesturestart',
        preventGestureDefault as EventListener,
      )
      node.removeEventListener(
        'gesturechange',
        preventGestureDefault as EventListener,
      )
      node.removeEventListener('gestureend', preventGestureDefault as EventListener)
      node.removeEventListener('wheel', preventCtrlWheelZoom)
    }
  }, [])

  useEffect(() => {
    if (visibleDecodedCount === 0) {
      return
    }

    let frameId = 0
    let lastTick = 0
    const tick = (nowMs: number) => {
      if (nowMs - lastTick >= frameIntervalMs) {
        setPlaybackNowMs(nowMs)
        lastTick = nowMs
      }
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [visibleDecodedCount, frameIntervalMs])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return
      }
      if (!selectedItemId) {
        return
      }

      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return
      }

      const selectedItem = useBoardStore
        .getState()
        .items.find((item) => item.id === selectedItemId)

      if (!selectedItem) {
        return
      }

      event.preventDefault()
      removeItem(selectedItem.id)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [removeItem, selectedItemId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return
      }

      const isZoomInKey =
        event.key === '+' ||
        event.key === '=' ||
        event.key === 'Add' ||
        event.code === 'NumpadAdd'
      const isZoomOutKey =
        event.key === '-' ||
        event.key === '_' ||
        event.key === 'Subtract' ||
        event.code === 'NumpadSubtract'

      if (!isZoomInKey && !isZoomOutKey) {
        return
      }

      event.preventDefault()
      const factor = isZoomInKey ? ZOOM_KEY_FACTOR : 1 / ZOOM_KEY_FACTOR
      applyZoomAtPoint(
        cameraZoom * factor,
        viewportSize.width / 2,
        viewportSize.height / 2,
      )
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [applyZoomAtPoint, cameraZoom, viewportSize.height, viewportSize.width])

  const releasePointer = (pointerId: number) => {
    if (boardRef.current?.hasPointerCapture(pointerId)) {
      boardRef.current.releasePointerCapture(pointerId)
    }
    interactionRef.current = null
  }

  const releaseTouchPointer = (pointerId: number) => {
    if (boardRef.current?.hasPointerCapture(pointerId)) {
      boardRef.current.releasePointerCapture(pointerId)
    }
    touchPointsRef.current.delete(pointerId)
    if (touchPointsRef.current.size < 2) {
      pinchGestureRef.current = null
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' && (!event.isPrimary || event.button !== 0)) {
      return
    }

    if (event.pointerType === 'touch') {
      boardRef.current?.setPointerCapture(event.pointerId)
      touchPointsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })

      if (touchPointsRef.current.size >= 2) {
        interactionRef.current = null
        const points = Array.from(touchPointsRef.current.values())
        const a = points[0]
        const b = points[1]
        pinchGestureRef.current = {
          baseDistance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
          baseZoom: cameraZoom,
        }
        event.preventDefault()
        return
      }
    }

    const target = event.target as HTMLElement
    const itemElement = target.closest<HTMLElement>('[data-gif-id]')
    const resizeHandle = target.closest<HTMLElement>('[data-resize-handle="true"]')
    const itemId = itemElement?.dataset.gifId
    const item = itemId ? itemById.get(itemId) : undefined

    if (!item) {
      setSelectedItemId(null)
      interactionRef.current = {
        mode: 'pan',
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      }
      boardRef.current?.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }

    setSelectedItemId(item.id)
    bringItemToFront(item.id)

    if (resizeHandle) {
      interactionRef.current = {
        mode: 'resize',
        pointerId: event.pointerId,
        itemId: item.id,
        startX: event.clientX,
        startY: event.clientY,
        originWidth: item.width,
        originHeight: item.height,
      }
    } else {
      interactionRef.current = {
        mode: 'move',
        pointerId: event.pointerId,
        itemId: item.id,
        startX: event.clientX,
        startY: event.clientY,
        originX: item.x,
        originY: item.y,
      }
    }

    boardRef.current?.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' && touchPointsRef.current.has(event.pointerId)) {
      touchPointsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })

      if (pinchGestureRef.current && touchPointsRef.current.size >= 2) {
        const points = Array.from(touchPointsRef.current.values())
        const a = points[0]
        const b = points[1]
        const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
        const rect = boardRef.current?.getBoundingClientRect()
        const viewportX = rect ? (a.x + b.x) * 0.5 - rect.left : (a.x + b.x) * 0.5
        const viewportY = rect ? (a.y + b.y) * 0.5 - rect.top : (a.y + b.y) * 0.5
        const zoomFactor = distance / pinchGestureRef.current.baseDistance

        applyZoomAtPoint(
          pinchGestureRef.current.baseZoom * zoomFactor,
          viewportX,
          viewportY,
        )
        event.preventDefault()
        return
      }
    }

    const interaction = interactionRef.current

    if (!interaction || interaction.pointerId !== event.pointerId) {
      return
    }

    if (interaction.mode === 'pan') {
      const dx = (event.clientX - interaction.lastX) / cameraZoom
      const dy = (event.clientY - interaction.lastY) / cameraZoom

      panCamera(-dx, -dy)
      interaction.lastX = event.clientX
      interaction.lastY = event.clientY
      event.preventDefault()
      return
    }

    if (interaction.mode === 'move') {
      const dx = (event.clientX - interaction.startX) / cameraZoom
      const dy = (event.clientY - interaction.startY) / cameraZoom
      const nextX = interaction.originX + dx
      const nextY = interaction.originY + dy
      if (
        Math.abs(nextX - interaction.originX) < MOVE_UPDATE_EPSILON &&
        Math.abs(nextY - interaction.originY) < MOVE_UPDATE_EPSILON
      ) {
        return
      }
      updateItem(interaction.itemId, {
        x: nextX,
        y: nextY,
      })
      event.preventDefault()
      return
    }

    const dx = (event.clientX - interaction.startX) / cameraZoom
    const dy = (event.clientY - interaction.startY) / cameraZoom
    const nextWidth = Math.max(MIN_ITEM_SIZE, interaction.originWidth + dx)
    const nextHeight = Math.max(MIN_ITEM_SIZE, interaction.originHeight + dy)
    if (
      Math.abs(nextWidth - interaction.originWidth) < MOVE_UPDATE_EPSILON &&
      Math.abs(nextHeight - interaction.originHeight) < MOVE_UPDATE_EPSILON
    ) {
      return
    }
    updateItem(interaction.itemId, {
      width: nextWidth,
      height: nextHeight,
    })
    event.preventDefault()
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      releaseTouchPointer(event.pointerId)
    }

    if (interactionRef.current?.pointerId !== event.pointerId) {
      return
    }

    releasePointer(event.pointerId)
  }

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      releaseTouchPointer(event.pointerId)
    }

    if (interactionRef.current?.pointerId !== event.pointerId) {
      return
    }

    releasePointer(event.pointerId)
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) {
      return
    }

    event.preventDefault()
    const rect = boardRef.current?.getBoundingClientRect()
    const viewportX = rect ? event.clientX - rect.left : event.clientX
    const viewportY = rect ? event.clientY - rect.top : event.clientY
    const zoomFactor = Math.exp(-event.deltaY * ZOOM_WHEEL_SENSITIVITY)

    applyZoomAtPoint(cameraZoom * zoomFactor, viewportX, viewportY)
  }

  return (
    <main
      ref={boardRef}
      className="canvas-layer"
      aria-label="FroaBeat canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
    >
      <div
        className="canvas-grid"
        style={{
          backgroundPosition: `${-camera.x * cameraZoom}px ${-camera.y * cameraZoom}px`,
          backgroundSize: `${48 * cameraZoom}px ${48 * cameraZoom}px`,
        }}
      />
      <div className="canvas-items" aria-label="GIF board">
        {visibleItems.map((item) => {
          const screenX = (item.x - camera.x) * cameraZoom
          const screenY = (item.y - camera.y) * cameraZoom
          const visual = isGifBounceEnabled
            ? resolveSyncVisual(item, syncClock, isLowPowerMode)
            : { scale: 1, glowAlpha: 0 }

          return (
            <figure
              key={item.id}
              data-gif-id={item.id}
              className={`gif-item ${item.isSelected ? 'is-selected' : ''}`}
              style={{
                width: `${item.width * cameraZoom}px`,
                height: `${item.height * cameraZoom}px`,
                transform: `translate(${screenX}px, ${screenY}px) rotate(${item.rotation}deg) scale(${visual.scale})`,
                zIndex: item.zIndex,
                filter:
                  visual.glowAlpha > 0
                    ? `drop-shadow(0 0 12px rgba(154, 167, 174, ${visual.glowAlpha * 0.8}))`
                    : undefined,
              }}
            >
              <GifSurface
                item={item}
                playbackNowMs={playbackNowMs}
                syncClock={syncClock}
                isLowPowerMode={isLowPowerMode}
              />
              {item.isSelected && (
                <button
                  type="button"
                  className="gif-resize-handle"
                  data-resize-handle="true"
                  aria-label="選択中 GIF のサイズを変更"
                />
              )}
            </figure>
          )
        })}
      </div>
      <p className="canvas-caption">
        {`FroaBeat Infinite Canvas / GIF ${items.length}件 / Camera (${Math.round(
          camera.x,
        )}, ${Math.round(camera.y)})${isLowPowerMode ? ' / LOW-POWER' : ''}`}
      </p>
    </main>
  )
}

export default memo(MainCanvasLayer)
