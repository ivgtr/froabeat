import { create } from 'zustand'
import { createInitialBoardState, type BoardStore } from '../types/board'

const normalizeSelection = (items: BoardStore['items'], selectedId: string | null) => {
  const nextSelectedId =
    selectedId && items.some((item) => item.id === selectedId) ? selectedId : null

  return {
    selectedItemId: nextSelectedId,
    items: items.map((item) => ({
      ...item,
      isSelected: item.id === nextSelectedId,
    })),
  }
}

export const useBoardStore = create<BoardStore>((set) => ({
  ...createInitialBoardState(),
  setItems: (items) => {
    set((state) => normalizeSelection(items, state.selectedItemId))
  },
  addItems: (items) => {
    set((state) => ({
      items: [...state.items, ...items.map((item) => ({ ...item, isSelected: false }))],
    }))
  },
  addItem: (item) => {
    set((state) => ({
      items: [...state.items, { ...item, isSelected: false }],
    }))
  },
  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
    }))
  },
  updateItem: (id, patch) => {
    set((state) => {
      let didChange = false
      const nextItems = state.items.map((item) => {
        if (item.id !== id) {
          return item
        }

        const nextItem = { ...item, ...patch }
        const isEqual =
          nextItem.x === item.x &&
          nextItem.y === item.y &&
          nextItem.width === item.width &&
          nextItem.height === item.height &&
          nextItem.rotation === item.rotation &&
          nextItem.zIndex === item.zIndex &&
          nextItem.isSelected === item.isSelected

        if (isEqual) {
          return item
        }

        didChange = true
        return nextItem
      })

      return didChange ? { items: nextItems } : state
    })
  },
  bringItemToFront: (id) => {
    set((state) => {
      const maxZIndex = state.items.reduce((max, item) => Math.max(max, item.zIndex), 0)
      return {
        items: state.items.map((item) =>
          item.id === id ? { ...item, zIndex: maxZIndex + 1 } : item,
        ),
      }
    })
  },
  setSelectedItemId: (id) => {
    set((state) => normalizeSelection(state.items, id))
  },
  setCamera: (camera) => {
    set({ camera })
  },
  panCamera: (dx, dy) => {
    if (dx === 0 && dy === 0) {
      return
    }

    set((state) => ({
      camera: {
        ...state.camera,
        x: state.camera.x + dx,
        y: state.camera.y + dy,
      },
    }))
  },
  setZoom: (zoom) => {
    set((state) => ({
      camera: { ...state.camera, zoom },
    }))
  },
  resetBoard: () => {
    set(createInitialBoardState())
  },
}))
