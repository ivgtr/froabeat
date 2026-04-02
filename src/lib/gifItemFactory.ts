import type { CameraState, GifItem } from '../types/board'

const DEFAULT_SIZE = 240
const MIN_SIZE = 72
const MAX_SIZE = 320
const OFFSET_STEP = 26

const createItemId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `gif-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const resolveNaturalSize = async (src: string) => {
  return await new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image()

    image.onload = () => {
      resolve({
        width: image.naturalWidth || DEFAULT_SIZE,
        height: image.naturalHeight || DEFAULT_SIZE,
      })
    }

    image.onerror = () => {
      resolve({ width: DEFAULT_SIZE, height: DEFAULT_SIZE })
    }

    image.src = src
  })
}

const fitInitialSize = (width: number, height: number) => {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_SIZE
  const safeHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_SIZE
  const maxEdge = Math.max(safeWidth, safeHeight)
  const scale = maxEdge > MAX_SIZE ? MAX_SIZE / maxEdge : 1

  return {
    width: Math.max(MIN_SIZE, Math.round(safeWidth * scale)),
    height: Math.max(MIN_SIZE, Math.round(safeHeight * scale)),
  }
}

type CreateGifItemsOptions = {
  files: File[]
  camera: CameraState
  viewportWidth: number
  viewportHeight: number
  startZIndex: number
}

export const createGifItems = async ({
  files,
  camera,
  viewportWidth,
  viewportHeight,
  startZIndex,
}: CreateGifItemsOptions): Promise<GifItem[]> => {
  const centerX = camera.x + viewportWidth / 2
  const centerY = camera.y + viewportHeight / 2

  return await Promise.all(
    files.map(async (file, index) => {
      const src = URL.createObjectURL(file)
      const naturalSize = await resolveNaturalSize(src)
      const initialSize = fitInitialSize(naturalSize.width, naturalSize.height)
      const offset = index * OFFSET_STEP

      return {
        id: createItemId(),
        file,
        src,
        x: centerX - initialSize.width / 2 + offset,
        y: centerY - initialSize.height / 2 + offset,
        width: initialSize.width,
        height: initialSize.height,
        rotation: 0,
        zIndex: startZIndex + index + 1,
        isSelected: false,
      }
    }),
  )
}
