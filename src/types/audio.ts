export const PLAYBACK_RATE_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const

export type PlaybackRate = (typeof PLAYBACK_RATE_STEPS)[number]

export type AudioLoadStatus = 'idle' | 'loading' | 'analyzing' | 'ready' | 'error'

export type AudioState = {
  file: File | null
  url: string | null
  isPlaying: boolean
  playbackRate: PlaybackRate
  currentTime: number
  duration: number
  bpm: number | null
  beatOffset: number | null
  isLooping: boolean
  status: AudioLoadStatus
  statusMessage: string | null
  warningMessage: string | null
  beatPulse: number
  beatEventTime: number | null
  beatIndex: number
  beatPhase: number
  beatProgress: number
  beatInterval: number
  syncResetToken: number
}

export type AudioActions = {
  setAudioFile: (file: File, url: string, duration?: number) => void
  clearAudioFile: () => void
  setPlaying: (isPlaying: boolean) => void
  togglePlaying: () => void
  setPlaybackRate: (rate: PlaybackRate) => void
  setPlaybackRateByStep: (direction: -1 | 1) => void
  setCurrentTime: (time: number) => void
  setPlaybackTime: (time: number) => void
  setDuration: (duration: number) => void
  setLooping: (isLooping: boolean) => void
  setBpm: (bpm: number | null) => void
  setBeatOffset: (offset: number | null) => void
  setStatus: (status: AudioLoadStatus, message?: string | null) => void
  setWarningMessage: (message: string | null) => void
  markBeat: (time: number, beatIndex: number) => void
  resetSyncBase: (time: number) => void
}

export type AudioStore = AudioState & AudioActions

export const createInitialAudioState = (): AudioState => ({
  file: null,
  url: null,
  isPlaying: false,
  playbackRate: 1.0,
  currentTime: 0,
  duration: 0,
  bpm: null,
  beatOffset: null,
  isLooping: true,
  status: 'idle',
  statusMessage: null,
  warningMessage: null,
  beatPulse: 0,
  beatEventTime: null,
  beatIndex: 0,
  beatPhase: 0,
  beatProgress: 0,
  beatInterval: 0.5,
  syncResetToken: 0,
})
