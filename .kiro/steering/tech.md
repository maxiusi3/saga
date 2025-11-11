# Tech Stack

## Monorepo Structure

- **Build System**: npm workspaces
- **Node**: >=18.0.0
- **Package Manager**: npm >=9.0.0

## Packages

### `packages/web` - Frontend Application
- **Framework**: Next.js 15.2.4 (App Router)
- **React**: 19
- **TypeScript**: 5.3.2
- **Styling**: Tailwind CSS 3.4.0
- **UI Components**: Radix UI, Lucide React icons
- **i18n**: next-intl 4.4.0
- **State Management**: Zustand 4.4.7
- **Forms**: react-hook-form 7.48.2 + Zod 3.22.4
- **Auth**: Supabase Auth (@supabase/ssr, @supabase/auth-helpers-nextjs)
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe 14.7.0
- **Audio**: wavesurfer.js 7.6.0
- **AI**: OpenAI 5.18.1, @google-cloud/speech 7.2.0
- **Monitoring**: Sentry (@sentry/nextjs 10.5.0), Vercel Analytics
- **Testing**: Jest 30.2.0, @testing-library/react 16.3.0, Playwright 1.40.0

### `packages/backend` - API Server (Legacy/Minimal)
- **Framework**: Express 4.18.2
- **Database**: Knex 3.0.1 (PostgreSQL/SQLite)
- **Auth**: JWT (jsonwebtoken 9.0.2)
- **Runtime**: tsx 4.6.2 (dev), Node (prod)

### `packages/shared` - Shared Types & Utils
- **TypeScript**: 5.3.2
- **Testing**: Jest 29.7.0

## Common Commands

```bash
# Development
npm run dev              # Start web dev server
npm run dev:web          # Start web only

# Building
npm run build            # Build all workspaces
npm run build:web        # Build web only
npm run build:vercel     # Vercel-specific build

# Quality
npm run lint             # Lint all workspaces
npm run lint:fix         # Auto-fix linting issues
npm run type-check       # TypeScript type checking

# Testing
npm test                 # Run tests in all packages
```

## Path Aliases

```typescript
@/*                      → packages/web/src/*
@/components/*           → packages/web/src/components/*
@/lib/*                  → packages/web/src/lib/*
@/hooks/*                → packages/web/src/hooks/*
@/stores/*               → packages/web/src/stores/*
@/types/*                → packages/web/src/types/*
@saga/shared/*           → packages/shared/src/*
```

## Environment Variables

### Required (Web)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side)
- `STRIPE_SECRET_KEY` (server-side)
- `OPENAI_API_KEY` (server-side)

## Key Technologies

- **Routing**: Next.js App Router with i18n (`[locale]` dynamic segments)
- **Styling**: Tailwind with custom design tokens (Saga Green theme)
- **Database**: Supabase PostgreSQL with Row Level Security
- **Storage**: Supabase Storage for audio files
- **Real-time**: Socket.io-client 4.7.4 (WebSocket)
- **Deployment**: Vercel (primary), Docker support available
