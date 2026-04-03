import type { TempoAnalysisResult } from './audioTypes'

const MIN_BPM = 70
const MAX_BPM = 180
const FALLBACK_BPM = 120
const WINDOW_SIZE = 1024
const HOP_SIZE = 512
const MIN_PEAK_INTERVAL_SECONDS = 0.08
const MIN_ANALYZABLE_SECONDS = 1.0
const FRAME_ANALYSIS_LIMIT = 28000

const normalizeBpm = (rawBpm: number) => {
  let bpm = rawBpm
  while (bpm < MIN_BPM) {
    bpm *= 2
  }
  while (bpm > MAX_BPM) {
    bpm /= 2
  }
  return bpm
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

const createMonoSignal = (audioBuffer: AudioBuffer) => {
  const channels = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  const mono = new Float32Array(length)

  for (let channel = 0; channel < channels; channel += 1) {
    const data = audioBuffer.getChannelData(channel)
    for (let index = 0; index < length; index += 1) {
      mono[index] += data[index] / channels
    }
  }

  return mono
}

const calculateEnvelope = (signal: Float32Array) => {
  const frameCount = Math.min(
    FRAME_ANALYSIS_LIMIT,
    Math.floor((signal.length - WINDOW_SIZE) / HOP_SIZE) + 1,
  )
  if (frameCount <= 0) {
    return []
  }

  const envelope = new Array<number>(frameCount)

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * HOP_SIZE
    let sumSquares = 0
    for (let sample = start; sample < start + WINDOW_SIZE; sample += 1) {
      const value = signal[sample]
      sumSquares += value * value
    }
    envelope[frame] = Math.sqrt(sumSquares / WINDOW_SIZE)
  }

  return envelope
}

const detectPeaks = (envelope: number[], sampleRate: number) => {
  const onsets: number[] = []
  for (let index = 1; index < envelope.length; index += 1) {
    const delta = envelope[index] - envelope[index - 1]
    onsets.push(delta > 0 ? delta : 0)
  }

  if (onsets.length === 0) {
    return []
  }

  const sorted = [...onsets].sort((a, b) => a - b)
  const percentileIndex = clamp(Math.floor(sorted.length * 0.85), 0, sorted.length - 1)
  const p85 = sorted[percentileIndex]
  const mean = onsets.reduce((sum, value) => sum + value, 0) / onsets.length
  const threshold = Math.max(p85 * 0.45, mean * 1.8)

  const minimumGapFrames = Math.floor((MIN_PEAK_INTERVAL_SECONDS * sampleRate) / HOP_SIZE)
  const peaks: number[] = []
  let lastPeakIndex = -minimumGapFrames

  for (let index = 1; index < onsets.length - 1; index += 1) {
    const value = onsets[index]
    if (value < threshold) {
      continue
    }

    const isLocalPeak = value > onsets[index - 1] && value >= onsets[index + 1]
    const isFarEnough = index - lastPeakIndex >= minimumGapFrames

    if (isLocalPeak && isFarEnough) {
      peaks.push(index)
      lastPeakIndex = index
    }
  }

  return peaks
}

const estimateBpmFromPeaks = (peaks: number[], sampleRate: number) => {
  const histogram = new Map<number, number>()

  for (let index = 0; index < peaks.length; index += 1) {
    for (let offset = 1; offset <= 8; offset += 1) {
      const next = peaks[index + offset]
      if (next === undefined) {
        break
      }

      const frameDelta = next - peaks[index]
      if (frameDelta <= 0) {
        continue
      }

      const seconds = (frameDelta * HOP_SIZE) / sampleRate
      if (seconds <= 0) {
        continue
      }

      const bpm = normalizeBpm(60 / seconds)
      if (bpm < MIN_BPM || bpm > MAX_BPM) {
        continue
      }

      const bucket = clamp(Math.round(bpm), MIN_BPM, MAX_BPM)
      const weight = 1 / offset
      histogram.set(bucket, (histogram.get(bucket) ?? 0) + weight)
    }
  }

  if (histogram.size === 0) {
    return null
  }

  let bestBpm: number | null = null
  let bestScore = -Infinity
  for (const [bpm, score] of histogram.entries()) {
    if (score > bestScore) {
      bestScore = score
      bestBpm = bpm
    }
  }

  if (bestBpm === null) {
    return null
  }

  // 隣接バケットを含めた平滑化でジッターを抑える。
  let weightedSum = 0
  let scoreSum = 0
  for (let bpm = bestBpm - 2; bpm <= bestBpm + 2; bpm += 1) {
    const score = histogram.get(bpm)
    if (!score) {
      continue
    }
    weightedSum += bpm * score
    scoreSum += score
  }

  if (scoreSum <= 0) {
    return bestBpm
  }

  return Math.round(weightedSum / scoreSum)
}

export const analyzeTempo = (audioBuffer: AudioBuffer): TempoAnalysisResult => {
  if (audioBuffer.duration < MIN_ANALYZABLE_SECONDS) {
    return {
      bpm: FALLBACK_BPM,
      beatOffset: 0,
      usedFallback: true,
    }
  }

  const mono = createMonoSignal(audioBuffer)
  const envelope = calculateEnvelope(mono)
  const peaks = detectPeaks(envelope, audioBuffer.sampleRate)

  if (peaks.length < 2) {
    return {
      bpm: FALLBACK_BPM,
      beatOffset: 0,
      usedFallback: true,
    }
  }

  const estimatedBpm = estimateBpmFromPeaks(peaks, audioBuffer.sampleRate)
  const bpm = clamp(estimatedBpm ?? FALLBACK_BPM, MIN_BPM, MAX_BPM)
  const firstPeakFrame = peaks[0]
  const beatOffset = (firstPeakFrame * HOP_SIZE) / audioBuffer.sampleRate

  return {
    bpm,
    beatOffset,
    usedFallback: estimatedBpm === null,
  }
}
