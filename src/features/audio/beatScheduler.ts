type BeatSchedulerConfig = {
  bpm: number | null
  beatOffset: number | null
}

const EPSILON = 0.001

export class BeatScheduler {
  private bpm: number | null = null

  private beatOffset = 0

  private nextBeatTime: number | null = null

  private previousTime = 0

  configure({ bpm, beatOffset }: BeatSchedulerConfig) {
    this.bpm = bpm
    this.beatOffset = beatOffset ?? 0
    this.nextBeatTime = null
    this.previousTime = 0
  }

  reset(currentTime: number) {
    this.previousTime = currentTime
    this.nextBeatTime = this.calculateNextBeatTime(currentTime)
  }

  consume(currentTime: number): boolean {
    if (!this.bpm || this.bpm <= 0) {
      return false
    }

    if (currentTime + EPSILON < this.previousTime) {
      this.reset(currentTime)
    }

    if (this.nextBeatTime === null) {
      this.nextBeatTime = this.calculateNextBeatTime(currentTime)
    }

    if (this.nextBeatTime === null) {
      return false
    }

    const interval = 60 / this.bpm
    let didTrigger = false

    while (currentTime + EPSILON >= this.nextBeatTime) {
      this.nextBeatTime += interval
      didTrigger = true
    }

    this.previousTime = currentTime
    return didTrigger
  }

  private calculateNextBeatTime(currentTime: number) {
    if (!this.bpm || this.bpm <= 0) {
      return null
    }

    const interval = 60 / this.bpm
    if (currentTime <= this.beatOffset) {
      return this.beatOffset
    }

    const beatsSinceOffset = Math.floor((currentTime - this.beatOffset) / interval) + 1
    return this.beatOffset + beatsSinceOffset * interval
  }
}
