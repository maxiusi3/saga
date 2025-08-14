import { Request, Response } from 'express'
import { ApiError } from '@saga/shared'

export const notFoundHandler = (req: Request, res: Response) => {
  const errorResponse: ApiError = {
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  }

  res.status(404).json(errorResponse)
}