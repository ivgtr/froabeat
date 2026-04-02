export type CameraState = {
  x: number
  y: number
  zoom: number
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
  zIndex: number
  isSelected: boolean
}

export type BoardState = {
  items: GifItem[]
  selectedItemId: string | null
  camera: CameraState
}

export type BoardActions = {
  setItems: (items: GifItem[]) => void
  addItems: (items: GifItem[]) => void
  addItem: (item: GifItem) => void
  removeItem: (id: string) => void
  updateItem: (id: string, patch: Partial<GifItem>) => void
  bringItemToFront: (id: string) => void
  setSelectedItemId: (id: string | null) => void
  setCamera: (camera: CameraState) => void
  panCamera: (dx: number, dy: number) => void
  setZoom: (zoom: number) => void
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
})
