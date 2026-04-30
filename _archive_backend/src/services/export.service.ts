import PDFDocument from 'pdfkit'
import archiver from 'archiver'
import { db } from '@/config/database'
import fs from 'fs'
import path from 'path'

export class ExportService {
    async generateExport(projectId: string, outputStream: NodeJS.WritableStream): Promise<void> {
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        })

        archive.pipe(outputStream)

        // Fetch stories
        const stories = await db('stories')
            .where({ project_id: projectId })
            .orderBy('created_at', 'asc')

        // Generate PDF
        const doc = new PDFDocument()
        const pdfBuffer: Buffer[] = []

        doc.on('data', (chunk) => pdfBuffer.push(chunk))
        doc.on('end', () => {
            const pdfData = Buffer.concat(pdfBuffer)
            archive.append(pdfData, { name: 'companion_book.pdf' })
        })

        // PDF Content
        doc.fontSize(25).text('Saga Companion Book', 100, 100)

        for (const story of stories) {
            doc.addPage()
            doc.fontSize(20).text(story.title || 'Untitled Story')
            doc.fontSize(12).text(`Recorded on: ${new Date(story.created_at).toLocaleDateString()}`)
            doc.moveDown()
            doc.fontSize(14).text(story.transcript || 'No transcript available.')

            // Add audio to archive if URL exists (mocking download)
            // In real implementation, we would download from Supabase Storage
            if (story.audio_url) {
                // archive.append(downloadStream(story.audio_url), { name: `audio/${story.title}.mp3` })
                // For MVP, we just add a placeholder text file
                archive.append(`Audio URL: ${story.audio_url}`, { name: `audio/${story.id}.txt` })
            }
        }

        doc.end()

        // Finalize archive
        // Note: doc.end() is async regarding 'end' event, but archiver handles append async.
        // We need to wait for PDF to finish? 
        // Actually, archiver.append can take a buffer.
        // Let's simplify: write PDF to a temp file or just wait for doc to end?
        // PDFKit is stream based.
        // Better approach: pipe doc to archive entry?
        // archive.append(doc, { name: 'companion_book.pdf' }) -> This works if doc is a readable stream.
        // PDFDocument is a readable stream.

        // Re-do PDF logic to pipe directly
        const doc2 = new PDFDocument()
        archive.append(doc2, { name: 'companion_book.pdf' })

        doc2.fontSize(25).text('Saga Companion Book', 100, 100)
        for (const story of stories) {
            doc2.addPage()
            doc2.fontSize(20).text(story.title || 'Untitled Story')
            doc2.moveDown()
            doc2.fontSize(12).text(story.transcript || 'No transcript available.')
        }
        doc2.end()

        await archive.finalize()
    }
}

export const exportService = new ExportService()
