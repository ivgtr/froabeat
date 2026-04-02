type DropHintProps = {
  isDragging: boolean
  helperMessage: string | null
  errorMessage: string | null
  onBrowse: () => void
}

function DropHint({
  isDragging,
  helperMessage,
  errorMessage,
  onBrowse,
}: DropHintProps) {
  return (
    <section className="drop-panel" aria-live="polite">
      <p className="drop-title">ファイル読み込み</p>
      <p className="drop-description">
        音声（mp3 / wav / m4a / ogg）と GIF をドロップ、または選択
      </p>
      <button type="button" className="drop-browse-button" onClick={onBrowse}>
        ファイルを選択
      </button>
      {isDragging && <p className="drop-feedback">ここにドロップできます</p>}
      {helperMessage && <p className="drop-feedback">{helperMessage}</p>}
      {errorMessage && <p className="drop-error">{errorMessage}</p>}
    </section>
  )
}

export default DropHint
