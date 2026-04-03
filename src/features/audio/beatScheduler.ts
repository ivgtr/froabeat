type BeatSchedulerConfig = {
  bpm: number | null
  beatOffset: number | null
}

export type BeatEvent = {
  beatIndex: number
  beatTime: number
}

const EPSILON = 0.001
const MAX_BEATS_PER_TICK = 8
const LOOP_DETECTION_THRESHOLD = 10

export class BeatScheduler {
  private bpm: number | null = null

  private beatOffset = 0

  private nextBeatTime: number | null = null

  private nextBeatIndex = 0

  private previousTime = 0

  configure({ bpm, beatOffset }: BeatSchedulerConfig) {
    this.bpm = bpm
    this.beatOffset = beatOffset ?? 0
    this.nextBeatTime = null
    this.nextBeatIndex = 0
    this.previousTime = 0
  }

  reset(currentTime: number) {
    this.previousTime = currentTime
    const next = this.calculateNextBeat(currentTime)
    this.nextBeatTime = next?.time ?? null
    this.nextBeatIndex = next?.index ?? 0
  }

  consume(currentTime: number): BeatEvent | null {
    if (!this.bpm || this.bpm <= 0) {
      return null
    }

    if (
      currentTime + EPSILON < this.previousTime ||
      Math.abs(currentTime - this.previousTime) >= LOOP_DETECTION_THRESHOLD
    ) {
      this.reset(currentTime)
    }

    if (this.nextBeatTime === null) {
      const next = this.calculateNextBeat(currentTime)
      this.nextBeatTime = next?.time ?? null
      this.nextBeatIndex = next?.index ?? 0
    }

    if (this.nextBeatTime === null) {
      return null
    }

    const interval = 60 / this.bpm
    let latestEvent: BeatEvent | null = null
    let guard = 0

    while (currentTime + EPSILON >= this.nextBeatTime && guard < MAX_BEATS_PER_TICK) {
      latestEvent = {
        beatIndex: this.nextBeatIndex,
        beatTime: this.nextBeatTime,
      }
      this.nextBeatIndex += 1
      this.nextBeatTime = this.beatOffset + this.nextBeatIndex * interval
      guard += 1
    }

    if (guard >= MAX_BEATS_PER_TICK) {
      const next = this.calculateNextBeat(currentTime + interval)
      this.nextBeatTime = next?.time ?? null
      this.nextBeatIndex = next?.index ?? 0
    }

    this.previousTime = currentTime
    return latestEvent
  }

  private calculateNextBeat(currentTime: number): { index: number; time: number } | null {
    if (!this.bpm || this.bpm <= 0) {
      return null
    }

    const interval = 60 / this.bpm
    if (currentTime <= this.beatOffset) {
      return {
        index: 0,
        time: this.beatOffset,
      }
    }

    const beatsSinceOffset = Math.floor((currentTime - this.beatOffset) / interval) + 1
    return {
      index: beatsSinceOffset,
      time: this.beatOffset + beatsSinceOffset * interval,
    }
  }
}
