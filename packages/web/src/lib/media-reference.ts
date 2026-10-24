export type MediaBucket = 'saga' | 'audio-recordings'
export type MediaScope =
  | { kind: 'private' }
  | { kind: 'project'; projectId: string }
  | { kind: 'story'; storyId: string }

export interface MediaReference {
  bucket: MediaBucket
  path: string
  ownerId: string
  scope: MediaScope
}

/** Validate an exact Storage key; never decode or normalize an authorization input. */
export function parseMediaReference(bucket: unknown, path: unknown): MediaReference | null {
  if (bucket !== 'saga' && bucket !== 'audio-recordings') return null
  if (typeof path !== 'string' || !path || path !== path.trim() || /[\\%?#:\u0000-\u001f\u007f-\u009f]/.test(path)) return null
  const parts = path.split('/')
  if (parts.length < 2 || parts.some(part => !part || part === '.' || part === '..')) return null
  if (parts.slice(2).includes('projects')) return null

  let scope: MediaScope = { kind: 'private' }
  if (parts[1] === 'projects') {
    if (parts.length < 4) return null
    scope = { kind: 'project', projectId: parts[2] }
  } else if (parts[1] === 'images' && (parts[2] === 'stories' || parts[2] === 'interactions')) {
    if (parts.length < 5) return null
    scope = { kind: 'story', storyId: parts[3] }
  }
  return { bucket, path, ownerId: parts[0], scope }
}

/** Only destinations used by the current image flows are accepted. */
export function imageUploadReference(ownerId: string, folder: unknown): MediaReference | null {
  if (typeof folder !== 'string') return null
  const parts = folder.split('/')
  const supported = folder === 'images' ||
    (parts.length === 3 && parts[0] === 'images' && (parts[1] === 'stories' || parts[1] === 'interactions')) ||
    (parts.length >= 2 && parts[0] === 'projects')
  return supported ? parseMediaReference('saga', `${ownerId}/${folder}/upload`) : null
}

export function audioMimeType(type: string, filename: string): string {
  if (type && type !== 'application/octet-stream') return type
  const extension = filename.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    mp3: 'audio/mpeg', mp4: 'audio/mp4', m4a: 'audio/mp4', wav: 'audio/wav',
    webm: 'audio/webm', ogg: 'audio/ogg', oga: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac',
  }
  return extension && Object.prototype.hasOwnProperty.call(types, extension)
    ? types[extension]
    : 'application/octet-stream'
}
