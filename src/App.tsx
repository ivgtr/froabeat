import AppShell from './components/layout/AppShell'
import BeatCenterLayer from './components/layers/BeatCenterLayer'
import ControlDock from './components/layers/ControlDock'
import DropOverlay from './components/layers/DropOverlay'
import MainCanvasLayer from './components/layers/MainCanvasLayer'
import { useFileInput } from './features/file-input/useFileInput'
import './styles/app.css'

function App() {
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
  } = useFileInput()

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
