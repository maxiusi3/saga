# Saga Web Application

Next.js web application for Facilitators in the Saga family biography platform.

## 🎯 Overview

The web application serves Facilitators (typically adult children) who:
- Purchase and manage Saga projects for their parents
- View and interact with stories shared by Storytellers
- Edit transcripts and provide feedback
- Export family data and memories

## 🏗️ Architecture

- **Framework**: Next.js 14+ with App Router
- **UI Library**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand for client state
- **Forms**: React Hook Form with Zod validation
- **HTTP Client**: Axios with interceptors
- **Real-time**: Socket.io client for live updates

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Backend API server running on port 3001

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

Create `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-key
```

## 📱 Features

### Authentication
- Email/password registration and login
- Google and Apple OAuth integration
- Secure JWT token management with refresh
- Protected routes and authentication guards

### Project Management
- Create new Saga projects
- Purchase "The Saga Package" via Stripe
- Generate and share invitation links
- Project dashboard with statistics

### Story Feed
- Reverse chronological story display
- Audio playback with waveform visualization
- Transcript editing with auto-save
- Photo viewing and management
- Chapter summary cards

### Interaction System
- Add comments to stories
- Ask follow-up questions
- Real-time updates via WebSocket
- Notification system

### Data Export
- Request complete project export
- Download ZIP archives with all data
- Export history and status tracking

## 🎨 Design System

### Colors

```css
/* Primary (Orange) */
primary-50 to primary-950

/* Secondary (Blue) */
secondary-50 to secondary-950

/* Gray Scale */
gray-50 to gray-950
```

### Components

```
src/components/
├── ui/              # Base UI components
├── forms/           # Form components
├── layout/          # Layout components
├── story/           # Story-related components
├── project/         # Project-related components
└── common/          # Shared components
```

### Styling Conventions

- **Utility-first**: Tailwind CSS classes
- **Component variants**: Using clsx for conditional classes
- **Responsive design**: Mobile-first approach
- **Accessibility**: WCAG 2.1 AA compliance

## 🧭 Routing

### App Router Structure

```
src/app/
├── (auth)/
│   ├── signin/
│   └── signup/
├── dashboard/
│   ├── projects/
│   └── settings/
├── projects/
│   └── [id]/
│       ├── stories/
│       ├── export/
│       └── settings/
└── invite/
    └── [token]/
```

### Route Protection

```typescript
// Protected route example
export default function ProtectedPage() {
  const { user, loading } = useAuth()
  
  if (loading) return <LoadingSpinner />
  if (!user) redirect('/auth/signin')
  
  return <PageContent />
}
```

## 🔄 State Management

### Zustand Stores

```typescript
// Auth store
interface AuthState {
  user: User | null
  token: string | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
}

// Project store
interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  fetchProjects: () => Promise<void>
  createProject: (data: CreateProjectInput) => Promise<Project>
}

// Story store
interface StoryState {
  stories: Story[]
  currentStory: Story | null
  fetchStories: (projectId: string) => Promise<void>
  updateTranscript: (storyId: string, transcript: string) => Promise<void>
}
```

### Real-time Updates

```typescript
// WebSocket integration
const useWebSocket = (projectId: string) => {
  useEffect(() => {
    socket.emit('join_project', projectId)
    
    socket.on('story_uploaded', (story: Story) => {
      // Update story list
    })
    
    socket.on('interaction_added', (interaction: Interaction) => {
      // Update interactions
    })
    
    return () => {
      socket.emit('leave_project', projectId)
    }
  }, [projectId])
}
```

## 🧪 Testing

### Test Structure

```
src/
├── __tests__/          # Integration tests
├── components/
│   └── __tests__/      # Component tests
├── hooks/
│   └── __tests__/      # Hook tests
├── lib/
│   └── __tests__/      # Utility tests
└── stores/
    └── __tests__/      # Store tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Examples

```typescript
// Component test
import { render, screen } from '@testing-library/react'
import { StoryCard } from '../StoryCard'

test('renders story card with audio player', () => {
  const story = mockStory()
  render(<StoryCard story={story} />)
  
  expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
  expect(screen.getByText(story.transcript)).toBeInTheDocument()
})

// Hook test
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '../useAuth'

test('login updates user state', async () => {
  const { result } = renderHook(() => useAuth())
  
  await act(async () => {
    await result.current.login({ email: 'test@example.com', password: 'password' })
  })
  
  expect(result.current.user).toBeTruthy()
})
```

## 🎨 UI Components

### Base Components

```typescript
// Button component
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

// Input component
interface InputProps {
  label?: string
  error?: string
  required?: boolean
  type?: 'text' | 'email' | 'password' | 'tel'
}

// Modal component
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}
```

### Form Handling

```typescript
// Form with validation
const CreateProjectForm = () => {
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
  })
  
  const onSubmit = async (data: CreateProjectInput) => {
    try {
      await createProject(data)
      toast.success('Project created successfully!')
    } catch (error) {
      toast.error('Failed to create project')
    }
  }
  
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input
        {...form.register('name')}
        label="Project Name"
        error={form.formState.errors.name?.message}
      />
      <Button type="submit" loading={form.formState.isSubmitting}>
        Create Project
      </Button>
    </form>
  )
}
```

## 🚀 Deployment

### Build for Production

```bash
# Build application
npm run build

# Start production server
npm start
```

### Environment Configuration

```env
# Production environment
NEXT_PUBLIC_API_URL=https://api.saga.com
NEXT_PUBLIC_WS_URL=https://api.saga.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-key
```

### Performance Optimization

- **Image Optimization**: Next.js Image component
- **Code Splitting**: Automatic route-based splitting
- **Bundle Analysis**: `npm run analyze`
- **Caching**: Static generation and ISR where appropriate

## 🔧 Development

### Code Organization

```
src/
├── app/             # Next.js App Router pages
├── components/      # Reusable React components
├── hooks/           # Custom React hooks
├── lib/             # Utility libraries
├── stores/          # Zustand state stores
├── types/           # TypeScript type definitions
└── utils/           # Helper functions
```

### Adding New Features

1. **Create types** in `src/types/`
2. **Add API client** methods in `src/lib/api/`
3. **Create store** if needed in `src/stores/`
4. **Build components** in `src/components/`
5. **Add pages** in `src/app/`
6. **Write tests** for all components

### Best Practices

- **TypeScript**: Strict typing for all components
- **Accessibility**: ARIA labels and keyboard navigation
- **Performance**: Lazy loading and code splitting
- **SEO**: Proper meta tags and structured data
- **Error Handling**: Error boundaries and user feedback

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com/)
- [Zustand](https://github.com/pmndrs/zustand)
- [Design System](docs/design-system.md)