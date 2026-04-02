import type { TempoAnalysisResult } from './audioTypes'

const MIN_BPM = 70
const MAX_BPM = 180
const FALLBACK_BPM = 120
const WINDOW_SIZE = 1024
const HOP_SIZE = 512
const MIN_PEAK_INTERVAL_SECONDS = 0.08

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
  const frameCount = Math.floor((signal.length - WINDOW_SIZE) / HOP_SIZE)
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

  const mean = onsets.reduce((sum, value) => sum + value, 0) / onsets.length
  const variance =
    onsets.reduce((sum, value) => sum + (value - mean) ** 2, 0) / onsets.length
  const std = Math.sqrt(variance)
  const threshold = mean + std * 0.6

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

      const bucket = Math.round(bpm)
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

  return bestBpm
}

export const analyzeTempo = (audioBuffer: AudioBuffer): TempoAnalysisResult => {
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
  const bpm = estimatedBpm ?? FALLBACK_BPM
  const firstPeakFrame = peaks[0]
  const beatOffset = (firstPeakFrame * HOP_SIZE) / audioBuffer.sampleRate

  return {
    bpm,
    beatOffset,
    usedFallback: estimatedBpm === null,
  }
}
