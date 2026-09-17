import fs from 'node:fs'
import path from 'node:path'
import type { RequestHandler } from 'express'
import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'
import { prisma } from '../prisma'
import { upload, UPLOAD_DIR } from '../upload'

const router = Router()
const requireRequesterAuth: [RequestHandler, RequestHandler] = [requireAuth, requireRole('REQUESTER')]
const MAX_ACTIVE_ATTACHMENTS = 5

function handleUpload(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'FILE_TOO_LARGE', message: 'File exceeds the 5 MB limit.' })
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res
          .status(400)
          .json({ error: 'UNSUPPORTED_TYPE', message: 'Only JPG, PNG, WEBP, and PDF files are allowed.' })
      }
      return res.status(400).json({ error: 'UPLOAD_ERROR', message: err.message })
    }
    if (err) {
      return res.status(500).json({ error: 'UPLOAD_ERROR', message: 'Unable to process upload.' })
    }
    next()
  })
}

async function findOwnedTicket(ticketId: number, requesterId: number | undefined) {
  return prisma.ticket.findFirst({ where: { id: ticketId, requesterId } })
}

router.post('/tickets/:id/attachments', ...requireRequesterAuth, handleUpload, async (req, res) => {
  const ticketId = Number(req.params.id)
  const file = req.file

  const cleanup = () => {
    if (file) fs.unlink(path.join(UPLOAD_DIR, file.filename), () => {})
  }

  if (!file) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No file was provided.' })
  }

  const ticket = await findOwnedTicket(ticketId, req.user!.id)
  if (!ticket) {
    cleanup()
    return res.status(404).json({ error: 'NOT_FOUND' })
  }

  const activeCount = await prisma.attachment.count({ where: { ticketId, isRemoved: false } })
  if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
    cleanup()
    return res
      .status(400)
      .json({ error: 'ATTACHMENT_LIMIT_REACHED', message: 'A Ticket can have at most 5 attachments.' })
  }

  const attachment = await prisma.attachment.create({
    data: {
      ticketId,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      uploadedAt: true,
      isRemoved: true,
    },
  })

  res.status(201).json(attachment)
})

router.get('/tickets/:id/attachments/:attachmentId', ...requireRequesterAuth, async (req, res) => {
  const ticketId = Number(req.params.id)
  const attachmentId = Number(req.params.attachmentId)

  const ticket = await findOwnedTicket(ticketId, req.user!.id)
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' })

  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ticketId },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      uploadedAt: true,
      isRemoved: true,
      removedReason: true,
    },
  })
  if (!attachment) return res.status(404).json({ error: 'NOT_FOUND' })

  res.json(attachment)
})

router.get('/tickets/:id/attachments/:attachmentId/download', ...requireRequesterAuth, async (req, res) => {
  const ticketId = Number(req.params.id)
  const attachmentId = Number(req.params.attachmentId)

  const ticket = await findOwnedTicket(ticketId, req.user!.id)
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' })

  const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, ticketId } })
  if (!attachment || attachment.isRemoved) {
    return res.status(404).json({ error: 'NOT_FOUND' })
  }

  res.download(path.join(UPLOAD_DIR, attachment.storedName), attachment.originalName)
})

router.patch('/tickets/:id/attachments/:attachmentId/remove', ...requireRequesterAuth, async (req, res) => {
  const ticketId = Number(req.params.id)
  const attachmentId = Number(req.params.attachmentId)
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''

  if (reason.length < 3) {
    return res
      .status(400)
      .json({ error: 'VALIDATION_ERROR', fields: { reason: 'A removal reason of at least 3 characters is required.' } })
  }

  const ticket = await findOwnedTicket(ticketId, req.user!.id)
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' })

  const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, ticketId } })
  if (!attachment || attachment.isRemoved) {
    return res.status(404).json({ error: 'NOT_FOUND' })
  }

  const updated = await prisma.attachment.update({
    where: { id: attachmentId },
    data: { isRemoved: true, removedAt: new Date(), removedReason: reason },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      uploadedAt: true,
      isRemoved: true,
      removedReason: true,
    },
  })

  res.json(updated)
})

export default router
