import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const folder = (form.get('folder') as string) || 'images'
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
    const maxSize = 5 * 1024 * 1024

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const type = (file as any).type || ''
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const timestamp = Date.now()
    const originalName = file.name || 'image'
    const isPng = originalName.toLowerCase().endsWith('.png') || type === 'image/png'
    const isGif = originalName.toLowerCase().endsWith('.gif') || type === 'image/gif'
    const ext = isPng ? 'png' : (isGif ? 'gif' : 'jpg')
    const baseName = `${timestamp}-${Math.random().toString(36).slice(2)}`
    const filename = `${baseName}.${ext}`
    const thumbFilename = `${baseName}-thumb.${isGif ? 'png' : ext}`

    const admin = getSupabaseAdmin()

    let originalBuffer = buffer
    if (ext === 'jpg') {
      originalBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
    } else if (ext === 'png') {
      originalBuffer = await sharp(buffer).png({ compressionLevel: 9 }).toBuffer()
    } else {
      originalBuffer = buffer
    }

    const thumbBuffer = await sharp(buffer)
      .resize({ width: 320, height: 320, fit: 'cover' })
      .toFormat(isGif ? 'png' : (isPng ? 'png' : 'jpeg'), isGif || isPng ? { compressionLevel: 9 } : { quality: 75 })
      .toBuffer()

    const { data: userRes } = await admin.auth.getUser()
    const userId = userRes?.user?.id || 'anonymous'
    const basePath = `${userId}/${folder}`

    const { data: uploadOriginal, error: upErr1 } = await admin.storage
      .from('saga')
      .upload(`${basePath}/${filename}`, originalBuffer, { contentType: type, upsert: false, cacheControl: '3600' })
    if (upErr1) {
      return NextResponse.json({ error: upErr1.message }, { status: 500 })
    }

    const { data: uploadThumb, error: upErr2 } = await admin.storage
      .from('saga')
      .upload(`${basePath}/${thumbFilename}`, thumbBuffer, { contentType: isGif ? 'image/png' : (isPng ? 'image/png' : 'image/jpeg'), upsert: false, cacheControl: '3600' })
    if (upErr2) {
      return NextResponse.json({ error: upErr2.message }, { status: 500 })
    }

    const { data: urlOriginal } = admin.storage.from('saga').getPublicUrl(uploadOriginal.path)
    const { data: urlThumb } = admin.storage.from('saga').getPublicUrl(uploadThumb.path)

    return NextResponse.json({
      success: true,
      url: urlOriginal.publicUrl,
      thumbUrl: urlThumb.publicUrl,
      path: uploadOriginal.path,
      thumbPath: uploadThumb.path
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 })
  }
}

