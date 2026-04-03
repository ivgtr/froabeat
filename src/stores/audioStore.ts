import { create } from 'zustand'
import {
  PLAYBACK_RATE_STEPS,
  createInitialAudioState,
  type AudioStore,
  type PlaybackRate,
} from '../types/audio'
import { calculateBeatMetrics } from '../features/audio/beatMath'

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
    const nextMetrics = calculateBeatMetrics({
      currentTime: 0,
      bpm: get().bpm,
      beatOffset: get().beatOffset,
    })
    set({
      file,
      url,
      duration,
      currentTime: 0,
      isPlaying: false,
      beatIndex: nextMetrics.beatIndex,
      beatPhase: nextMetrics.beatPhase,
      beatProgress: nextMetrics.beatProgress,
      beatInterval: nextMetrics.beatInterval,
      syncResetToken: get().syncResetToken + 1,
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
  setPlaybackTime: (time) => {
    const { bpm, beatOffset } = get()
    const nextMetrics = calculateBeatMetrics({
      currentTime: time,
      bpm,
      beatOffset,
    })
    set({
      currentTime: time,
      beatIndex: nextMetrics.beatIndex,
      beatPhase: nextMetrics.beatPhase,
      beatProgress: nextMetrics.beatProgress,
      beatInterval: nextMetrics.beatInterval,
    })
  },
  setDuration: (duration) => {
    set({ duration })
  },
  setLooping: (isLooping) => {
    set({ isLooping })
  },
  setBpm: (bpm) => {
    const nextMetrics = calculateBeatMetrics({
      currentTime: get().currentTime,
      bpm,
      beatOffset: get().beatOffset,
    })
    set({
      bpm,
      beatIndex: nextMetrics.beatIndex,
      beatPhase: nextMetrics.beatPhase,
      beatProgress: nextMetrics.beatProgress,
      beatInterval: nextMetrics.beatInterval,
      syncResetToken: get().syncResetToken + 1,
    })
  },
  setBeatOffset: (beatOffset) => {
    const nextMetrics = calculateBeatMetrics({
      currentTime: get().currentTime,
      bpm: get().bpm,
      beatOffset,
    })
    set({
      beatOffset,
      beatIndex: nextMetrics.beatIndex,
      beatPhase: nextMetrics.beatPhase,
      beatProgress: nextMetrics.beatProgress,
      beatInterval: nextMetrics.beatInterval,
      syncResetToken: get().syncResetToken + 1,
    })
  },
  setStatus: (status, statusMessage = null) => {
    set({ status, statusMessage })
  },
  setWarningMessage: (warningMessage) => {
    set({ warningMessage })
  },
  markBeat: (beatEventTime, beatIndex) => {
    set((state) => ({
      beatEventTime,
      beatIndex,
      beatPulse: state.beatPulse + 1,
    }))
  },
  resetSyncBase: (time) => {
    const { bpm, beatOffset } = get()
    const nextMetrics = calculateBeatMetrics({
      currentTime: time,
      bpm,
      beatOffset,
    })
    set((state) => ({
      currentTime: time,
      beatIndex: nextMetrics.beatIndex,
      beatPhase: nextMetrics.beatPhase,
      beatProgress: nextMetrics.beatProgress,
      beatInterval: nextMetrics.beatInterval,
      syncResetToken: state.syncResetToken + 1,
    }))
  },
}))
