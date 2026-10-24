export interface PackageScopeLimits {
  storytellers: number
  audioMinutes: number
  photos: number
  hostingMonths: number
  reminderDaysBeforeExpiry: readonly [number, number]
}

export interface PaymentPackage {
  id: 'digital_project_59' | 'starter' | 'family' | 'extended'
  name: string
  amount: number
  currency: 'usd'
  projectVouchers: number
  facilitatorSeats: number
  storytellerSeats: number
  scopeLimits?: PackageScopeLimits
}

export const PAYMENT_PACKAGES: Record<PaymentPackage['id'], PaymentPackage> = {
  digital_project_59: {
    id: 'digital_project_59',
    name: 'Single-Narrator Digital Biography Project',
    amount: 5900,
    currency: 'usd',
    projectVouchers: 1,
    facilitatorSeats: 1,
    storytellerSeats: 1,
    scopeLimits: {
      storytellers: 1,
      audioMinutes: 120,
      photos: 20,
      hostingMonths: 12,
      reminderDaysBeforeExpiry: [90, 30],
    },
  },
  starter: {
    id: 'starter',
    name: 'Family Starter',
    amount: 9900,
    currency: 'usd',
    projectVouchers: 1,
    facilitatorSeats: 1,
    storytellerSeats: 2,
  },
  family: {
    id: 'family',
    name: 'The Family Saga',
    amount: 14900,
    currency: 'usd',
    projectVouchers: 1,
    facilitatorSeats: 2,
    storytellerSeats: 4,
  },
  extended: {
    id: 'extended',
    name: 'Extended Family',
    amount: 24900,
    currency: 'usd',
    projectVouchers: 2,
    facilitatorSeats: 4,
    storytellerSeats: 8,
  },
}

export function getPaymentPackage(packageId: string): PaymentPackage | null {
  return PAYMENT_PACKAGES[packageId as PaymentPackage['id']] ?? null
}
