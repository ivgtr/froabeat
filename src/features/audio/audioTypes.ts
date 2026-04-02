export type DecodedAudio = {
  file: File
  audioBuffer: AudioBuffer
  duration: number
}

export type AudioPlaybackSnapshot = {
  currentTime: number
  duration: number
  isPlaying: boolean
  playbackRate: number
  isLooping: boolean
}

export type TempoAnalysisResult = {
  bpm: number
  beatOffset: number
  usedFallback: boolean
}
