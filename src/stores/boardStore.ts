import { create } from 'zustand'
import { releaseGifPlaybackData } from '../features/gif/gifPlayback'
import { COLOR_THEMES } from '../lib/colorThemes'
import {
  createDefaultGifSyncSettings,
  createInitialBoardState,
  normalizeGifSyncSettings,
  type BoardStore,
} from '../types/board'

const MIN_CAMERA_ZOOM = 0.25
const MAX_CAMERA_ZOOM = 3

const withSyncDefaults = (item: BoardStore['items'][number]) => {
  const defaults = createDefaultGifSyncSettings()
  const normalized = normalizeGifSyncSettings({
    syncMode: item.syncMode ?? defaults.syncMode,
    syncStrength: item.syncStrength ?? defaults.syncStrength,
    beatDivision: item.beatDivision ?? defaults.beatDivision,
    phaseOffset: item.phaseOffset ?? defaults.phaseOffset,
  })

  return {
    ...item,
    ...normalized,
  }
}

const normalizeSelection = (items: BoardStore['items'], selectedId: string | null) => {
  const nextSelectedId =
    selectedId && items.some((item) => item.id === selectedId) ? selectedId : null

  return {
    selectedItemId: nextSelectedId,
    items: items.map((item) => ({
      ...withSyncDefaults(item),
      isSelected: item.id === nextSelectedId,
    })),
  }
}

export const useBoardStore = create<BoardStore>((set) => ({
  ...createInitialBoardState(),
  setItems: (items) => {
    set((state) => {
      const nextIds = new Set(items.map((item) => item.id))
      for (const previous of state.items) {
        if (nextIds.has(previous.id)) {
          continue
        }
        URL.revokeObjectURL(previous.src)
        releaseGifPlaybackData(previous.playback)
      }

      return normalizeSelection(items, state.selectedItemId)
    })
  },
  addItems: (items) => {
    set((state) => ({
      items: [
        ...state.items,
        ...items.map((item) => ({
          ...withSyncDefaults(item),
          isSelected: false,
        })),
      ],
    }))
  },
  addItem: (item) => {
    set((state) => ({
      items: [...state.items, { ...withSyncDefaults(item), isSelected: false }],
    }))
  },
  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => {
        if (item.id !== id) {
          return true
        }
        URL.revokeObjectURL(item.src)
        releaseGifPlaybackData(item.playback)
        return false
      }),
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

        const hasChange = Object.entries(patch).some(([key, value]) => {
          return !Object.is(item[key as keyof typeof item], value)
        })
        if (!hasChange) {
          return item
        }

        didChange = true
        return { ...item, ...patch }
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
  updateItemSyncSettings: (id, patch) => {
    const normalizedPatch = normalizeGifSyncSettings(patch)
    set((state) => {
      let didChange = false
      const nextItems = state.items.map((item) => {
        if (item.id !== id) {
          return item
        }

        const nextItem = {
          ...item,
          ...normalizedPatch,
        }
        const isEqual =
          nextItem.syncMode === item.syncMode &&
          nextItem.syncStrength === item.syncStrength &&
          nextItem.beatDivision === item.beatDivision &&
          nextItem.phaseOffset === item.phaseOffset
        if (isEqual) {
          return item
        }

        didChange = true
        return nextItem
      })

      return didChange ? { items: nextItems } : state
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
    set((state) => {
      const normalizedZoom = Number.isFinite(zoom)
        ? Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, zoom))
        : state.camera.zoom
      if (state.camera.zoom === normalizedZoom) {
        return state
      }
      return {
        camera: { ...state.camera, zoom: normalizedZoom },
      }
    })
  },
  setGifBounceEnabled: (enabled) => {
    set((state) => {
      if (state.isGifBounceEnabled === enabled) {
        return state
      }
      return { isGifBounceEnabled: enabled }
    })
  },
  cycleColorTheme: () => {
    set((state) => ({
      colorThemeIndex: (state.colorThemeIndex + 1) % COLOR_THEMES.length,
    }))
  },
  resetBoard: () => {
    set((state) => {
      for (const item of state.items) {
        URL.revokeObjectURL(item.src)
        releaseGifPlaybackData(item.playback)
      }
      return createInitialBoardState()
    })
  },
}))
