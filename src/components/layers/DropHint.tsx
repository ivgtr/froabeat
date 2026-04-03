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
      <p className="drop-guide">
        {isDragging ? (
          'ドロップで読み込み'
        ) : (
          <>
            音声 / GIF をドロップ、または{' '}
            <button type="button" className="drop-browse-button" onClick={onBrowse}>
              ファイルを選択
            </button>
          </>
        )}
      </p>
      {helperMessage && <p className="drop-feedback">{helperMessage}</p>}
      {errorMessage && <p className="drop-error">{errorMessage}</p>}
    </section>
  )
}

export default DropHint
