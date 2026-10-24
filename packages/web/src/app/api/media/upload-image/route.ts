import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { imageUploadReference } from '@/lib/media-reference'
import { requireMediaAccess, withMediaHeaders } from '@/lib/server/media-access'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const reply = (body: unknown, status = 200) => withMediaHeaders(NextResponse.json(body, { status }), auth.headers)
  try {
    let form: FormData
    try { form = await request.formData() } catch { return reply({ error: 'Invalid upload request' }, 400) }
    const file = form.get('file')
    const folder = form.get('folder') ?? 'images'
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
    const maxSize = 5 * 1024 * 1024

    if (!(file instanceof File)) {
      return reply({ error: 'No image file provided' }, 400)
    }

    const type = file.type
    if (!allowedTypes.includes(type)) {
      return reply({ error: 'Unsupported file type' }, 400)
    }

    if (file.size > maxSize) {
      return reply({ error: 'File too large' }, 400)
    }

    const reference = imageUploadReference(auth.user.id, folder)
    if (!reference) return reply({ error: 'Invalid upload folder' }, 400)
    const access = await requireMediaAccess(reference, auth.user)
    if (!access.ok) return withMediaHeaders(access.response, auth.headers)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const timestamp = Date.now()
    const isPng = type === 'image/png'
    const isGif = type === 'image/gif'
    const ext = isPng ? 'png' : (isGif ? 'gif' : 'jpg')
    const baseName = `${timestamp}-${Math.random().toString(36).slice(2)}`
    const filename = `${baseName}.${ext}`
    const thumbFilename = `${baseName}-thumb.${isGif ? 'png' : ext}`

    const admin = access.admin

    const thumbBuffer = await sharp(buffer)
      .resize({ width: 320, height: 320, fit: 'cover' })
      .toFormat(isGif ? 'png' : (isPng ? 'png' : 'jpeg'), isGif || isPng ? { compressionLevel: 9 } : { quality: 75 })
      .toBuffer()

    const basePath = reference.path.slice(0, reference.path.lastIndexOf('/'))

    const { data: uploadOriginal, error: upErr1 } = await admin.storage
      .from('saga')
      .upload(`${basePath}/${filename}`, buffer, { contentType: type, upsert: false, cacheControl: '3600' })
    if (upErr1) {
      return reply({ error: 'Image upload failed' }, 500)
    }

    const { data: uploadThumb, error: upErr2 } = await admin.storage
      .from('saga')
      .upload(`${basePath}/${thumbFilename}`, thumbBuffer, { contentType: isGif ? 'image/png' : (isPng ? 'image/png' : 'image/jpeg'), upsert: false, cacheControl: '3600' })
    if (upErr2) {
      return reply({ error: 'Thumbnail upload failed' }, 500)
    }

    const { data: signedOriginal, error: signedOriginalError } = await admin.storage
      .from('saga')
      .createSignedUrl(uploadOriginal.path, 3600)
    const { data: signedThumb, error: signedThumbError } = await admin.storage
      .from('saga')
      .createSignedUrl(uploadThumb.path, 3600)

    if (signedOriginalError || signedThumbError || !signedOriginal || !signedThumb) {
      return reply({ error: 'Failed to create signed image URL' }, 500)
    }

    return reply({
      success: true,
      url: signedOriginal.signedUrl,
      thumbUrl: signedThumb.signedUrl,
      path: uploadOriginal.path,
      thumbPath: uploadThumb.path
    })
  } catch {
    return reply({ error: 'Upload failed' }, 500)
  }
}
