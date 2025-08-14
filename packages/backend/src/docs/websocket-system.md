# WebSocket System Documentation

## Overview

The WebSocket system provides real-time communication capabilities for the Saga family biography platform. It enables instant updates for story uploads, interactions, transcript updates, and export notifications across web and mobile clients.

## Architecture

### Core Components

1. **WebSocket Server** (`src/websocket/index.ts`)
   - Socket.io server with JWT authentication
   - Room-based communication for projects
   - Rate limiting and connection management
   - Error handling and graceful shutdown

2. **WebSocket Middleware** (`src/middleware/websocket.ts`)
   - Attaches WebSocket server to Express requests
   - Helper functions for emitting events from controllers

3. **WebSocket Routes** (`src/routes/websocket.ts`)
   - Health check and statistics endpoints
   - Connection monitoring and debugging

4. **WebSocket Client Utility** (`src/utils/websocket-client.ts`)
   - Client-side connection management
   - Auto-reconnection with exponential backoff
   - Promise-based API for easy integration

## Authentication

All WebSocket connections require JWT authentication:

```typescript
const socket = io('ws://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  }
})
```

The server verifies the token and attaches user information to the socket.

## Room Management

### Project Rooms

Users can join project-specific rooms to receive updates for that project:

```typescript
// Join project room
socket.emit('join_project', projectId)

// Listen for confirmation
socket.on('joined_project', (data) => {
  console.log(`Joined project: ${data.projectId}`)
})

// Leave project room
socket.emit('leave_project', projectId)
```

### Access Control

- Users can only join projects they have access to (as facilitator or storyteller)
- Server verifies project access before allowing room joins
- Unauthorized access attempts are rejected with error events

## Events

### Connection Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_project` | Client → Server | Request to join project room |
| `joined_project` | Server → Client | Confirmation of project join |
| `leave_project` | Client → Server | Request to leave project room |
| `left_project` | Server → Client | Confirmation of project leave |

### Story Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `story_uploaded` | Server → Client | New story uploaded to project |
| `story_processing` | Server → Client | Story is being processed |
| `story_processed` | Server → Client | Story processing completed |
| `transcript_updated` | Server → Client | Story transcript updated |

### Interaction Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `interaction_added` | Server → Client | New comment/question added |
| `interaction_updated` | Server → Client | Interaction modified |

### Export Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `export_started` | Server → Client | Export process started |
| `export_progress` | Server → Client | Export progress update |
| `export_ready` | Server → Client | Export completed and ready |
| `export_failed` | Server → Client | Export process failed |

### System Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `ping` | Client → Server | Health check request |
| `pong` | Server → Client | Health check response |
| `error` | Server → Client | Error notification |
| `server_shutdown` | Server → Client | Server shutdown notification |

## Rate Limiting

The WebSocket server implements rate limiting to prevent abuse:

- **Window**: 1 minute
- **Limit**: 100 events per user per window
- **Behavior**: Excess events are rejected with `rate_limit_exceeded` error

## Error Handling

### Client-Side Errors

```typescript
socket.on('error', (error) => {
  switch (error.code) {
    case 'PROJECT_ACCESS_DENIED':
      // Handle access denied
      break
    case 'RATE_LIMIT_EXCEEDED':
      // Handle rate limiting
      break
    default:
      // Handle other errors
  }
})
```

### Connection Recovery

The client utility provides automatic reconnection:

```typescript
const client = new WebSocketClient({
  url: 'ws://localhost:3001',
  token: 'your-jwt-token',
  autoReconnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 1000
})
```

## Integration with Controllers

Controllers can emit WebSocket events using the middleware:

```typescript
import { emitWebSocketEvent } from '../middleware/websocket'
import { WEBSOCKET_EVENTS } from '@saga/shared'

// In controller method
emitWebSocketEvent(req, WEBSOCKET_EVENTS.STORY_UPLOADED, {
  story: newStory,
  projectId,
  uploadedBy: req.user?.name
}, { projectId })
```

## Monitoring and Statistics

### Health Check Endpoint

```
GET /api/websocket/health
```

Returns WebSocket server health status and basic statistics.

### Statistics Endpoint

```
GET /api/websocket/stats
```

Returns detailed connection statistics (requires authentication):

```json
{
  "totalConnections": 42,
  "projectCount": 8,
  "userCount": 15,
  "projectConnections": [
    {
      "projectId": "uuid",
      "connectionCount": 3
    }
  ],
  "rateLimitStats": {
    "activeUsers": 12,
    "rateLimitWindow": 60000,
    "maxEventsPerWindow": 100
  }
}
```

## Testing

### Unit Tests

Run WebSocket tests:

```bash
npm test -- --testPathPattern=websocket.test.ts
```

### Integration Testing

Use the WebSocket client utility for integration tests:

```typescript
const client = new WebSocketClient({
  url: 'ws://localhost:3001',
  token: testToken
})

await client.connect()
await client.joinProject(projectId)

client.onStoryUploaded((data) => {
  // Test story upload events
})
```

## Performance Considerations

### Connection Limits

- Monitor concurrent connections
- Implement connection pooling for high-traffic scenarios
- Use Redis adapter for horizontal scaling

### Memory Management

- Automatic cleanup of disconnected sockets
- Periodic cleanup of rate limit data
- Room cleanup when empty

### Network Optimization

- Use WebSocket compression
- Implement message batching for high-frequency events
- Consider message prioritization

## Security

### Authentication

- JWT token validation on connection
- Token refresh handling
- Secure token transmission

### Authorization

- Project-level access control
- User role verification
- Event filtering based on permissions

### Rate Limiting

- Per-user event limits
- Connection throttling
- DDoS protection

## Deployment

### Environment Variables

```env
# WebSocket configuration
WEBSOCKET_CORS_ORIGIN=https://yourdomain.com
WEBSOCKET_PING_TIMEOUT=60000
WEBSOCKET_PING_INTERVAL=25000
```

### Load Balancing

For multiple server instances, use Redis adapter:

```typescript
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

const pubClient = createClient({ url: process.env.REDIS_URL })
const subClient = pubClient.duplicate()

io.adapter(createAdapter(pubClient, subClient))
```

### Monitoring

- Set up alerts for connection drops
- Monitor memory usage and connection counts
- Track event throughput and latency

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check JWT token validity
   - Verify CORS configuration
   - Check network connectivity

2. **Rate Limiting**
   - Reduce event frequency
   - Implement client-side throttling
   - Check rate limit configuration

3. **Memory Leaks**
   - Monitor connection cleanup
   - Check event listener removal
   - Verify room cleanup

### Debug Mode

Enable debug logging:

```bash
DEBUG=socket.io* npm start
```

### Health Checks

Regular health check requests:

```typescript
setInterval(async () => {
  try {
    await client.ping()
    console.log('WebSocket healthy')
  } catch (error) {
    console.error('WebSocket unhealthy:', error)
  }
}, 30000)
```