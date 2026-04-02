import { useCallback, useEffect, useRef } from 'react'
import AppShell from './components/layout/AppShell'
import BeatCenterLayer from './components/layers/BeatCenterLayer'
import ControlDock from './components/layers/ControlDock'
import DropOverlay from './components/layers/DropOverlay'
import MainCanvasLayer from './components/layers/MainCanvasLayer'
import { analyzeTempo } from './features/audio/analyzeTempo'
import { AudioEngine } from './features/audio/audioEngine'
import { BeatScheduler } from './features/audio/beatScheduler'
import { useFileInput } from './features/file-input/useFileInput'
import { useAudioStore } from './stores/audioStore'
import './styles/app.css'

function App() {
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine())
  const beatSchedulerRef = useRef<BeatScheduler>(new BeatScheduler())
  const objectUrlRef = useRef<string | null>(null)

  const isPlaying = useAudioStore((state) => state.isPlaying)
  const playbackRate = useAudioStore((state) => state.playbackRate)
  const isLooping = useAudioStore((state) => state.isLooping)
  const bpm = useAudioStore((state) => state.bpm)
  const beatOffset = useAudioStore((state) => state.beatOffset)
  const setAudioFile = useAudioStore((state) => state.setAudioFile)
  const setPlaying = useAudioStore((state) => state.setPlaying)
  const setCurrentTime = useAudioStore((state) => state.setCurrentTime)
  const setDuration = useAudioStore((state) => state.setDuration)
  const setBpm = useAudioStore((state) => state.setBpm)
  const setBeatOffset = useAudioStore((state) => state.setBeatOffset)
  const setStatus = useAudioStore((state) => state.setStatus)
  const setWarningMessage = useAudioStore((state) => state.setWarningMessage)
  const markBeat = useAudioStore((state) => state.markBeat)

  const handleAudioFile = useCallback(
    async (file: File) => {
      const engine = audioEngineRef.current

      setStatus('loading', '音声ファイルを読み込み中...')
      setWarningMessage(null)
      setPlaying(false)

      try {
        const decoded = await engine.loadFile(file)
        engine.setLooping(isLooping)
        engine.setPlaybackRate(playbackRate)

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
        }
        const url = URL.createObjectURL(file)
        objectUrlRef.current = url

        setAudioFile(file, url, decoded.duration)
        setDuration(decoded.duration)
        setCurrentTime(0)

        setStatus('analyzing', 'テンポを解析中...')
        const tempo = analyzeTempo(decoded.audioBuffer)
        setBpm(tempo.bpm)
        setBeatOffset(tempo.beatOffset)
        setWarningMessage(
          tempo.usedFallback
            ? 'テンポ推定が不安定なため 120 BPM を仮設定しました。'
            : null,
        )

        beatSchedulerRef.current.configure({
          bpm: tempo.bpm,
          beatOffset: tempo.beatOffset,
        })
        beatSchedulerRef.current.reset(0)

        setStatus('ready', `${file.name} を読み込みました`)
      } catch (error) {
        console.error(error)
        setStatus('error', '音声の読み込みに失敗しました。')
        setWarningMessage('対応形式またはファイル状態を確認してください。')
        setBpm(null)
        setBeatOffset(null)
        setCurrentTime(0)
      }
    },
    [
      isLooping,
      playbackRate,
      setAudioFile,
      setBeatOffset,
      setBpm,
      setCurrentTime,
      setDuration,
      setPlaying,
      setStatus,
      setWarningMessage,
    ],
  )

  const {
    fileInputRef,
    isDragging,
    helperMessage,
    errorMessage,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    openFilePicker,
    handleFileInputChange,
  } = useFileInput({ onAudioFile: handleAudioFile })

  useEffect(() => {
    const engine = audioEngineRef.current
    engine.setPlaybackEndedHandler(() => {
      setPlaying(false)
      setCurrentTime(0)
      beatSchedulerRef.current.reset(0)
    })

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      engine.dispose()
    }
  }, [setCurrentTime, setPlaying])

  useEffect(() => {
    audioEngineRef.current.setLooping(isLooping)
  }, [isLooping])

  useEffect(() => {
    audioEngineRef.current.setPlaybackRate(playbackRate)
  }, [playbackRate])

  useEffect(() => {
    beatSchedulerRef.current.configure({ bpm, beatOffset })
    beatSchedulerRef.current.reset(audioEngineRef.current.getCurrentTime())
  }, [beatOffset, bpm])

  useEffect(() => {
    const engine = audioEngineRef.current

    if (!isPlaying) {
      engine.pause()
      setCurrentTime(engine.getCurrentTime())
      return
    }

    if (!engine.hasBuffer()) {
      setPlaying(false)
      setStatus('error', '先に音声ファイルを読み込んでください。')
      return
    }

    void engine.play().catch((error: unknown) => {
      console.error(error)
      setPlaying(false)
      setStatus('error', '再生を開始できませんでした。')
    })
  }, [isPlaying, setCurrentTime, setPlaying, setStatus])

  useEffect(() => {
    if (!isPlaying) {
      return
    }

    let frameId = 0
    const engine = audioEngineRef.current
    const scheduler = beatSchedulerRef.current

    const tick = () => {
      const currentTime = engine.getCurrentTime()
      setCurrentTime(currentTime)

      if (scheduler.consume(currentTime)) {
        markBeat(currentTime)
      }

      if (useAudioStore.getState().isPlaying) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [isPlaying, markBeat, setCurrentTime])

  return (
    <AppShell
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      mainLayer={<MainCanvasLayer />}
      centerLayer={<BeatCenterLayer />}
      overlayLayer={
        <DropOverlay
          fileInputRef={fileInputRef}
          isDragging={isDragging}
          helperMessage={helperMessage}
          errorMessage={errorMessage}
          onBrowse={openFilePicker}
          onInputChange={handleFileInputChange}
        />
      }
      controlLayer={<ControlDock />}
    />
  )
}

export default App
