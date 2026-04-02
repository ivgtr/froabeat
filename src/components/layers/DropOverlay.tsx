import type { ChangeEvent, RefObject } from 'react'
import DropHint from './DropHint'

type DropOverlayProps = {
  fileInputRef: RefObject<HTMLInputElement | null>
  isDragging: boolean
  helperMessage: string | null
  errorMessage: string | null
  onBrowse: () => void
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void
}

function DropOverlay({
  fileInputRef,
  isDragging,
  helperMessage,
  errorMessage,
  onBrowse,
  onInputChange,
}: DropOverlayProps) {
  return (
    <section className="overlay-layer" aria-label="File input overlay">
      <div className={`drop-tint ${isDragging ? 'is-active' : ''}`} />
      <DropHint
        isDragging={isDragging}
        helperMessage={helperMessage}
        errorMessage={errorMessage}
        onBrowse={onBrowse}
      />
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        multiple
        accept=".mp3,.wav,.m4a,.ogg,.gif,audio/*,image/gif"
        onChange={onInputChange}
      />
    </section>
  )
}

export default DropOverlay
