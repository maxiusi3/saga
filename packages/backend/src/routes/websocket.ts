import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { getConnectionStats } from '../websocket'

const router = Router()

/**
 * Get WebSocket connection statistics
 * Requires authentication
 */
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const stats = getConnectionStats()
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error getting WebSocket stats:', error)
    res.status(500).json({
      error: {
        code: 'WEBSOCKET_STATS_ERROR',
        message: 'Failed to retrieve WebSocket statistics',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }
})

/**
 * Health check endpoint for WebSocket server
 */
router.get('/health', (req, res) => {
  try {
    const stats = getConnectionStats()
    const isHealthy = stats.totalConnections >= 0 // Basic health check
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      connections: stats.totalConnections,
      projects: stats.projectCount,
      users: stats.userCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('WebSocket health check error:', error)
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    })
  }
})

export { router as websocketRoutes }