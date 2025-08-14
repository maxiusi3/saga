import { Request, Response, NextFunction } from 'express'
import { ApiError } from '@saga/shared'

export interface AppError extends Error {
  statusCode?: number
  code?: string
  details?: any
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500
  const code = err.code || 'INTERNAL_SERVER_ERROR'
  
  const errorResponse: ApiError = {
    error: {
      code,
      message: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.details : undefined,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  }

  // Log error for monitoring
  console.error('API Error:', {
    ...errorResponse,
    stack: err.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    user: (req as any).user?.id,
  })

  res.status(statusCode).json(errorResponse)
}

export const createError = (
  message: string,
  statusCode = 500,
  code?: string,
  details?: any
): AppError => {
  const error = new Error(message) as AppError
  error.statusCode = statusCode
  error.code = code
  error.details = details
  return error
}

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}