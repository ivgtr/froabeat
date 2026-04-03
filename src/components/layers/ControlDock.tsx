import { PLAYBACK_RATE_STEPS } from '../../types/audio'
import { useAudioStore } from '../../stores/audioStore'

type ControlDockProps = {
  onTogglePlay: () => void
}

function ControlDock({ onTogglePlay }: ControlDockProps) {
  const file = useAudioStore((state) => state.file)
  const isPlaying = useAudioStore((state) => state.isPlaying)
  const isLooping = useAudioStore((state) => state.isLooping)
  const playbackRate = useAudioStore((state) => state.playbackRate)
  const currentTime = useAudioStore((state) => state.currentTime)
  const duration = useAudioStore((state) => state.duration)
  const bpm = useAudioStore((state) => state.bpm)
  const status = useAudioStore((state) => state.status)
  const statusMessage = useAudioStore((state) => state.statusMessage)
  const warningMessage = useAudioStore((state) => state.warningMessage)
  const setLooping = useAudioStore((state) => state.setLooping)
  const setPlaybackRateByStep = useAudioStore(
    (state) => state.setPlaybackRateByStep,
  )

  const hasAudio = file !== null
  const isAtMinRate = playbackRate === PLAYBACK_RATE_STEPS[0]
  const isAtMaxRate =
    playbackRate === PLAYBACK_RATE_STEPS[PLAYBACK_RATE_STEPS.length - 1]
  const isBusy = status === 'loading' || status === 'analyzing'
  const canStartPlayback = hasAudio && !isBusy
  const canPausePlayback = hasAudio && isPlaying

  const formatTime = (value: number) => {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0
    const minutes = Math.floor(safe / 60)
    const seconds = Math.floor(safe % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <aside className="control-dock" aria-label="Playback controls">
      <p className={`dock-badge is-${status}`}>{status.toUpperCase()}</p>
      <button
        type="button"
        className="play-button"
        onClick={onTogglePlay}
        disabled={!canStartPlayback && !canPausePlayback}
      >
        {isPlaying ? '一時停止' : '再生'}
      </button>
      <div className="rate-control">
        <button
          type="button"
          aria-label="再生速度を下げる"
          onClick={() => setPlaybackRateByStep(-1)}
          disabled={!hasAudio || isAtMinRate || isBusy}
        >
          ◀
        </button>
        <p>{playbackRate.toFixed(2).replace(/\.00$/, '.0')}x</p>
        <button
          type="button"
          aria-label="再生速度を上げる"
          onClick={() => setPlaybackRateByStep(1)}
          disabled={!hasAudio || isAtMaxRate || isBusy}
        >
          ▶
        </button>
      </div>
      <div className="dock-row">
        <button
          type="button"
          className={`loop-button ${isLooping ? 'is-active' : ''}`}
          onClick={() => setLooping(!isLooping)}
          disabled={!hasAudio || isBusy}
        >
          ループ: {isLooping ? 'ON' : 'OFF'}
        </button>
        <p className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </p>
      </div>
      <p className="dock-caption">BPM: {bpm ?? '--'}</p>
      {statusMessage && (
        <p className={`dock-status is-${status}`} aria-live="polite">
          {statusMessage}
        </p>
      )}
      {warningMessage && (
        <p className="dock-warning" aria-live="polite">
          {warningMessage}
        </p>
      )}
    </aside>
  )
}

export default ControlDock
