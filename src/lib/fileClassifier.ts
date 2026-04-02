export type FileKind = 'audio' | 'gif' | 'invalid'

export type ClassifiedFile = {
  file: File
  kind: FileKind
}

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'ogg'])
const GIF_EXTENSIONS = new Set(['gif'])

const getExtension = (filename: string): string => {
  const fragments = filename.toLowerCase().split('.')
  if (fragments.length < 2) {
    return ''
  }

  return fragments[fragments.length - 1]
}

export const detectFileKind = (file: Pick<File, 'name' | 'type'>): FileKind => {
  const extension = getExtension(file.name)

  if (file.type.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension)) {
    return 'audio'
  }

  if (file.type === 'image/gif' || GIF_EXTENSIONS.has(extension)) {
    return 'gif'
  }

  return 'invalid'
}

export const classifyFiles = (files: File[]): ClassifiedFile[] => {
  return files.map((file) => ({
    file,
    kind: detectFileKind(file),
  }))
}
