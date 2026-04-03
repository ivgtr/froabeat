const DEFAULT_FRAME_DELAY_MS = 100
const MIN_FRAME_DELAY_MS = 20
const MAX_FRAME_DELAY_MS = 1000
const MAX_DECODE_FRAME_COUNT = 300
const MAX_DECODED_TOTAL_PIXELS = 96_000_000

export type GifLegacyReason =
  | 'decoder-unavailable'
  | 'too-many-frames'
  | 'too-large'
  | 'single-frame'
  | 'decode-failed'

type LegacyGifPlaybackData = {
  mode: 'legacy'
  reason: GifLegacyReason
}

export type DecodedGifFrame = {
  image: ImageBitmap
  delayMs: number
  startAtMs: number
}

type DecodedGifPlaybackData = {
  mode: 'decoded'
  width: number
  height: number
  durationMs: number
  cycleDurationMs: number
  frames: DecodedGifFrame[]
}

export type GifPlaybackData = LegacyGifPlaybackData | DecodedGifPlaybackData

type DecoderTrackMetadata = {
  frameCount?: number
  codedWidth?: number
  codedHeight?: number
}

type DecodedFrameResult = {
  image: {
    duration?: number
    close?: () => void
  }
}

type ImageDecoderInstance = {
  tracks?: {
    selectedTrack?: DecoderTrackMetadata
  }
  decode: (options: {
    frameIndex: number
    completeFramesOnly?: boolean
  }) => Promise<DecodedFrameResult>
  close?: () => void
}

type ImageDecoderCtor = new (options: {
  data: Uint8Array
  type: string
  preferAnimation?: boolean
}) => ImageDecoderInstance

class GifDecodeError extends Error {
  reason: GifLegacyReason

  constructor(reason: GifLegacyReason, message: string) {
    super(message)
    this.reason = reason
  }
}

const hasImageDecoder = (): boolean =>
  typeof globalThis !== 'undefined' &&
  'ImageDecoder' in globalThis &&
  typeof (globalThis as { ImageDecoder?: unknown }).ImageDecoder === 'function'

const toDelayMs = (durationMicros?: number): number => {
  if (!durationMicros || !Number.isFinite(durationMicros) || durationMicros <= 0) {
    return DEFAULT_FRAME_DELAY_MS
  }

  const ms = durationMicros / 1000
  return Math.min(MAX_FRAME_DELAY_MS, Math.max(MIN_FRAME_DELAY_MS, Math.round(ms)))
}

const DHASH_SIZE = 8
// dHash ハミング距離: ≤ この値なら類似、> なら異なると判定
const DHASH_THRESHOLD = 5

const computeDHash = (frame: ImageBitmap): Uint8Array | null => {
  if (typeof OffscreenCanvas === 'undefined') return null
  const w = DHASH_SIZE + 1
  const h = DHASH_SIZE
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(frame, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const hash = new Uint8Array(DHASH_SIZE)
  for (let y = 0; y < h; y++) {
    let byte = 0
    for (let x = 0; x < DHASH_SIZE; x++) {
      const idx = (y * w + x) * 4
      const left = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
      const right =
        data[idx + 4] * 0.299 + data[idx + 5] * 0.587 + data[idx + 6] * 0.114
      if (left > right) {
        byte |= 1 << x
      }
    }
    hash[y] = byte
  }
  return hash
}

export const hammingDistance = (a: Uint8Array, b: Uint8Array): number => {
  let dist = 0
  for (let i = 0; i < a.length; i++) {
    let xor = a[i] ^ b[i]
    while (xor) {
      dist += xor & 1
      xor >>= 1
    }
  }
  return dist
}

export const detectCycleDurationMs = (frames: DecodedGifFrame[], totalDurationMs: number): number => {
  if (frames.length < 4) return totalDurationMs
  const h0 = computeDHash(frames[0].image)
  const h1 = computeDHash(frames[1].image)
  const h2 = computeDHash(frames[2].image)
  const h3 = computeDHash(frames[3].image)
  if (!h0 || !h1 || !h2 || !h3) return totalDurationMs
  const dist02 = hammingDistance(h0, h2)
  const dist13 = hammingDistance(h1, h3)
  const dist01 = hammingDistance(h0, h1)
  // 先頭4フレームが全て類似 → 静止画 or 静→動GIF。ループパターンではない
  if (dist01 <= DHASH_THRESHOLD && dist02 <= DHASH_THRESHOLD) {
    return totalDurationMs
  }
  // A,B,A,B パターン: 1つ飛ばしが同一状態、隣接が異なる状態
  if (dist02 <= DHASH_THRESHOLD && dist13 <= DHASH_THRESHOLD) {
    return frames[0].delayMs + frames[1].delayMs
  }
  return totalDurationMs
}

const decodeGifFrames = async (file: File): Promise<DecodedGifPlaybackData> => {
  if (!hasImageDecoder()) {
    throw new GifDecodeError(
      'decoder-unavailable',
      'ImageDecoder is not available',
    )
  }

  const ImageDecoder = (globalThis as { ImageDecoder: ImageDecoderCtor }).ImageDecoder
  const data = new Uint8Array(await file.arrayBuffer())
  const decoder = new ImageDecoder({
    data,
    type: 'image/gif',
    preferAnimation: true,
  })
  const frames: DecodedGifFrame[] = []

  try {
    const track = decoder.tracks?.selectedTrack
    const declaredFrameCount =
      typeof track?.frameCount === 'number' && track.frameCount > 0
        ? track.frameCount
        : null

    if (declaredFrameCount && declaredFrameCount > MAX_DECODE_FRAME_COUNT) {
      throw new GifDecodeError(
        'too-many-frames',
        `frameCount exceeded limit: ${declaredFrameCount}`,
      )
    }

    let cursorMs = 0
    let totalPixels = 0

    for (let frameIndex = 0; ; frameIndex += 1) {
      if (declaredFrameCount !== null && frameIndex >= declaredFrameCount) {
        break
      }
      if (declaredFrameCount === null && frameIndex >= MAX_DECODE_FRAME_COUNT) {
        throw new GifDecodeError(
          'too-many-frames',
          `frameCount exceeded limit: ${MAX_DECODE_FRAME_COUNT}+`,
        )
      }

      let decoded: DecodedFrameResult
      try {
        decoded = await decoder.decode({
          frameIndex,
          completeFramesOnly: true,
        })
      } catch (error) {
        if (declaredFrameCount === null && frames.length > 0) {
          break
        }
        throw new GifDecodeError(
          'decode-failed',
          `frame decode failed at index=${frameIndex}: ${String(error)}`,
        )
      }

      const rawFrame = decoded.image
      const bitmap = await createImageBitmap(rawFrame as unknown as ImageBitmapSource)
      rawFrame.close?.()

      totalPixels += bitmap.width * bitmap.height
      if (totalPixels > MAX_DECODED_TOTAL_PIXELS) {
        bitmap.close()
        throw new GifDecodeError(
          'too-large',
          `decoded pixels exceeded limit: ${totalPixels}`,
        )
      }

      const delayMs = toDelayMs(rawFrame.duration)
      frames.push({
        image: bitmap,
        delayMs,
        startAtMs: cursorMs,
      })
      cursorMs += delayMs
    }

    if (frames.length <= 1) {
      throw new GifDecodeError(
        'single-frame',
        'single frame gif does not support frame-sync playback',
      )
    }

    const width =
      (typeof track?.codedWidth === 'number' && track.codedWidth > 0
        ? track.codedWidth
        : frames[0]?.image.width) ?? 1
    const height =
      (typeof track?.codedHeight === 'number' && track.codedHeight > 0
        ? track.codedHeight
        : frames[0]?.image.height) ?? 1

    const durationMs = Math.max(1, cursorMs)
    return {
      mode: 'decoded',
      width,
      height,
      durationMs,
      cycleDurationMs: detectCycleDurationMs(frames, durationMs),
      frames,
    }
  } catch (error) {
    for (const frame of frames) {
      frame.image.close()
    }
    throw error
  } finally {
    decoder.close?.()
  }
}

export const createGifPlaybackData = async (file: File): Promise<GifPlaybackData> => {
  try {
    return await decodeGifFrames(file)
  } catch (error) {
    if (error instanceof GifDecodeError) {
      return {
        mode: 'legacy',
        reason: error.reason,
      }
    }
    return { mode: 'legacy', reason: 'decode-failed' }
  }
}

export const describeLegacyFallbackReason = (reason: GifLegacyReason): string => {
  switch (reason) {
    case 'decoder-unavailable':
      return 'ブラウザがフレーム制御に未対応のため通常再生に切替'
    case 'too-many-frames':
      return 'フレーム数が上限を超えたため通常再生に切替'
    case 'too-large':
      return 'デコード負荷が高いため通常再生に切替'
    case 'single-frame':
      return '1フレームGIFのため同期再生できません'
    case 'decode-failed':
    default:
      return 'デコードに失敗したため通常再生に切替'
  }
}

export const releaseGifPlaybackData = (playback: GifPlaybackData): void => {
  if (playback.mode !== 'decoded') {
    return
  }

  for (const frame of playback.frames) {
    frame.image.close()
  }
}

export const resolveFrameAtTime = (
  playback: GifPlaybackData,
  nowMs: number,
): DecodedGifFrame | null => {
  if (playback.mode !== 'decoded') {
    return null
  }

  if (playback.frames.length === 0) {
    return null
  }

  const safeNow = Number.isFinite(nowMs) ? nowMs : 0
  const normalizedMs =
    ((safeNow % playback.durationMs) + playback.durationMs) % playback.durationMs

  for (let index = playback.frames.length - 1; index >= 0; index -= 1) {
    const frame = playback.frames[index]
    if (normalizedMs >= frame.startAtMs) {
      return frame
    }
  }

  return playback.frames[0]
}

export const resolveTempoClockMs = (
  cycleDurationMs: number,
  beatProgress: number,
  beatDivision: number,
  phaseOffset: number,
): number => {
  const rawBeat = beatProgress + phaseOffset
  const beatIndex = Math.floor(rawBeat)
  const beatFrac = rawBeat - beatIndex
  const step = ((beatIndex % beatDivision) + beatDivision) % beatDivision
  const progress = (step + beatFrac) / beatDivision
  return Math.min(progress * cycleDurationMs, cycleDurationMs * (1 - Number.EPSILON))
}
