import type { DragEventHandler, ReactNode } from 'react'

type AppShellProps = {
  mainLayer: ReactNode
  centerLayer: ReactNode
  overlayLayer: ReactNode
  controlLayer: ReactNode
  onDragEnter: DragEventHandler<HTMLDivElement>
  onDragOver: DragEventHandler<HTMLDivElement>
  onDragLeave: DragEventHandler<HTMLDivElement>
  onDrop: DragEventHandler<HTMLDivElement>
}

function AppShell({
  mainLayer,
  centerLayer,
  overlayLayer,
  controlLayer,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: AppShellProps) {
  return (
    <div
      className="app-shell"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {mainLayer}
      {centerLayer}
      {overlayLayer}
      {controlLayer}
    </div>
  )
}

export default AppShell
