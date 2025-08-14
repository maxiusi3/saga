# Saga V1.5 Architecture & Development Guidelines

## Core Business Model

### Package/Seat System
- **Unified User Account**: Single account manages all roles across projects
- **Resource Wallet**: Tracks Project Vouchers, Facilitator Seats, Storyteller Seats
- **Seat Consumption**: Creating projects/inviting users consumes appropriate seats
- **A La Carte**: Users can purchase additional seats when wallet is empty
- **Multi-Facilitator Support**: Multiple siblings can collaborate on single project

### Role-Based Architecture
- **User Account**: Core identity with Resource Wallet
- **Facilitator Role**: Project manager, can invite others, interact with stories
- **Storyteller Role**: Records stories, receives feedback (one per user per project)
- **Project Scope**: Roles are project-specific, not global

## Technical Architecture Patterns

### Service Layer Architecture
- **Consolidated StoryService**: Unified service handling both client-side recording workflow and backend story management
- **Clear Separation**: RecordingService focuses on client-side draft management, StoryService handles data persistence
- **Single Source of Truth**: Subscriptions table manages expiry dates, projects table only tracks status

### Authentication & User Management
- Single sign-on with Apple/Google/Phone
- Role-Based Access Control (RBAC) at project level
- Session management across web and mobile platforms
- Secure invitation token system (72-hour expiry)

### Data Models
```typescript
// Core entities from v1.5 requirements
interface UserAccount {
  id: string;
  resourceWallet: {
    projectVouchers: number;
    facilitatorSeats: number;
    storytellerSeats: number;
  };
}

interface Project {
  id: string;
  name: string;
  createdBy: string; // UserAccount.id
  status: 'active' | 'archived';
  facilitators: FacilitatorRole[];
  storyteller?: StorytellerRole;
  stories: Story[];
  subscription?: Subscription; // Attached via relationship
}

interface Subscription {
  id: string;
  projectId: string;
  facilitatorId: string;
  status: string;
  currentPeriodEnd?: Date; // Single source of truth for expiry
}

interface Story {
  id: string;
  audioUrl: string;
  transcript: string;
  photo?: string;
  chapterId?: string;
  interactions: Interaction[];
  chapterSummary?: ChapterSummary;
}
```

### AI Prompt System
- **Chapter-based progression**: Structured thematic journey
- **Priority system**: User follow-ups override AI prompts
- **Prompt library**: 50-75 open-ended prompts for MVP
- **Context awareness**: AI adapts based on previous stories

### Recording & Processing Pipeline
- **10-minute limit** per recording
- **50MB file size limit**
- **Draft recovery** for interrupted recordings
- **STT processing** with edit capability
- **Single photo attachment** per story

## Platform-Specific Guidelines

### Mobile App (Storyteller Primary)
- **WCAG 2.1 AA compliance** mandatory
- **44x44dp minimum tap targets**
- **Font size options**: Standard, Large, Extra Large
- **High contrast mode** support
- **Press-and-hold recording** with visual feedback
- **Review & Send confirmation** step

### Web Dashboard (Facilitator Primary)
- **Comprehensive project management**
- **Story feed with search capability**
- **Transcript editing interface**
- **Resource wallet management**
- **Data export functionality**

## Performance Requirements

### Response Times
- **App cold start**: < 3 seconds
- **Story feed load**: < 2 seconds
- **End-to-end latency**: < 30 seconds (record to notification)

### Scalability Considerations
- **Asynchronous processing** for STT and exports
- **Background job queues** for heavy operations
- **CDN delivery** for audio/image content
- **Database optimization** for story feeds

## Security & Privacy

### Data Protection
- **Encryption in transit and at rest**
- **PCI DSS compliance** for payments
- **Secure file storage** with access controls
- **Privacy-first design** with clear data ownership

### Access Control
- **Project-scoped permissions**
- **Invitation-based access only**
- **Secure token generation** for invites
- **Session management** across platforms

## Integration Points

### External Services
- **STT Engine**: Multiple provider support for accent diversity
- **Payment Processing**: Apple Pay, Google Pay, Stripe
- **Push Notifications**: Firebase/APNs
- **File Storage**: AWS S3 or equivalent
- **Email Service**: Transactional emails for exports

### API Design
- **RESTful endpoints** for CRUD operations
- **WebSocket connections** for real-time updates
- **GraphQL consideration** for complex data fetching
- **Rate limiting** and security headers

## Development Workflow

### Feature Development
1. **Shared types first**: Update `@saga/shared` package
2. **Backend implementation**: Controller → Service → Model pattern
3. **Frontend integration**: Web dashboard then mobile app
4. **Testing strategy**: Unit → Integration → E2E

### Quality Assurance
- **TypeScript strict mode**: No `any` types
- **Test coverage**: Minimum 80%
- **Accessibility testing**: Automated and manual
- **Performance monitoring**: Core Web Vitals tracking

## Deployment & Operations

### Environment Strategy
- **Development**: Local with test data
- **Staging**: Production-like for testing
- **Production**: Multi-region deployment

### Monitoring & Alerting
- **Application Performance Monitoring** (APM)
- **Error tracking** with Sentry
- **Business metrics** tracking
- **Infrastructure monitoring**

## Success Metrics (MVP)

### Commercial Validation
- **Purchase Conversion Rate**: > 5%
- **Project Activation Rate**: > 60%

### Engagement Metrics
- **Week 2 Storyteller Retention**: > 15%
- **Interaction Loop Rate**: > 20%
- **Collaboration Rate**: > 10% (multi-facilitator projects)

### Quality Metrics
- **Average Recording Length**: Trending upwards
- **Median Time to Interaction**: < 24 hours
- **STT Edit Rate**: < 5 characters per 100 words