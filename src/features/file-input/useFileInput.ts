import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { classifyFiles } from '../../lib/fileClassifier'

type UseFileInputOptions = {
  onAudioFile?: (file: File) => Promise<void> | void
}

const buildSummaryMessage = (audioCount: number, gifCount: number): string => {
  return `受け付け: 音声 ${audioCount}件 / GIF ${gifCount}件`
}

const buildInvalidMessage = (invalidNames: string[]): string => {
  const targets = invalidNames.slice(0, 2).join(', ')
  const suffix = invalidNames.length > 2 ? ' ほか' : ''

  return `対応外の形式です: ${targets}${suffix}`
}

export const useFileInput = ({ onAudioFile }: UseFileInputOptions = {}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)

  const [isDragging, setIsDragging] = useState(false)
  const [helperMessage, setHelperMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) {
      return
    }

    const classified = classifyFiles(files)
    const audioCount = classified.filter((entry) => entry.kind === 'audio').length
    const gifCount = classified.filter((entry) => entry.kind === 'gif').length
    const invalidFiles = classified
      .filter((entry) => entry.kind === 'invalid')
      .map((entry) => entry.file.name)
    const audioFiles = classified
      .filter((entry) => entry.kind === 'audio')
      .map((entry) => entry.file)

    if (audioCount + gifCount > 0) {
      setHelperMessage(buildSummaryMessage(audioCount, gifCount))
    }

    if (invalidFiles.length > 0) {
      setErrorMessage(buildInvalidMessage(invalidFiles))
      return
    }

    setErrorMessage(null)

    if (audioFiles.length > 0 && onAudioFile) {
      try {
        await onAudioFile(audioFiles[0])
      } catch (error) {
        console.error(error)
        setErrorMessage('音声ファイルの読み込みに失敗しました。')
      }
    }
  }

  const resetDraggingState = () => {
    dragDepthRef.current = 0
    setIsDragging(false)
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const droppedFiles = Array.from(event.dataTransfer.files)
    resetDraggingState()
    void handleFiles(droppedFiles)
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    void handleFiles(selectedFiles)
    event.target.value = ''
  }

  return {
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
  }
}
