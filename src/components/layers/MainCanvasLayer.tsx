import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useBoardStore } from '../../stores/boardStore'

const MIN_ITEM_SIZE = 48
const CULLING_MARGIN = 180

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

function MainCanvasLayer() {
  const boardRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))

  const items = useBoardStore((state) => state.items)
  const selectedItemId = useBoardStore((state) => state.selectedItemId)
  const camera = useBoardStore((state) => state.camera)
  const updateItem = useBoardStore((state) => state.updateItem)
  const removeItem = useBoardStore((state) => state.removeItem)
  const setSelectedItemId = useBoardStore((state) => state.setSelectedItemId)
  const panCamera = useBoardStore((state) => state.panCamera)
  const bringItemToFront = useBoardStore((state) => state.bringItemToFront)

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.zIndex - b.zIndex),
    [items],
  )
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

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
      URL.revokeObjectURL(selectedItem.src)
      removeItem(selectedItem.id)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [removeItem, selectedItemId])

  const releasePointer = (pointerId: number) => {
    if (boardRef.current?.hasPointerCapture(pointerId)) {
      boardRef.current.releasePointerCapture(pointerId)
    }
    interactionRef.current = null
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) {
      return
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
    const interaction = interactionRef.current

    if (!interaction || interaction.pointerId !== event.pointerId) {
      return
    }

    if (interaction.mode === 'pan') {
      const dx = event.clientX - interaction.lastX
      const dy = event.clientY - interaction.lastY

      panCamera(-dx, -dy)
      interaction.lastX = event.clientX
      interaction.lastY = event.clientY
      event.preventDefault()
      return
    }

    if (interaction.mode === 'move') {
      const dx = event.clientX - interaction.startX
      const dy = event.clientY - interaction.startY
      updateItem(interaction.itemId, {
        x: interaction.originX + dx,
        y: interaction.originY + dy,
      })
      event.preventDefault()
      return
    }

    const dx = event.clientX - interaction.startX
    const dy = event.clientY - interaction.startY
    updateItem(interaction.itemId, {
      width: Math.max(MIN_ITEM_SIZE, interaction.originWidth + dx),
      height: Math.max(MIN_ITEM_SIZE, interaction.originHeight + dy),
    })
    event.preventDefault()
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (interactionRef.current?.pointerId !== event.pointerId) {
      return
    }

    releasePointer(event.pointerId)
  }

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (interactionRef.current?.pointerId !== event.pointerId) {
      return
    }

    releasePointer(event.pointerId)
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
    >
      <div
        className="canvas-grid"
        style={{
          backgroundPosition: `${-camera.x}px ${-camera.y}px`,
        }}
      />
      <div className="canvas-items" aria-label="GIF board">
        {sortedItems.map((item) => {
          const screenX = item.x - camera.x
          const screenY = item.y - camera.y
          const isOutsideView =
            screenX + item.width < -CULLING_MARGIN ||
            screenY + item.height < -CULLING_MARGIN ||
            screenX > viewportSize.width + CULLING_MARGIN ||
            screenY > viewportSize.height + CULLING_MARGIN

          if (isOutsideView) {
            return null
          }

          return (
            <figure
              key={item.id}
              data-gif-id={item.id}
              className={`gif-item ${item.isSelected ? 'is-selected' : ''}`}
              style={{
                width: `${item.width}px`,
                height: `${item.height}px`,
                transform: `translate(${screenX}px, ${screenY}px) rotate(${item.rotation}deg)`,
                zIndex: item.zIndex,
              }}
            >
              <img src={item.src} alt="" draggable={false} loading="lazy" />
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
        )}, ${Math.round(camera.y)})`}
      </p>
    </main>
  )
}

export default MainCanvasLayer
