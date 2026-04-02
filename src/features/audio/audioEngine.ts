import type { PlaybackRate } from '../../types/audio'
import type { AudioPlaybackSnapshot, DecodedAudio } from './audioTypes'

type PlaybackEndedHandler = (() => void) | null

export class AudioEngine {
  private readonly context: AudioContext

  private buffer: AudioBuffer | null = null

  private sourceNode: AudioBufferSourceNode | null = null

  private playbackRate: PlaybackRate = 1.0

  private isLooping = true

  private startedAtContextTime = 0

  private offsetSeconds = 0

  private didManualStop = false

  private onPlaybackEnded: PlaybackEndedHandler = null

  constructor() {
    this.context = new AudioContext()
  }

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
    const audioBuffer = await this.context.decodeAudioData(decodeInput)
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

    if (this.context.state === 'suspended') {
      await this.context.resume()
    }

    const source = this.context.createBufferSource()
    source.buffer = this.buffer
    source.loop = this.isLooping
    source.playbackRate.setValueAtTime(this.playbackRate, this.context.currentTime)
    source.connect(this.context.destination)
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
    this.startedAtContextTime = this.context.currentTime
  }

  pause() {
    if (!this.sourceNode) {
      return
    }

    this.captureCurrentOffset()
    this.stopSourceOnly()
  }

  stop() {
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
    if (this.sourceNode) {
      this.captureCurrentOffset()
      this.sourceNode.playbackRate.setValueAtTime(playbackRate, this.context.currentTime)
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

    const elapsed = (this.context.currentTime - this.startedAtContextTime) * this.playbackRate
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

  dispose() {
    this.stop()
    this.buffer = null
    if (this.context.state !== 'closed') {
      void this.context.close()
    }
  }

  private captureCurrentOffset() {
    if (!this.sourceNode) {
      return
    }

    const elapsed = (this.context.currentTime - this.startedAtContextTime) * this.playbackRate
    this.offsetSeconds = this.normalizeTime(this.offsetSeconds + elapsed)
    this.startedAtContextTime = this.context.currentTime
  }

  private stopSourceOnly() {
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
}
