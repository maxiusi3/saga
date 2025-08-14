---
inclusion: always
---

# Saga Development Guidelines

## Architecture & Structure
- **Monorepo**: `packages/backend` (Node.js/Express), `packages/web` (Next.js), `packages/mobile` (React Native), `packages/shared` (TypeScript types)
- **Import shared types**: Always use `@saga/shared` for cross-package type definitions
- **Backend pattern**: Controller → Service → Model (never skip service layer)
- **TypeScript**: Strict mode enabled - no `any` types, explicit return types for functions

## Database (Knex.js)
- **Migrations**: Use timestamp format `YYYYMMDDHHMMSS_description.js` in `packages/backend/migrations/`
- **Models**: Extend `packages/backend/src/models/base.ts` for all database models
- **Queries**: Use Knex query builder, avoid raw SQL except for complex operations
- **Transactions**: Wrap multi-table operations in database transactions

## API Development
- **Structure**: Controllers in `src/controllers/`, routes in `src/routes/`, services in `src/services/`
- **Authentication**: JWT tokens with Firebase OAuth integration
- **Validation**: Validate all inputs using shared types from `@saga/shared`
- **Error handling**: Use consistent error response format with proper HTTP status codes
- **Security**: Apply rate limiting, security headers, and environment variables for all secrets

## External Service Integration
- **OpenAI**: Use `packages/backend/src/config/openai.ts` for AI prompt generation
- **AWS S3**: File storage via `packages/backend/src/services/storage-service.ts`
- **Stripe**: Payment processing through `packages/backend/src/services/subscription-service.ts`
- **SendGrid**: Email notifications via `packages/backend/src/services/email-notification-service.ts`
- **Firebase**: Push notifications through `packages/backend/src/services/push-notification-service.ts`
- **Speech-to-text**: Use `packages/backend/src/services/speech-to-text-service.ts`

## Testing Requirements
- **Unit tests**: Jest with minimum 80% coverage
- **Integration tests**: Place in `packages/backend/src/tests/integration/`
- **E2E tests**: Playwright for web (`packages/web/e2e/`), Detox for mobile (`packages/mobile/e2e/`)
- **Test location**: Adjacent to source files or in `__tests__` directories
- **Mocking**: Mock external services in tests, use test database for integration tests

## Frontend Patterns
- **State management**: Zustand stores in `src/stores/` directories
- **Error boundaries**: Implement for all major components
- **WebSocket**: Use established WebSocket system for real-time updates
- **Mobile accessibility**: Follow WCAG guidelines, use accessibility components from `packages/mobile/src/components/accessibility/`
- **Web routing**: Next.js App Router with protected routes

## Code Style & Conventions
- **Async operations**: Always use async/await, never mix with Promises
- **Error handling**: Implement try-catch blocks with proper error logging
- **Logging**: Use `packages/backend/src/services/logging-service.ts` for structured logging
- **Environment variables**: Store in `.env` files, validate on startup
- **File naming**: kebab-case for files, PascalCase for React components
- **Import order**: External packages, internal packages, relative imports

## Development Workflow
- **Database changes**: Create migration first, then update models and types
- **New features**: Update shared types first, then implement backend, then frontend
- **Testing**: Write tests alongside implementation, not after
- **Documentation**: Update relevant docs in `packages/*/docs/` when adding features