import type { ChangeEvent, RefObject } from 'react'

type DropOverlayProps = {
  fileInputRef: RefObject<HTMLInputElement | null>
  isDragging: boolean
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void
}

function DropOverlay({
  fileInputRef,
  isDragging,
  onInputChange,
}: DropOverlayProps) {
  return (
    <section className="overlay-layer" aria-label="File input overlay">
      <div className={`drop-tint ${isDragging ? 'is-active' : ''}`} />
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
