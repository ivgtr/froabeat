import { create } from 'zustand'
import { createInitialBoardState, type BoardStore } from '../types/board'

export const useBoardStore = create<BoardStore>((set) => ({
  ...createInitialBoardState(),
  setItems: (items) => {
    set({ items })
  },
  addItem: (item) => {
    set((state) => ({ items: [...state.items, item] }))
  },
  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
    }))
  },
  updateItem: (id, patch) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }))
  },
  setSelectedItemId: (id) => {
    set({ selectedItemId: id })
  },
  setCamera: (camera) => {
    set({ camera })
  },
  panCamera: (dx, dy) => {
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
