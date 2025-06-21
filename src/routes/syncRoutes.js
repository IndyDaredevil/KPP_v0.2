import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { syncKaspunkOwnership } from '../services/kaspunkOwnershipSyncService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/sync/kaspunk-ownership:
 *   post:
 *     summary: Sync KasPunk token ownership data
 *     description: Fetches ownership data from Kaspa API and updates the database with current token ownership information
 *     tags: [Sync Operations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ownership sync completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "KasPunk ownership data synced successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     duration_ms:
 *                       type: number
 *                       example: 45000
 *                     total_ownership_records:
 *                       type: number
 *                       example: 1000
 *                     unique_tokens:
 *                       type: number
 *                       example: 1000
 *                     unique_owners:
 *                       type: number
 *                       example: 456
 *                     collection_stats:
 *                       type: object
 *                       properties:
 *                         total_supply:
 *                           type: number
 *                           example: 1000
 *                         total_minted:
 *                           type: number
 *                           example: 1000
 *                         total_holders:
 *                           type: number
 *                           example: 456
 *                         average_holding:
 *                           type: number
 *                           example: 2.19
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error during sync operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Sync operation failed"
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch ownership data from Kaspa API"
 */
router.post('/kaspunk-ownership', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  logger.info(`🔄 KasPunk ownership sync initiated by user: ${req.user.email} (${req.user.id})`);
  
  try {
    const result = await syncKaspunkOwnership();
    
    logger.info(`✅ KasPunk ownership sync completed successfully for user: ${req.user.email}`, {
      duration: result.duration_ms,
      totalRecords: result.total_ownership_records,
      uniqueOwners: result.unique_owners
    });

    res.json({
      success: true,
      message: 'KasPunk ownership sync completed successfully',
      data: result
    });

  } catch (error) {
    logger.error(`❌ KasPunk ownership sync failed for user: ${req.user.email}`, error);
    
    // If error is already formatted from the service, use it directly
    if (error.success === false) {
      return res.status(500).json({
        success: false,
        message: 'Sync operation failed',
        error: error.error,
        data: {
          duration_ms: error.duration_ms,
          timestamp: error.timestamp
        }
      });
    }

    // Otherwise, format the error
    res.status(500).json({
      success: false,
      message: 'Sync operation failed',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}));

/**
 * @swagger
 * /api/sync/status:
 *   get:
 *     summary: Get sync operation status
 *     description: Returns the current status and configuration of sync operations
 *     tags: [Sync Operations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     sync_enabled:
 *                       type: boolean
 *                       example: true
 *                     available_operations:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["kaspunk-ownership"]
 *                     environment:
 *                       type: string
 *                       example: "production"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */
router.get('/status', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const syncEnabled = process.env.KASPA_SYNC_ENABLED === 'true';
  
  res.json({
    success: true,
    data: {
      sync_enabled: syncEnabled,
      available_operations: ['kaspunk-ownership'],
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
}));

export default router;