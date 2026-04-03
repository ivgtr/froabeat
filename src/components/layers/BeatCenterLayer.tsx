import type { CSSProperties } from 'react'
import { useAudioStore } from '../../stores/audioStore'
import { useBoardStore } from '../../stores/boardStore'

function BeatCenterLayer() {
  const beatPulse = useAudioStore((state) => state.beatPulse)
  const bpm = useAudioStore((state) => state.bpm)
  const isPlaying = useAudioStore((state) => state.isPlaying)
  const playbackRate = useAudioStore((state) => state.playbackRate)
  const status = useAudioStore((state) => state.status)
  const file = useAudioStore((state) => state.file)
  const itemCount = useBoardStore((state) => state.items.length)
  const isEmpty = file === null && itemCount === 0

  const beatIntervalMs = bpm ? 60000 / bpm : 500
  const pulseDurationMs = Math.min(760, Math.max(220, beatIntervalMs * 0.82))
  const ringDurationMs = pulseDurationMs + 260
  const speedModifier = Math.min(1.5, Math.max(0.8, playbackRate))
  const isAnalyzing = status === 'loading' || status === 'analyzing'
  const isErrored = status === 'error'

  const coreStyle: CSSProperties = {
    animationDuration: `${pulseDurationMs / speedModifier}ms`,
  }
  const ringAStyle: CSSProperties = {
    animationDuration: `${ringDurationMs / speedModifier}ms`,
  }
  const ringBStyle: CSSProperties = {
    animationDuration: `${(ringDurationMs + 70) / speedModifier}ms`,
    animationDelay: '30ms',
  }
  const ringCStyle: CSSProperties = {
    animationDuration: `${(ringDurationMs + 130) / speedModifier}ms`,
    animationDelay: '60ms',
  }

  return (
    <section className="beat-center-layer" aria-label="Beat center visualization">
      <div
        key={`ring-a-${beatPulse}`}
        className={`beat-ring ring-a ${isPlaying ? 'is-animated' : ''} ${isAnalyzing ? 'is-soft' : ''}`}
        style={ringAStyle}
      />
      <div
        key={`ring-b-${beatPulse}`}
        className={`beat-ring ring-b ${isPlaying ? 'is-animated' : ''} ${isAnalyzing ? 'is-soft' : ''}`}
        style={ringBStyle}
      />
      <div
        key={`ring-c-${beatPulse}`}
        className={`beat-ring ring-c ${isPlaying ? 'is-animated' : ''} ${isAnalyzing ? 'is-soft' : ''}`}
        style={ringCStyle}
      />
      <div
        key={`core-${beatPulse}`}
        className={`beat-core ${isPlaying ? 'is-animated' : ''} ${isErrored ? 'is-error' : ''}`}
        style={coreStyle}
      />
      <p className={`beat-meta ${isAnalyzing ? 'is-analyzing' : ''} ${isErrored ? 'is-error' : ''}`}>
        {isPlaying
          ? `BEAT ${bpm ?? '--'} BPM`
          : isAnalyzing
            ? 'ANALYZING...'
            : isErrored
              ? 'AUDIO ERROR'
              : isEmpty
                ? 'DROP / DBL-CLICK'
                : 'STANDBY'}
      </p>
    </section>
  )
}

export default BeatCenterLayer
