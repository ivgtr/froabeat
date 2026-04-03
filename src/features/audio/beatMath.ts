type BeatMetricsInput = {
  currentTime: number
  bpm: number | null
  beatOffset: number | null
}

export type BeatMetrics = {
  beatProgress: number
  beatIndex: number
  beatPhase: number
  beatInterval: number
}

const DEFAULT_INTERVAL_SECONDS = 0.5

const normalizePhase = (value: number): number => {
  const next = value % 1
  return next < 0 ? next + 1 : next
}

export const calculateBeatMetrics = ({
  currentTime,
  bpm,
  beatOffset,
}: BeatMetricsInput): BeatMetrics => {
  if (!bpm || bpm <= 0) {
    return {
      beatProgress: 0,
      beatIndex: 0,
      beatPhase: 0,
      beatInterval: DEFAULT_INTERVAL_SECONDS,
    }
  }

  const interval = 60 / bpm
  const offset = beatOffset ?? 0
  const delta = currentTime - offset
  const beatProgress = delta / interval
  const beatIndex = Math.max(0, Math.floor(beatProgress))
  const beatPhase = normalizePhase(beatProgress)

  return {
    beatProgress,
    beatIndex,
    beatPhase,
    beatInterval: interval,
  }
}
