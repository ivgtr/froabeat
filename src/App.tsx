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
import { createGifItems } from './lib/gifItemFactory'
import { useAudioStore } from './stores/audioStore'
import { useBoardStore } from './stores/boardStore'
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
  const setPlaybackTime = useAudioStore((state) => state.setPlaybackTime)
  const setDuration = useAudioStore((state) => state.setDuration)
  const setBpm = useAudioStore((state) => state.setBpm)
  const setBeatOffset = useAudioStore((state) => state.setBeatOffset)
  const setStatus = useAudioStore((state) => state.setStatus)
  const setWarningMessage = useAudioStore((state) => state.setWarningMessage)
  const markBeat = useAudioStore((state) => state.markBeat)
  const resetSyncBase = useAudioStore((state) => state.resetSyncBase)
  const addItems = useBoardStore((state) => state.addItems)
  const resetBoard = useBoardStore((state) => state.resetBoard)

  const handleGifFiles = useCallback(
    async (files: File[], dropPoint?: { x: number; y: number }) => {
      if (files.length === 0) {
        return
      }

      const state = useBoardStore.getState()
      const maxZIndex = state.items.reduce(
        (max, item) => Math.max(max, item.zIndex),
        0,
      )
      const nextItems = await createGifItems({
        files,
        camera: state.camera,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        startZIndex: maxZIndex,
        dropPoint,
      })

      addItems(nextItems)
    },
    [addItems],
  )

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
        setPlaybackTime(0)

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
        resetSyncBase(0)

        setStatus('ready', `${file.name} を読み込みました`)
      } catch (error) {
        console.error(error)
        setStatus('error', '音声の読み込みに失敗しました。')
        setWarningMessage('対応形式またはファイル状態を確認してください。')
        setBpm(null)
        setBeatOffset(null)
        setPlaybackTime(0)
      }
    },
    [
      isLooping,
      playbackRate,
      setAudioFile,
      setBeatOffset,
      setBpm,
      setDuration,
      setPlaying,
      setPlaybackTime,
      setStatus,
      setWarningMessage,
      resetSyncBase,
    ],
  )

  const handleTogglePlay = useCallback(() => {
    const engine = audioEngineRef.current
    const state = useAudioStore.getState()

    if (state.isPlaying) {
      engine.pause()
      const currentTime = engine.getCurrentTime()
      setPlaybackTime(currentTime)
      resetSyncBase(currentTime)
      setPlaying(false)
      setStatus('ready', '一時停止しました。')
      return
    }

    if (!engine.hasBuffer()) {
      setStatus('error', '先に音声ファイルを読み込んでください。')
      setPlaying(false)
      return
    }

    void engine
      .play()
      .then(() => {
        const snapshot = engine.getSnapshot()
        if (!snapshot.isPlaying) {
          throw new Error('Playback source was not started')
        }
        setPlaybackTime(snapshot.currentTime)
        resetSyncBase(snapshot.currentTime)
        setPlaying(true)
        setStatus('ready', '再生中')
      })
      .catch((error: unknown) => {
        console.error(error)
        setPlaying(false)
        setStatus(
          'error',
          `再生を開始できませんでした（context: ${engine.getContextState()}）。`,
        )
      })
  }, [setPlaybackTime, setPlaying, setStatus, resetSyncBase])

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
  } = useFileInput({ onAudioFile: handleAudioFile, onGifFiles: handleGifFiles })

  useEffect(() => {
    const engine = audioEngineRef.current
    engine.setPlaybackEndedHandler(() => {
      setPlaying(false)
      setPlaybackTime(0)
      resetSyncBase(0)
      beatSchedulerRef.current.reset(0)
    })

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      resetBoard()
      engine.setPlaybackEndedHandler(null)
      engine.stop()
    }
  }, [resetBoard, setPlaybackTime, setPlaying, resetSyncBase])

  useEffect(() => {
    audioEngineRef.current.setLooping(isLooping)
    resetSyncBase(audioEngineRef.current.getCurrentTime())
    beatSchedulerRef.current.reset(audioEngineRef.current.getCurrentTime())
  }, [isLooping, resetSyncBase])

  useEffect(() => {
    audioEngineRef.current.setPlaybackRate(playbackRate)
    resetSyncBase(audioEngineRef.current.getCurrentTime())
    beatSchedulerRef.current.reset(audioEngineRef.current.getCurrentTime())
  }, [playbackRate, resetSyncBase])

  useEffect(() => {
    beatSchedulerRef.current.configure({ bpm, beatOffset })
    beatSchedulerRef.current.reset(audioEngineRef.current.getCurrentTime())
    resetSyncBase(audioEngineRef.current.getCurrentTime())
  }, [beatOffset, bpm, resetSyncBase])

  useEffect(() => {
    if (!isPlaying) {
      return
    }

    let frameId = 0
    const engine = audioEngineRef.current
    const scheduler = beatSchedulerRef.current

    const tick = () => {
      const snapshot = engine.getSnapshot()
      const currentTime = snapshot.currentTime
      setPlaybackTime(currentTime)

      const beatEvent = scheduler.consume(currentTime)
      if (beatEvent) {
        markBeat(beatEvent.beatTime, beatEvent.beatIndex)
      }

      if (!snapshot.isPlaying) {
        setPlaying(false)
        return
      }

      if (engine.getContextState() !== 'running') {
        setPlaying(false)
        setStatus('error', '音声コンテキストが停止したため再生を中断しました。')
        return
      }

      if (useAudioStore.getState().isPlaying) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [isPlaying, markBeat, setPlaybackTime, setPlaying, setStatus])

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
      controlLayer={<ControlDock onTogglePlay={handleTogglePlay} />}
    />
  )
}

export default App
