import { describe, expect, it } from 'vitest'
import {
  detectCycleDurationMs,
  hammingDistance,
  resolveFrameAtTime,
  resolveTempoClockMs,
  type DecodedGifFrame,
} from './gifPlayback'

const createFrames = (count: number, delayMs = 100): DecodedGifFrame[] => {
  const frames: DecodedGifFrame[] = []
  let cursor = 0
  for (let i = 0; i < count; i++) {
    frames.push({ image: {} as ImageBitmap, delayMs, startAtMs: cursor })
    cursor += delayMs
  }
  return frames
}

const createPlayback = (frameCount: number, delayMs = 100, cycleDurationMs?: number) => {
  const frames = createFrames(frameCount, delayMs)
  const durationMs = frameCount * delayMs
  return {
    mode: 'decoded' as const,
    width: 100,
    height: 100,
    durationMs,
    cycleDurationMs: cycleDurationMs ?? durationMs,
    frames,
  }
}

// resolveTempoClockMs は gifPlayback.ts から直接 import

describe('resolveFrameAtTime', () => {
  it('2フレームGIF: 各 startAtMs でラウンドトリップ', () => {
    const playback = createPlayback(2)
    expect(resolveFrameAtTime(playback, 0)).toBe(playback.frames[0])
    expect(resolveFrameAtTime(playback, 100)).toBe(playback.frames[1])
  })

  it('8フレームGIF (70ms delay): 各 startAtMs でラウンドトリップ', () => {
    const playback = createPlayback(8, 70)
    for (let i = 0; i < 8; i++) {
      expect(resolveFrameAtTime(playback, playback.frames[i].startAtMs)).toBe(
        playback.frames[i],
      )
    }
  })

  it('時刻がフレーム範囲内ならそのフレームを返す', () => {
    const playback = createPlayback(4) // 0,100,200,300 / duration=400
    expect(resolveFrameAtTime(playback, 50)).toBe(playback.frames[0])
    expect(resolveFrameAtTime(playback, 150)).toBe(playback.frames[1])
    expect(resolveFrameAtTime(playback, 250)).toBe(playback.frames[2])
    expect(resolveFrameAtTime(playback, 350)).toBe(playback.frames[3])
  })

  it('durationMs でラップする', () => {
    const playback = createPlayback(2) // duration=200
    expect(resolveFrameAtTime(playback, 200)).toBe(playback.frames[0])
    expect(resolveFrameAtTime(playback, 300)).toBe(playback.frames[1])
  })
})

describe('resolveTempoClockMs', () => {
  describe('2フレームGIF (durationMs=200), beatDivision=2', () => {
    const dur = 200

    it('ビート0の開始 → 0ms (frame[0]の領域)', () => {
      expect(resolveTempoClockMs(dur, 0, 2, 0)).toBe(0)
    })

    it('ビート0の中間 → 50ms (まだ frame[0]の領域)', () => {
      expect(resolveTempoClockMs(dur, 0.5, 2, 0)).toBe(50)
    })

    it('ビート1の開始 → 100ms (frame[1]の領域)', () => {
      expect(resolveTempoClockMs(dur, 1.0, 2, 0)).toBe(100)
    })

    it('ビート1の中間 → 150ms (まだ frame[1]の領域)', () => {
      expect(resolveTempoClockMs(dur, 1.5, 2, 0)).toBe(150)
    })

    it('ビート2 → 0ms にループ', () => {
      expect(resolveTempoClockMs(dur, 2.0, 2, 0)).toBe(0)
    })
  })

  describe('8フレームGIF (70ms delay, durationMs=560), beatDivision=2', () => {
    const dur = 560

    it('ビート0で前半4フレームを通過', () => {
      const t0 = resolveTempoClockMs(dur, 0, 2, 0) // 0ms
      const t1 = resolveTempoClockMs(dur, 0.25, 2, 0) // 70ms
      const t2 = resolveTempoClockMs(dur, 0.5, 2, 0) // 140ms
      const t3 = resolveTempoClockMs(dur, 0.75, 2, 0) // 210ms

      expect(t0).toBe(0) // frame[0]
      expect(t1).toBe(70) // frame[1]
      expect(t2).toBe(140) // frame[2]
      expect(t3).toBe(210) // frame[3]
    })

    it('ビート1で後半4フレームを通過', () => {
      const t0 = resolveTempoClockMs(dur, 1.0, 2, 0)
      const t1 = resolveTempoClockMs(dur, 1.25, 2, 0)
      const t2 = resolveTempoClockMs(dur, 1.5, 2, 0)
      const t3 = resolveTempoClockMs(dur, 1.75, 2, 0)

      expect(t0).toBe(280) // frame[4]
      expect(t1).toBe(350) // frame[5]
      expect(t2).toBe(420) // frame[6]
      expect(t3).toBe(490) // frame[7]
    })
  })

  describe('全フレームが resolveFrameAtTime で正しいフレームに解決される', () => {
    it.each([
      { frameCount: 2, delay: 100, divisions: 2 },
      { frameCount: 3, delay: 100, divisions: 2 },
      { frameCount: 4, delay: 100, divisions: 4 },
      { frameCount: 8, delay: 70, divisions: 2 },
      { frameCount: 8, delay: 70, divisions: 4 },
      { frameCount: 60, delay: 50, divisions: 2 },
      { frameCount: 60, delay: 50, divisions: 4 },
    ])(
      '$frameCount frames ($delay ms), divisions=$divisions',
      ({ frameCount, delay, divisions }) => {
        const playback = createPlayback(frameCount, delay)
        const dur = playback.durationMs

        // ビート0..divisions*2 の範囲で細かくサンプリング
        for (let beat = 0; beat < divisions * 2; beat += 0.1) {
          const clockMs = resolveTempoClockMs(dur, beat, divisions, 0)
          const frame = resolveFrameAtTime(playback, clockMs)
          expect(frame).not.toBeNull()
          // clockMs が durationMs 未満なら、対応するフレーム範囲内にあるはず
          const normalized = clockMs % dur
          const eps = 0.001
          expect(normalized).toBeGreaterThanOrEqual(frame!.startAtMs - eps)
          expect(normalized).toBeLessThan(frame!.startAtMs + frame!.delayMs + eps)
        }
      },
    )
  })

  describe('phaseOffset', () => {
    it('phaseOffset=0.5 でビート半分ずれる', () => {
      const dur = 200
      // beatProgress=0, phaseOffset=0.5 → rawBeat=0.5
      // beatIndex=0, beatFrac=0.5, step=0, progress=0.25
      expect(resolveTempoClockMs(dur, 0, 2, 0.5)).toBe(50)
    })
  })

  describe('負の beatProgress', () => {
    it('負のbeatProgressでもクラッシュしない', () => {
      const dur = 200
      const result = resolveTempoClockMs(dur, -1, 2, 0)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThan(dur)
    })
  })
})

describe('detectCycleDurationMs', () => {
  // detectCycleDurationMs は内部で computeDHash (OffscreenCanvas) を使うため、
  // Node.js 環境では OffscreenCanvas が undefined → 常に totalDurationMs を返す。
  // ここでは「OffscreenCanvas 未対応時のフォールバック」を検証する。

  it('4フレーム未満 → totalDurationMs を返す', () => {
    const frames = createFrames(3)
    expect(detectCycleDurationMs(frames, 300)).toBe(300)
  })

  it('4フレーム以上でも OffscreenCanvas 未対応なら totalDurationMs', () => {
    const frames = createFrames(8)
    expect(detectCycleDurationMs(frames, 800)).toBe(800)
  })

  it('空フレーム → totalDurationMs', () => {
    expect(detectCycleDurationMs([], 0)).toBe(0)
  })
})

describe('hammingDistance', () => {
  it('同一ハッシュ → 距離0', () => {
    const a = new Uint8Array([0b11001100, 0, 0, 0, 0, 0, 0, 0])
    expect(hammingDistance(a, a)).toBe(0)
  })

  it('全ビット異なる → 距離64', () => {
    const a = new Uint8Array(8).fill(0x00)
    const b = new Uint8Array(8).fill(0xFF)
    expect(hammingDistance(a, b)).toBe(64)
  })

  it('1ビット差 → 距離1', () => {
    const a = new Uint8Array([0b00000000, 0, 0, 0, 0, 0, 0, 0])
    const b = new Uint8Array([0b00000001, 0, 0, 0, 0, 0, 0, 0])
    expect(hammingDistance(a, b)).toBe(1)
  })

  it('複数バイトにまたがる差', () => {
    const a = new Uint8Array([0b11110000, 0b00001111, 0, 0, 0, 0, 0, 0])
    const b = new Uint8Array([0b00001111, 0b11110000, 0, 0, 0, 0, 0, 0])
    expect(hammingDistance(a, b)).toBe(16)
  })
})

describe('cycleDurationMs != durationMs の統合テスト', () => {
  // 2状態GIF: 8フレーム (A,B,A,B,A,B,A,B), 各100ms
  // cycleDurationMs = 200 (最初の2フレーム分), durationMs = 800
  const playback8 = createPlayback(8, 100, 200)

  it('beatDivision=2: beat0はframe[0]のみ、beat1はframe[1]のみ', () => {
    // beat 0: progress [0, 0.5) → clockMs [0, 100)
    for (const bp of [0, 0.25, 0.49]) {
      const clockMs = resolveTempoClockMs(200, bp, 2, 0)
      const frame = resolveFrameAtTime(playback8, clockMs)
      expect(frame).toBe(playback8.frames[0])
    }
    // beat 1: progress [0.5, 1.0) → clockMs [100, 200)
    for (const bp of [1.0, 1.25, 1.49]) {
      const clockMs = resolveTempoClockMs(200, bp, 2, 0)
      const frame = resolveFrameAtTime(playback8, clockMs)
      expect(frame).toBe(playback8.frames[1])
    }
  })

  it('beat2でframe[0]に戻る (ループ)', () => {
    const clockMs = resolveTempoClockMs(200, 2.0, 2, 0)
    const frame = resolveFrameAtTime(playback8, clockMs)
    expect(frame).toBe(playback8.frames[0])
  })

  it('clockMs は常に [0, cycleDurationMs) の範囲', () => {
    for (let bp = 0; bp < 10; bp += 0.1) {
      const clockMs = resolveTempoClockMs(200, bp, 2, 0)
      expect(clockMs).toBeGreaterThanOrEqual(0)
      expect(clockMs).toBeLessThan(200) // clamp で上限保証
    }
  })

  // 通常GIF: cycleDurationMs == durationMs のケースとの対比
  const playbackNormal = createPlayback(8, 100) // cycleDurationMs = 800

  it('通常GIF: beat0で前半4フレーム、beat1で後半4フレーム', () => {
    // beat 0 中盤: progress ≈ 0.25 → clockMs ≈ 200 → frame[2]
    const clockMs = resolveTempoClockMs(800, 0.5, 2, 0)
    const frame = resolveFrameAtTime(playbackNormal, clockMs)
    expect(frame).toBe(playbackNormal.frames[2])
  })
})
