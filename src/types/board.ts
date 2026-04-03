import type { GifPlaybackData } from '../features/gif/gifPlayback'

export type CameraState = {
  x: number
  y: number
  zoom: number
}

export const GIF_SYNC_MODES = ['off', 'pulse', 'tempo', 'accent'] as const
export type GifSyncMode = (typeof GIF_SYNC_MODES)[number]

export type GifSyncSettings = {
  syncMode: GifSyncMode
  syncStrength: number
  beatDivision: number
  phaseOffset: number
}

export const createDefaultGifSyncSettings = (): GifSyncSettings => ({
  syncMode: 'tempo',
  syncStrength: 0.9,
  beatDivision: 2,
  phaseOffset: 0,
})

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const MAX_BEAT_DIVISION = 64

export const normalizeGifSyncSettings = (
  patch: Partial<GifSyncSettings>,
): GifSyncSettings => {
  const defaults = createDefaultGifSyncSettings()
  const mode = GIF_SYNC_MODES.includes(patch.syncMode as GifSyncMode)
    ? (patch.syncMode as GifSyncMode)
    : defaults.syncMode
  const syncStrength = clamp(
    Number.isFinite(patch.syncStrength) ? Number(patch.syncStrength) : defaults.syncStrength,
    0,
    1,
  )
  const beatDivision = clamp(
    Number.isFinite(patch.beatDivision)
      ? Math.round(Number(patch.beatDivision))
      : defaults.beatDivision,
    1,
    MAX_BEAT_DIVISION,
  )
  const phaseOffset = clamp(
    Number.isFinite(patch.phaseOffset) ? Number(patch.phaseOffset) : defaults.phaseOffset,
    -0.99,
    0.99,
  )

  return {
    syncMode: mode,
    syncStrength,
    beatDivision,
    phaseOffset,
  }
}

export type GifItem = {
  id: string
  file: File
  src: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  playback: GifPlaybackData
  syncMode: GifSyncMode
  syncStrength: number
  beatDivision: number
  phaseOffset: number
  zIndex: number
  isBounceEnabled: boolean
  isSelected: boolean
}

export type BoardState = {
  items: GifItem[]
  selectedItemId: string | null
  camera: CameraState
  isGifBounceEnabled: boolean
  colorThemeIndex: number
}

export type BoardActions = {
  setItems: (items: GifItem[]) => void
  addItems: (items: GifItem[]) => void
  addItem: (item: GifItem) => void
  removeItem: (id: string) => void
  updateItem: (id: string, patch: Partial<GifItem>) => void
  bringItemToFront: (id: string) => void
  updateItemSyncSettings: (id: string, patch: Partial<GifSyncSettings>) => void
  setSelectedItemId: (id: string | null) => void
  setCamera: (camera: CameraState) => void
  panCamera: (dx: number, dy: number) => void
  setZoom: (zoom: number) => void
  setGifBounceEnabled: (enabled: boolean) => void
  cycleColorTheme: () => void
  resetBoard: () => void
}

export type BoardStore = BoardState & BoardActions

export const createInitialBoardState = (): BoardState => ({
  items: [],
  selectedItemId: null,
  camera: {
    x: 0,
    y: 0,
    zoom: 1,
  },
  isGifBounceEnabled: false,
  colorThemeIndex: 0,
})
