import { useAudioStore } from '../../stores/audioStore'
import { PLAYBACK_RATE_STEPS } from '../../types/audio'

type ControlDockProps = {
  onTogglePlay: () => void
}

function ControlDock({ onTogglePlay }: ControlDockProps) {
  const file = useAudioStore((state) => state.file)
  const isPlaying = useAudioStore((state) => state.isPlaying)
  const playbackRate = useAudioStore((state) => state.playbackRate)
  const currentTime = useAudioStore((state) => state.currentTime)
  const duration = useAudioStore((state) => state.duration)
  const bpm = useAudioStore((state) => state.bpm)
  const status = useAudioStore((state) => state.status)
  const statusMessage = useAudioStore((state) => state.statusMessage)
  const setPlaybackRateByStep = useAudioStore(
    (state) => state.setPlaybackRateByStep,
  )

  const hasAudio = file !== null
  const isAtMinRate = playbackRate === PLAYBACK_RATE_STEPS[0]
  const isAtMaxRate =
    playbackRate === PLAYBACK_RATE_STEPS[PLAYBACK_RATE_STEPS.length - 1]
  const isBusy = status === 'loading' || status === 'analyzing'
  const canPlay = hasAudio && !isBusy

  const formatTime = (value: number) => {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0
    const minutes = Math.floor(safe / 60)
    const seconds = Math.floor(safe % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const rateLabel = playbackRate !== 1
    ? `${playbackRate.toFixed(1)}x`
    : null

  return (
    <aside className="control-dock" aria-label="Playback controls">
      <div className="dock-transport">
        <button
          type="button"
          className="dock-btn"
          aria-label="低速"
          onClick={() => setPlaybackRateByStep(-1)}
          disabled={!hasAudio || isAtMinRate || isBusy}
        >
          «
        </button>
        <button
          type="button"
          className="dock-btn dock-btn-play"
          onClick={onTogglePlay}
          disabled={!canPlay && !isPlaying}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          className="dock-btn"
          aria-label="高速"
          onClick={() => setPlaybackRateByStep(1)}
          disabled={!hasAudio || isAtMaxRate || isBusy}
        >
          »
        </button>
      </div>
      <p className="dock-info">
        {bpm ? `${bpm} BPM` : '-- BPM'}
        {rateLabel ? ` · ${rateLabel}` : ''}
        {` · ${formatTime(currentTime)} / ${formatTime(duration)}`}
      </p>
      {statusMessage && status !== 'ready' && (
        <p className={`dock-status is-${status}`} aria-live="polite">
          {statusMessage}
        </p>
      )}
    </aside>
  )
}

export default ControlDock
