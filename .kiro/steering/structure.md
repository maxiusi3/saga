# Project Structure

## Monorepo Layout

```
saga-family-biography/
├── packages/
│   ├── web/              # Next.js frontend application
│   ├── backend/          # Express API (legacy, minimal use)
│   └── shared/           # Shared TypeScript types and utilities
├── furbridge-design-system/  # Design system playground
├── supabase/             # Database migrations
└── .kiro/                # Kiro AI assistant configuration
```

## Web Application (`packages/web/src/`)

### App Router Structure
```
app/
├── [locale]/             # i18n routing (en, zh-CN, zh-TW, ja, ko, es, fr, pt)
│   ├── (auth)/          # Auth pages (login, signup, verify)
│   ├── (marketing)/     # Public pages (landing, pricing, about)
│   └── dashboard/       # Protected app pages
│       ├── page.tsx     # Dashboard home
│       ├── projects/    # Project management
│       ├── resources/   # Resource wallet
│       ├── purchase/    # Purchase flow
│       ├── settings/    # User settings
│       └── help/        # Help center
├── api/                 # API routes (not locale-prefixed)
│   ├── auth/           # Authentication endpoints
│   ├── ai/             # AI generation endpoints
│   ├── stories/        # Story CRUD
│   ├── projects/       # Project CRUD
│   └── stripe/         # Payment webhooks
└── globals.css         # Global styles
```

### Components Organization
```
components/
├── ui/                  # Base UI components (buttons, cards, inputs)
├── auth/               # Authentication components
├── stories/            # Story-related components
├── recording/          # Audio recording interface
├── audio/              # Audio playback components
├── projects/           # Project management UI
├── invitations/        # Invitation system
├── notifications/      # Notification system
├── settings/           # Settings pages
├── payment/            # Stripe integration
├── layout/             # Layout components (nav, sidebar)
└── shared/             # Shared utilities
```

### Key Directories
- **`lib/`**: Utility functions, API clients, service integrations
- **`hooks/`**: Custom React hooks
- **`stores/`**: Zustand state management stores
- **`types/`**: TypeScript type definitions
- **`i18n/`**: Internationalization configuration
- **`services/`**: Business logic services
- **`styles/`**: CSS files (design tokens, accessibility)

## Shared Package (`packages/shared/src/`)

```
shared/src/
├── types/              # Shared TypeScript types
│   ├── user.ts
│   ├── project.ts
│   ├── story.ts
│   ├── recording.ts
│   ├── subscription.ts
│   └── ...
├── lib/                # Shared utilities
│   ├── ai-services.ts
│   ├── permissions.ts
│   └── notifications.ts
├── config/             # Shared configuration
│   └── service-plans.ts
└── utils/              # Utility functions
    ├── validation.ts
    ├── formatting.ts
    └── constants.ts
```

## Translations (`packages/web/public/locales/`)

```
locales/
├── en/                 # English (default)
├── zh-CN/              # Simplified Chinese
├── zh-TW/              # Traditional Chinese
├── ja/                 # Japanese
├── ko/                 # Korean
├── es/                 # Spanish
├── fr/                 # French
└── pt/                 # Portuguese

Each locale contains:
├── common.json         # Common UI strings
├── auth.json          # Authentication
├── dashboard.json     # Dashboard
├── stories.json       # Stories
├── recording.json     # Recording interface
├── settings.json      # Settings
├── resources.json     # Resource management
├── purchase.json      # Purchase flow
└── ...
```

## Conventions

### File Naming
- **Components**: PascalCase (`StoryCard.tsx`, `AudioPlayer.tsx`)
- **Utilities**: kebab-case (`api-client.ts`, `format-date.ts`)
- **Pages**: kebab-case (`page.tsx`, `[id]/page.tsx`)
- **Types**: kebab-case (`user-settings.ts`, `story-sharing.ts`)

### Component Patterns
- Use `'use client'` directive for client components
- Server components by default in App Router
- Co-locate component-specific types in the same file
- Export named components, not default exports (except pages)

### API Routes
- Located in `app/api/` (not locale-prefixed)
- Use route handlers: `route.ts` with GET, POST, PUT, DELETE exports
- Return `NextResponse.json()` for responses
- Handle errors with try-catch and appropriate status codes

### Internationalization
- Use `useTranslations()` hook from next-intl
- Translation keys: `namespace.section.key` format
- Use `useLocale()` to get current locale
- Prefix internal links with locale: `/${locale}/dashboard`

### State Management
- Zustand stores in `stores/` directory
- Use hooks for component state
- Supabase for server state (auth, database)
- React Query patterns for data fetching (via Supabase)

### Styling
- Tailwind utility classes (primary approach)
- Custom design tokens in `tailwind.config.js`
- CSS modules for complex components (rare)
- Saga Green theme: `#2D5A3D` (primary), `#4A7C59` (secondary)
