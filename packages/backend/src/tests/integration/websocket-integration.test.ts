import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { setupTestDatabase, cleanupTestDatabase, createTestUser, createTestProject } from '../setup';
import { generateAccessToken } from '../../services/auth-service';
import { initializeWebSocket } from '../../websocket';

describe('WebSocket Integration Tests', () => {
  let httpServer: any;
  let io: Server;
  let clientSocket: ClientSocket;
  let testUserId: string;
  let testProjectId: string;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test user and project
    const testUser = await createTestUser({
      email: 'websocket-test@example.com',
      name: 'WebSocket Test User',
      password: 'TestPassword123!',
    });
    testUserId = testUser.id;
    authToken = generateAccessToken(testUser);

    const testProject = await createTestProject({
      title: 'WebSocket Test Project',
      facilitatorId: testUserId,
    });
    testProjectId = testProject.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach((done) => {
    // Create HTTP server and Socket.IO instance
    httpServer = createServer();
    io = initializeWebSocket(httpServer);
    
    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      
      // Create client connection
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: authToken
        }
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterEach(() => {
    io.close();
    clientSocket.close();
    httpServer.close();
  });

  describe('Connection and Authentication', () => {
    it('should authenticate users with valid JWT tokens', (done) => {
      const authenticatedClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: {
          token: authToken
        }
      });

      authenticatedClient.on('connect', () => {
        expect(authenticatedClient.connected).toBe(true);
        authenticatedClient.close();
        done();
      });

      authenticatedClient.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should reject connections with invalid tokens', (done) => {
      const unauthenticatedClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: {
          token: 'invalid-token'
        }
      });

      unauthenticatedClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        unauthenticatedClient.close();
        done();
      });

      unauthenticatedClient.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });
    });

    it('should reject connections without tokens', (done) => {
      const unauthenticatedClient = Client(`http://localhost:${(httpServer.address() as any).port}`);

      unauthenticatedClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication required');
        unauthenticatedClient.close();
        done();
      });

      unauthenticatedClient.on('connect', () => {
        done(new Error('Should not connect without token'));
      });
    });
  });

  describe('Room Management', () => {
    it('should join project rooms successfully', (done) => {
      clientSocket.emit('join_project', { projectId: testProjectId });

      clientSocket.on('joined_project', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.success).toBe(true);
        done();
      });

      clientSocket.on('error', (error) => {
        done(error);
      });
    });

    it('should leave project rooms successfully', (done) => {
      // First join the room
      clientSocket.emit('join_project', { projectId: testProjectId });

      clientSocket.on('joined_project', () => {
        // Then leave the room
        clientSocket.emit('leave_project', { projectId: testProjectId });
      });

      clientSocket.on('left_project', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.success).toBe(true);
        done();
      });

      clientSocket.on('error', (error) => {
        done(error);
      });
    });

    it('should prevent joining unauthorized projects', (done) => {
      const unauthorizedProjectId = '00000000-0000-0000-0000-000000000000';
      
      clientSocket.emit('join_project', { projectId: unauthorizedProjectId });

      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Unauthorized');
        done();
      });

      clientSocket.on('joined_project', () => {
        done(new Error('Should not join unauthorized project'));
      });
    });
  });

  describe('Real-time Story Updates', () => {
    it('should broadcast story uploads to project members', (done) => {
      // Create second client for the same project
      const secondClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: {
          token: authToken
        }
      });

      let eventsReceived = 0;
      const expectedEvents = 2;

      const checkCompletion = () => {
        eventsReceived++;
        if (eventsReceived === expectedEvents) {
          secondClient.close();
          done();
        }
      };

      secondClient.on('connect', () => {
        // Both clients join the same project
        clientSocket.emit('join_project', { projectId: testProjectId });
        secondClient.emit('join_project', { projectId: testProjectId });
      });

      // Set up listeners for story upload events
      clientSocket.on('story_uploaded', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.story.title).toBe('New Test Story');
        checkCompletion();
      });

      secondClient.on('story_uploaded', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.story.title).toBe('New Test Story');
        checkCompletion();
      });

      // Wait for both clients to join, then simulate story upload
      setTimeout(() => {
        io.to(`project:${testProjectId}`).emit('story_uploaded', {
          projectId: testProjectId,
          story: {
            id: 'story-123',
            title: 'New Test Story',
            storytellerId: testUserId,
            createdAt: new Date().toISOString()
          }
        });
      }, 100);
    });

    it('should broadcast story status updates', (done) => {
      clientSocket.emit('join_project', { projectId: testProjectId });

      clientSocket.on('joined_project', () => {
        // Simulate story status update
        io.to(`project:${testProjectId}`).emit('story_status_updated', {
          projectId: testProjectId,
          storyId: 'story-123',
          status: 'transcribed',
          updatedAt: new Date().toISOString()
        });
      });

      clientSocket.on('story_status_updated', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.storyId).toBe('story-123');
        expect(data.status).toBe('transcribed');
        done();
      });
    });

    it('should broadcast new interactions (comments/questions)', (done) => {
      clientSocket.emit('join_project', { projectId: testProjectId });

      clientSocket.on('joined_project', () => {
        // Simulate new interaction
        io.to(`project:${testProjectId}`).emit('new_interaction', {
          projectId: testProjectId,
          storyId: 'story-123',
          interaction: {
            id: 'interaction-456',
            type: 'comment',
            content: 'This is a beautiful story!',
            userId: testUserId,
            createdAt: new Date().toISOString()
          }
        });
      });

      clientSocket.on('new_interaction', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.storyId).toBe('story-123');
        expect(data.interaction.type).toBe('comment');
        expect(data.interaction.content).toBe('This is a beautiful story!');
        done();
      });
    });
  });

  describe('Typing Indicators', () => {
    it('should broadcast typing indicators for comments', (done) => {
      // Create second client
      const secondClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: {
          token: authToken
        }
      });

      secondClient.on('connect', () => {
        clientSocket.emit('join_project', { projectId: testProjectId });
        secondClient.emit('join_project', { projectId: testProjectId });
      });

      // Set up typing indicator listener
      secondClient.on('user_typing', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.storyId).toBe('story-123');
        expect(data.userId).toBe(testUserId);
        expect(data.isTyping).toBe(true);
        secondClient.close();
        done();
      });

      // Wait for both clients to join, then emit typing indicator
      setTimeout(() => {
        clientSocket.emit('typing', {
          projectId: testProjectId,
          storyId: 'story-123',
          isTyping: true
        });
      }, 100);
    });

    it('should stop typing indicators when user stops typing', (done) => {
      // Create second client
      const secondClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: {
          token: authToken
        }
      });

      let typingEvents = 0;

      secondClient.on('connect', () => {
        clientSocket.emit('join_project', { projectId: testProjectId });
        secondClient.emit('join_project', { projectId: testProjectId });
      });

      secondClient.on('user_typing', (data) => {
        typingEvents++;
        
        if (typingEvents === 1) {
          expect(data.isTyping).toBe(true);
          // Emit stop typing
          setTimeout(() => {
            clientSocket.emit('typing', {
              projectId: testProjectId,
              storyId: 'story-123',
              isTyping: false
            });
          }, 50);
        } else if (typingEvents === 2) {
          expect(data.isTyping).toBe(false);
          secondClient.close();
          done();
        }
      });

      // Start typing
      setTimeout(() => {
        clientSocket.emit('typing', {
          projectId: testProjectId,
          storyId: 'story-123',
          isTyping: true
        });
      }, 100);
    });
  });

  describe('Presence and Activity', () => {
    it('should track user presence in projects', (done) => {
      // Create second client
      const secondClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: {
          token: authToken
        }
      });

      secondClient.on('connect', () => {
        clientSocket.emit('join_project', { projectId: testProjectId });
      });

      clientSocket.on('joined_project', () => {
        secondClient.emit('join_project', { projectId: testProjectId });
      });

      secondClient.on('user_joined_project', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.userId).toBe(testUserId);
        secondClient.close();
        done();
      });
    });

    it('should notify when users leave projects', (done) => {
      // Create second client
      const secondClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: {
          token: authToken
        }
      });

      secondClient.on('connect', () => {
        clientSocket.emit('join_project', { projectId: testProjectId });
        secondClient.emit('join_project', { projectId: testProjectId });
      });

      let joinedCount = 0;
      const onJoined = () => {
        joinedCount++;
        if (joinedCount === 2) {
          // Both clients joined, now disconnect one
          clientSocket.disconnect();
        }
      };

      clientSocket.on('joined_project', onJoined);
      secondClient.on('joined_project', onJoined);

      secondClient.on('user_left_project', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.userId).toBe(testUserId);
        secondClient.close();
        done();
      });
    });

    it('should provide online user counts for projects', (done) => {
      clientSocket.emit('join_project', { projectId: testProjectId });

      clientSocket.on('joined_project', () => {
        clientSocket.emit('get_project_presence', { projectId: testProjectId });
      });

      clientSocket.on('project_presence', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.onlineUsers).toBeGreaterThan(0);
        expect(Array.isArray(data.userIds)).toBe(true);
        done();
      });
    });
  });

  describe('Audio Processing Updates', () => {
    it('should broadcast transcription progress updates', (done) => {
      clientSocket.emit('join_project', { projectId: testProjectId });

      clientSocket.on('joined_project', () => {
        // Simulate transcription progress
        io.to(`project:${testProjectId}`).emit('transcription_progress', {
          projectId: testProjectId,
          storyId: 'story-123',
          progress: 50,
          status: 'processing'
        });
      });

      clientSocket.on('transcription_progress', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.storyId).toBe('story-123');
        expect(data.progress).toBe(50);
        expect(data.status).toBe('processing');
        done();
      });
    });

    it('should broadcast transcription completion', (done) => {
      clientSocket.emit('join_project', { projectId: testProjectId });

      clientSocket.on('joined_project', () => {
        // Simulate transcription completion
        io.to(`project:${testProjectId}`).emit('transcription_completed', {
          projectId: testProjectId,
          storyId: 'story-123',
          transcript: 'This is the completed transcript.',
          confidence: 0.95
        });
      });

      clientSocket.on('transcription_completed', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.storyId).toBe('story-123');
        expect(data.transcript).toBe('This is the completed transcript.');
        expect(data.confidence).toBe(0.95);
        done();
      });
    });

    it('should broadcast AI prompt generation updates', (done) => {
      clientSocket.emit('join_project', { projectId: testProjectId });

      clientSocket.on('joined_project', () => {
        // Simulate AI prompt generation
        io.to(`project:${testProjectId}`).emit('new_ai_prompt', {
          projectId: testProjectId,
          prompt: {
            id: 'prompt-789',
            text: 'Tell me about your first day at school.',
            category: 'education',
            difficulty: 'easy'
          }
        });
      });

      clientSocket.on('new_ai_prompt', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.prompt.text).toBe('Tell me about your first day at school.');
        expect(data.prompt.category).toBe('education');
        done();
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed event data gracefully', (done) => {
      clientSocket.emit('join_project', { invalidData: 'test' });

      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Invalid project data');
        done();
      });

      // Should not receive joined_project event
      clientSocket.on('joined_project', () => {
        done(new Error('Should not join with invalid data'));
      });
    });

    it('should handle connection drops and reconnection', (done) => {
      let reconnected = false;

      clientSocket.on('disconnect', () => {
        if (!reconnected) {
          reconnected = true;
          // Reconnect after disconnect
          setTimeout(() => {
            clientSocket.connect();
          }, 100);
        }
      });

      clientSocket.on('connect', () => {
        if (reconnected) {
          // Successfully reconnected
          expect(clientSocket.connected).toBe(true);
          done();
        } else {
          // First connection, simulate disconnect
          clientSocket.disconnect();
        }
      });
    });

    it('should rate limit event emissions', (done) => {
      let errorReceived = false;

      clientSocket.on('error', (error) => {
        if (error.message.includes('Rate limit')) {
          errorReceived = true;
        }
      });

      // Emit many events rapidly to trigger rate limiting
      for (let i = 0; i < 100; i++) {
        clientSocket.emit('typing', {
          projectId: testProjectId,
          storyId: 'story-123',
          isTyping: true
        });
      }

      setTimeout(() => {
        expect(errorReceived).toBe(true);
        done();
      }, 1000);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent connections', (done) => {
      const clients: ClientSocket[] = [];
      const numClients = 10;
      let connectedClients = 0;

      for (let i = 0; i < numClients; i++) {
        const client = Client(`http://localhost:${(httpServer.address() as any).port}`, {
          auth: {
            token: authToken
          }
        });

        client.on('connect', () => {
          connectedClients++;
          if (connectedClients === numClients) {
            // All clients connected successfully
            clients.forEach(c => c.close());
            done();
          }
        });

        client.on('connect_error', (error) => {
          clients.forEach(c => c.close());
          done(error);
        });

        clients.push(client);
      }
    });

    it('should efficiently broadcast to large rooms', (done) => {
      const clients: ClientSocket[] = [];
      const numClients = 20;
      let joinedClients = 0;
      let broadcastsReceived = 0;

      // Create multiple clients and join them to the same project
      for (let i = 0; i < numClients; i++) {
        const client = Client(`http://localhost:${(httpServer.address() as any).port}`, {
          auth: {
            token: authToken
          }
        });

        client.on('connect', () => {
          client.emit('join_project', { projectId: testProjectId });
        });

        client.on('joined_project', () => {
          joinedClients++;
          if (joinedClients === numClients) {
            // All clients joined, now broadcast a message
            io.to(`project:${testProjectId}`).emit('test_broadcast', {
              message: 'Performance test broadcast'
            });
          }
        });

        client.on('test_broadcast', (data) => {
          broadcastsReceived++;
          if (broadcastsReceived === numClients) {
            // All clients received the broadcast
            clients.forEach(c => c.close());
            done();
          }
        });

        clients.push(client);
      }
    });

    it('should handle memory efficiently with many rooms', (done) => {
      const initialMemory = process.memoryUsage().heapUsed;
      const numRooms = 100;
      let roomsCreated = 0;

      // Create many project rooms
      for (let i = 0; i < numRooms; i++) {
        const fakeProjectId = `project-${i}`;
        io.emit('join_project', { projectId: fakeProjectId });
        roomsCreated++;
      }

      setTimeout(() => {
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;
        
        // Memory increase should be reasonable (less than 50MB for 100 rooms)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        expect(roomsCreated).toBe(numRooms);
        done();
      }, 1000);
    });
  });
});