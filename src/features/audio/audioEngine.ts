import type { PlaybackRate } from '../../types/audio'
import type { AudioPlaybackSnapshot, DecodedAudio } from './audioTypes'

type PlaybackEndedHandler = (() => void) | null

export class AudioEngine {
  private context: AudioContext | null = null

  private buffer: AudioBuffer | null = null

  private sourceNode: AudioBufferSourceNode | null = null

  private playbackRate: PlaybackRate = 1.0

  private isLooping = true

  private startedAtContextTime = 0

  private offsetSeconds = 0

  private didManualStop = false

  private onPlaybackEnded: PlaybackEndedHandler = null

  private playPromise: Promise<void> | null = null

  private playGeneration = 0

  setPlaybackEndedHandler(handler: PlaybackEndedHandler) {
    this.onPlaybackEnded = handler
  }

  hasBuffer() {
    return this.buffer !== null
  }

  getDuration() {
    return this.buffer?.duration ?? 0
  }

  async loadFile(file: File): Promise<DecodedAudio> {
    this.stop()
    this.offsetSeconds = 0

    const arrayBuffer = await file.arrayBuffer()
    const decodeInput = arrayBuffer.slice(0)
    const context = this.getContext()
    const audioBuffer = await context.decodeAudioData(decodeInput)
    this.buffer = audioBuffer

    return {
      file,
      audioBuffer,
      duration: audioBuffer.duration,
    }
  }

  async play() {
    if (!this.buffer || this.sourceNode) {
      return
    }

    if (this.playPromise) {
      await this.playPromise
      return
    }

    const generationAtRequest = this.playGeneration
    this.playPromise = (async () => {
      const context = await this.ensureContextRunning()
      if (
        generationAtRequest !== this.playGeneration ||
        this.sourceNode !== null ||
        !this.buffer
      ) {
        return
      }

      const source = context.createBufferSource()
      source.buffer = this.buffer
      source.loop = this.isLooping
      source.playbackRate.setValueAtTime(this.playbackRate, context.currentTime)
      source.connect(context.destination)
      source.onended = () => {
        if (this.didManualStop) {
          this.didManualStop = false
          return
        }

        this.sourceNode = null
        this.offsetSeconds = 0
        this.startedAtContextTime = 0
        this.onPlaybackEnded?.()
      }

      source.start(0, this.normalizeTime(this.offsetSeconds))
      this.sourceNode = source
      this.startedAtContextTime = context.currentTime
    })()

    try {
      await this.playPromise
    } finally {
      this.playPromise = null
    }
  }

  pause() {
    if (!this.sourceNode) {
      return
    }

    this.captureCurrentOffset()
    this.stopSourceOnly()
  }

  stop() {
    this.playGeneration += 1
    this.stopSourceOnly()
    this.offsetSeconds = 0
    this.startedAtContextTime = 0
  }

  setLooping(isLooping: boolean) {
    this.isLooping = isLooping
    if (this.sourceNode) {
      this.sourceNode.loop = isLooping
    }
  }

  setPlaybackRate(playbackRate: PlaybackRate) {
    const context = this.context
    if (this.sourceNode) {
      this.captureCurrentOffset()
      this.sourceNode.playbackRate.setValueAtTime(
        playbackRate,
        context?.currentTime ?? 0,
      )
    }

    this.playbackRate = playbackRate
  }

  getCurrentTime() {
    if (!this.buffer) {
      return 0
    }

    if (!this.sourceNode) {
      return this.normalizeTime(this.offsetSeconds)
    }

    const context = this.context
    if (!context) {
      return this.normalizeTime(this.offsetSeconds)
    }

    const elapsed = (context.currentTime - this.startedAtContextTime) * this.playbackRate
    return this.normalizeTime(this.offsetSeconds + elapsed)
  }

  getSnapshot(): AudioPlaybackSnapshot {
    return {
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      isPlaying: this.sourceNode !== null,
      playbackRate: this.playbackRate,
      isLooping: this.isLooping,
    }
  }

  getContextState(): AudioContextState | 'none' {
    if (!this.context) {
      return 'none'
    }

    return this.context.state
  }

  dispose() {
    this.stop()
    this.buffer = null
    if (this.context && this.context.state !== 'closed') {
      void this.context.close()
    }
    this.context = null
  }

  private captureCurrentOffset() {
    const context = this.context
    if (!this.sourceNode) {
      return
    }

    if (!context) {
      return
    }

    const elapsed = (context.currentTime - this.startedAtContextTime) * this.playbackRate
    this.offsetSeconds = this.normalizeTime(this.offsetSeconds + elapsed)
    this.startedAtContextTime = context.currentTime
  }

  private stopSourceOnly() {
    this.playGeneration += 1
    if (!this.sourceNode) {
      return
    }

    this.didManualStop = true
    this.sourceNode.stop()
    this.sourceNode.disconnect()
    this.sourceNode.onended = null
    this.sourceNode = null
  }

  private normalizeTime(rawTime: number) {
    if (!this.buffer) {
      return 0
    }

    if (this.buffer.duration <= 0) {
      return 0
    }

    if (this.isLooping) {
      const modulo = rawTime % this.buffer.duration
      return modulo < 0 ? modulo + this.buffer.duration : modulo
    }

    return Math.min(this.buffer.duration, Math.max(0, rawTime))
  }

  private getContext() {
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext()
    }

    return this.context
  }

  private async ensureContextRunning() {
    const context = this.getContext()

    if (context.state !== 'running') {
      await context.resume()
    }

    if (context.state !== 'running') {
      throw new Error(`AudioContext is not running: ${context.state}`)
    }

    return context
  }
}
