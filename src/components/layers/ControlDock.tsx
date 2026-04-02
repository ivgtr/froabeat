import { PLAYBACK_RATE_STEPS } from '../../types/audio'
import { useAudioStore } from '../../stores/audioStore'

function ControlDock() {
  const isPlaying = useAudioStore((state) => state.isPlaying)
  const playbackRate = useAudioStore((state) => state.playbackRate)
  const togglePlaying = useAudioStore((state) => state.togglePlaying)
  const setPlaybackRateByStep = useAudioStore(
    (state) => state.setPlaybackRateByStep,
  )
  const isAtMinRate = playbackRate === PLAYBACK_RATE_STEPS[0]
  const isAtMaxRate =
    playbackRate === PLAYBACK_RATE_STEPS[PLAYBACK_RATE_STEPS.length - 1]

  return (
    <aside className="control-dock" aria-label="Playback controls">
      <button type="button" className="play-button" onClick={togglePlaying}>
        {isPlaying ? '一時停止' : '再生'}
      </button>
      <div className="rate-control">
        <button
          type="button"
          aria-label="再生速度を下げる"
          onClick={() => setPlaybackRateByStep(-1)}
          disabled={isAtMinRate}
        >
          ◀
        </button>
        <p>{playbackRate.toFixed(2).replace(/\.00$/, '.0')}x</p>
        <button
          type="button"
          aria-label="再生速度を上げる"
          onClick={() => setPlaybackRateByStep(1)}
          disabled={isAtMaxRate}
        >
          ▶
        </button>
      </div>
      <p className="dock-caption">Phase 1: UI Scaffold</p>
    </aside>
  )
}

export default ControlDock
