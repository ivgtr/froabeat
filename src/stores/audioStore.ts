import { create } from 'zustand'
import {
  PLAYBACK_RATE_STEPS,
  createInitialAudioState,
  type AudioStore,
  type PlaybackRate,
} from '../types/audio'

const clampPlaybackRateStep = (
  currentRate: PlaybackRate,
  direction: -1 | 1,
): PlaybackRate => {
  const currentIndex = PLAYBACK_RATE_STEPS.indexOf(currentRate)
  const nextIndex = Math.min(
    PLAYBACK_RATE_STEPS.length - 1,
    Math.max(0, currentIndex + direction),
  )

  return PLAYBACK_RATE_STEPS[nextIndex]
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  ...createInitialAudioState(),
  setAudioFile: (file, url, duration = 0) => {
    set({
      file,
      url,
      duration,
      currentTime: 0,
      isPlaying: false,
    })
  },
  clearAudioFile: () => {
    set(createInitialAudioState())
  },
  setPlaying: (isPlaying) => {
    set({ isPlaying })
  },
  togglePlaying: () => {
    set((state) => ({ isPlaying: !state.isPlaying }))
  },
  setPlaybackRate: (rate) => {
    set({ playbackRate: rate })
  },
  setPlaybackRateByStep: (direction) => {
    const nextRate = clampPlaybackRateStep(get().playbackRate, direction)
    set({ playbackRate: nextRate })
  },
  setCurrentTime: (time) => {
    set({ currentTime: time })
  },
  setDuration: (duration) => {
    set({ duration })
  },
  setLooping: (isLooping) => {
    set({ isLooping })
  },
  setBpm: (bpm) => {
    set({ bpm })
  },
  setBeatOffset: (beatOffset) => {
    set({ beatOffset })
  },
  setStatus: (status, statusMessage = null) => {
    set({ status, statusMessage })
  },
  setWarningMessage: (warningMessage) => {
    set({ warningMessage })
  },
  markBeat: (beatEventTime) => {
    set((state) => ({
      beatEventTime,
      beatPulse: state.beatPulse + 1,
    }))
  },
}))
