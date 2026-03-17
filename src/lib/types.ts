export interface PendingFile {
  id: string
  file: File
  previewUrl: string
  isImage: boolean
  ready?: Promise<void>
}

export interface BridgeSendFile {
  name: string
  type: string
  data: string
}
