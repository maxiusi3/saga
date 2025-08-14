import { User as SagaUser } from '@saga/shared'

declare global {
  namespace Express {
    interface User extends SagaUser {}
    interface Request {
      user?: SagaUser
    }
  }
}

export {}