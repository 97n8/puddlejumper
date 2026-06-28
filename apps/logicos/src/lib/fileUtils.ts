import { FileType, FileItem } from './types'

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

export const getFileType = (filename: string): FileType => {
  const ext = getFileExtension(filename)
  const typeMap: Record<string, FileType> = {
    pdf: 'pdf',
    doc: 'docx',
    docx: 'docx',
    xls: 'xlsx',
    xlsx: 'xlsx',
    csv: 'csv',
    md: 'md',
    markdown: 'md',
    json: 'json',
    html: 'html',
    htm: 'html',
    txt: 'txt',
    png: 'png',
    jpg: 'jpg',
    jpeg: 'jpeg',
    gif: 'gif',
    svg: 'svg',
  }
  return typeMap[ext] || 'txt'
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const getFileBadgeClass = (type: FileType): string => {
  const classMap: Record<FileType, string> = {
    pdf: 'file-badge-pdf',
    docx: 'file-badge-docx',
    xlsx: 'file-badge-xlsx',
    csv: 'file-badge-csv',
    md: 'file-badge-md',
    json: 'file-badge-json',
    html: 'file-badge-default',
    txt: 'file-badge-default',
    png: 'file-badge-default',
    jpg: 'file-badge-default',
    jpeg: 'file-badge-default',
    gif: 'file-badge-default',
    svg: 'file-badge-default',
  }
  return classMap[type] || 'file-badge-default'
}

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export const createFileItem = async (file: File): Promise<FileItem> => {
  const type = getFileType(file.name)
  const isText = ['csv', 'md', 'json', 'html', 'txt'].includes(type)
  const content = isText ? await readFileAsText(file) : await readFileAsDataURL(file)

  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: file.name,
    type,
    size: file.size,
    content,
    uploadedAt: Date.now(),
  }
}

export const generateUniqueFileName = (name: string, existingNames: string[]): string => {
  if (!existingNames.includes(name)) return name

  const ext = getFileExtension(name)
  const baseName = ext ? name.slice(0, -(ext.length + 1)) : name

  let counter = 1
  let newName = ext ? `${baseName}-${counter}.${ext}` : `${baseName}-${counter}`

  while (existingNames.includes(newName)) {
    counter++
    newName = ext ? `${baseName}-${counter}.${ext}` : `${baseName}-${counter}`
  }

  return newName
}

export const downloadAsZip = async (files: FileItem[]): Promise<void> => {
  const blob = new Blob([JSON.stringify(files, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `devsuite-export-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
