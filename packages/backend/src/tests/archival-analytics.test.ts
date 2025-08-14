import request from 'supertest';
import { app } from '../index';
import { AnalyticsService } from '../services/analytics-service';
import { ArchivalService } from '../services/archival-service';
import { setupTestDatabase, cleanupTestDatabase } from './setup';

describe('Archival Analytics', () => {
  let authToken: string;
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test user and get auth token
    const authResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

    authToken = authResponse.body.token;
    userId = authResponse.body.user.id;

    // Create test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Project',
        description: 'Test project for archival analytics',
      });

    projectId = projectResponse.body.project.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Analytics Tracking', () => {
    it('should track archival transition', () => {
      AnalyticsService.trackArchivalTransition(userId, projectId, 'Test Project', 'expired');
      
      const events = AnalyticsService.getUserEvents(userId);
      const archivalEvent = events.find(e => e.name === 'project_archived');
      
      expect(archivalEvent).toBeDefined();
      expect(archivalEvent?.properties.projectId).toBe(projectId);
      expect(archivalEvent?.properties.reason).toBe('expired');
    });

    it('should track subscription renewal', () => {
      AnalyticsService.trackSubscriptionRenewal(userId, projectId, 'Test Project', 'manual');
      
      const events = AnalyticsService.getUserEvents(userId);
      const renewalEvent = events.find(e => e.name === 'subscription_renewed');
      
      expect(renewalEvent).toBeDefined();
      expect(renewalEvent?.properties.projectId).toBe(projectId);
      expect(renewalEvent?.properties.renewalMethod).toBe('manual');
    });

    it('should track expiry warning sent', () => {
      AnalyticsService.trackExpiryWarningSent(userId, projectId, 7, 'email');
      
      const events = AnalyticsService.getUserEvents(userId);
      const warningEvent = events.find(e => e.name === 'expiry_warning_sent');
      
      expect(warningEvent).toBeDefined();
      expect(warningEvent?.properties.daysUntilExpiry).toBe(7);
      expect(warningEvent?.properties.warningType).toBe('email');
    });
  });

  describe('Archival Metrics API', () => {
    it('should get archival metrics', async () => {
      const response = await request(app)
        .get('/api/archival-analytics/metrics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalArchivedProjects');
      expect(response.body.data).toHaveProperty('renewalRate');
      expect(response.body.data).toHaveProperty('archivalReasons');
    });

    it('should get subscription health metrics', async () => {
      const response = await request(app)
        .get('/api/archival-analytics/subscription-health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('activeSubscriptions');
      expect(response.body.data).toHaveProperty('expiringIn7Days');
      expect(response.body.data).toHaveProperty('churnRate');
    });

    it('should generate archival report', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get('/api/archival-analytics/report')
        .query({ startDate, endDate })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('trends');
      expect(response.body.data).toHaveProperty('insights');
    });

    it('should get projects approaching expiry', async () => {
      const response = await request(app)
        .get('/api/archival-analytics/expiring-projects')
        .query({ daysThreshold: 30 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('threshold');
      expect(response.body.data).toHaveProperty('projects');
      expect(response.body.data).toHaveProperty('count');
    });

    it('should get archival dashboard data', async () => {
      const response = await request(app)
        .get('/api/archival-analytics/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('archivalMetrics');
      expect(response.body.data).toHaveProperty('subscriptionHealth');
      expect(response.body.data).toHaveProperty('businessMetrics');
      expect(response.body.data).toHaveProperty('recentActivity');
    });

    it('should export archival data as JSON', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get('/api/archival-analytics/export')
        .query({ startDate, endDate, format: 'json' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('summary');
    });

    it('should export archival data as CSV', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get('/api/archival-analytics/export')
        .query({ startDate, endDate, format: 'csv' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('timestamp,event,userId,projectId,projectName,properties');
    });

    it('should validate date parameters', async () => {
      const response = await request(app)
        .get('/api/archival-analytics/report')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Start date and end date are required');
    });

    it('should validate date format', async () => {
      const response = await request(app)
        .get('/api/archival-analytics/report')
        .query({ startDate: 'invalid-date', endDate: 'invalid-date' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid date format');
    });

    it('should validate date range', async () => {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow

      const response = await request(app)
        .get('/api/archival-analytics/report')
        .query({ startDate, endDate })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Start date must be before end date');
    });
  });

  describe('Analytics Service Methods', () => {
    it('should get archival metrics', async () => {
      const metrics = await AnalyticsService.getArchivalMetrics();
      
      expect(metrics).toHaveProperty('totalArchivedProjects');
      expect(metrics).toHaveProperty('projectsArchivedThisMonth');
      expect(metrics).toHaveProperty('averageDaysToArchival');
      expect(metrics).toHaveProperty('renewalRate');
      expect(metrics).toHaveProperty('expiryWarningEffectiveness');
      expect(metrics).toHaveProperty('archivalReasons');
      expect(metrics).toHaveProperty('renewalMethods');
      
      expect(typeof metrics.totalArchivedProjects).toBe('number');
      expect(typeof metrics.renewalRate).toBe('number');
    });

    it('should get subscription health metrics', async () => {
      const metrics = await AnalyticsService.getSubscriptionHealthMetrics();
      
      expect(metrics).toHaveProperty('activeSubscriptions');
      expect(metrics).toHaveProperty('expiringIn7Days');
      expect(metrics).toHaveProperty('expiringIn30Days');
      expect(metrics).toHaveProperty('expiredButNotArchived');
      expect(metrics).toHaveProperty('averageSubscriptionLength');
      expect(metrics).toHaveProperty('churnRate');
      
      expect(typeof metrics.activeSubscriptions).toBe('number');
      expect(typeof metrics.churnRate).toBe('number');
    });

    it('should generate archival report with insights', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();
      
      const report = await AnalyticsService.generateArchivalReport(startDate, endDate);
      
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('insights');
      
      expect(report.period.start).toEqual(startDate);
      expect(report.period.end).toEqual(endDate);
      expect(Array.isArray(report.insights)).toBe(true);
      expect(Array.isArray(report.trends.dailyArchivalCounts)).toBe(true);
      expect(Array.isArray(report.trends.dailyRenewalCounts)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      jest.spyOn(AnalyticsService, 'getArchivalMetrics').mockRejectedValueOnce(new Error('Database error'));
      
      const response = await request(app)
        .get('/api/archival-analytics/metrics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to get archival metrics');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/archival-analytics/metrics');

      expect(response.status).toBe(401);
    });
  });
});