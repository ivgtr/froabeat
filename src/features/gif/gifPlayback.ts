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

    return {
      mode: 'decoded',
      width,
      height,
      durationMs: Math.max(1, cursorMs),
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
