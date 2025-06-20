import express from 'express';
import { supabase, supabaseAdmin, retrySupabaseCall } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { 
  validatePagination, 
  validateListingId
} from '../middleware/validation.js';
import { kaspaApi } from '../services/kaspaApi.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Helper function to extract and flatten image URL from nested token data
function flattenImageUrl(listing) {
  if (listing.tokens && listing.tokens.token_images && listing.tokens.token_images.public_url {
    listing.image_url = listing.tokens.token_images[0].public_url;
  } else {
    listing.image_url = null;
  }
  // Remove the nested tokens property to keep response clean
  delete listing.tokens;
  return listing;
}

/**
 * @swagger
 * /api/listings:
 *   get:
 *     summary: Get all active listings
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: ticker
 *         schema:
 *           type: string
 *         description: Filter by ticker
 *       - in: query
 *         name: token_id
 *         schema:
 *           type: integer
 *         description: Filter by token ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, sold, cancelled, expired, manually_removed, api_sync_removed, price_changed, manually_updated, unknown]
 *         description: Filter by status (defaults to 'active' for this endpoint)
 *     responses:
 *       200:
 *         description: Listings retrieved successfully
 */
router.get('/', authenticate, validatePagination, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const { ticker, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
  
  // Parse token_id as integer
  const token_id = req.query.token_id ? parseInt(req.query.token_id) : undefined;
  
  // Default to active listings for this endpoint
  const status = req.query.status || 'active';

  const result = await retrySupabaseCall(async () => {
    let query = req.supabaseClient
      .from('listings')
      .select('*, tokens(token_images(public_url))', { count: 'exact' });

    // Apply status filter
    query = query.eq('status', status);

    // Apply other filters
    if (ticker) {
      query = query.eq('ticker', ticker);
    }

    if (token_id !== undefined) {
      query = query.eq('token_id', token_id);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    return await query;
  });

  const { data, error, count } = result;

  if (error) {
    logger.error('Error fetching listings:', error);
    throw error;
  }

  // Flatten the image URLs for each listing
  const listingsWithImages = (data || []).map(flattenImageUrl);

  res.json({
    success: true,
    data: {
      listings: listingsWithImages,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /api/listings/historical:
 *   get:
 *     summary: Get historical listings
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: ticker
 *         schema:
 *           type: string
 *         description: Filter by ticker
 *       - in: query
 *         name: token_id
 *         schema:
 *           type: integer
 *         description: Filter by token ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [sold, cancelled, expired, manually_removed, api_sync_removed, price_changed, manually_updated, unknown]
 *         description: Filter by specific historical status
 *     responses:
 *       200:
 *         description: Historical listings retrieved successfully
 */
router.get('/historical', authenticate, validatePagination, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const { ticker, status, sortBy = 'deactivated_at', sortOrder = 'desc' } = req.query;
  
  // Parse token_id as integer
  const token_id = req.query.token_id ? parseInt(req.query.token_id) : undefined;

  const result = await retrySupabaseCall(async () => {
    let query = req.supabaseClient
      .from('listings')
      .select('*, tokens(token_images(public_url))', { count: 'exact' });

    // Filter for non-active listings
    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.neq('status', 'active');
    }

    // Apply other filters
    if (ticker) {
      query = query.eq('ticker', ticker);
    }

    if (token_id !== undefined) {
      query = query.eq('token_id', token_id);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    return await query;
  });

  const { data, error, count } = result;

  if (error) {
    logger.error('Error fetching historical listings:', error);
    throw error;
  }

  // Flatten the image URLs for each historical listing
  const historicalListingsWithImages = (data || []).map(flattenImageUrl);

  res.json({
    success: true,
    data: {
      listings: historicalListingsWithImages,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  });
}));

/**
 * Handler for getting all sales history - exported for reuse
 */
export const getAllSalesHistoryHandler = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;
  const offset = (page - 1) * limit;
  const { ticker, sortBy = 'sale_date', sortOrder = 'desc' } = req.query;
  
  // Parse token_id as integer
  const token_id = req.query.token_id ? parseInt(req.query.token_id) : undefined;

  const result = await retrySupabaseCall(async () => {
    let query = req.supabaseClient
      .from('sales_history')
      .select('*', { count: 'exact' });

    // Apply filters
    if (ticker) {
      // Note: sales_history table doesn't have ticker field directly
      // We'll need to join with tokens table or filter differently
      // For now, we'll skip ticker filtering on sales_history
      logger.warn('Ticker filtering not implemented for sales_history endpoint');
    }

    if (token_id !== undefined) {
      query = query.eq('token_id', token_id);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    return await query;
  });

  const { data, error, count } = result;

  if (error) {
    logger.error('Error fetching sales history:', error);
    throw error;
  }

  res.json({
    success: true,
    data: {
      sales: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  });
});

/**
 * @swagger
 * /api/sales-history:
 *   get:
 *     summary: Get all sales history
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: ticker
 *         schema:
 *           type: string
 *         description: Filter by ticker
 *       - in: query
 *         name: token_id
 *         schema:
 *           type: integer
 *         description: Filter by token ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [sale_price, sale_date, token_id]
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Sales history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sales:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SalesRecord'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 */
router.get('/sales-history', authenticate, validatePagination, getAllSalesHistoryHandler);

/**
 * @swagger
 * /api/listings/sales-history/{tokenId}:
 *   get:
 *     summary: Get sales history for a specific token
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Token ID to get sales history for
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [totalPrice, createdAt, fullfillmentTimestamp]
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Sales history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     listings:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/KaspaCompletedOrder'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       404:
 *         description: No sales history found for token
 */
router.get('/sales-history/:tokenId', authenticate, validatePagination, asyncHandler(async (req, res) => {
  // Parse tokenId as integer
  const tokenId = parseInt(req.params.tokenId);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;
  const offset = (page - 1) * limit;
  const { sortBy = 'fullfillmentTimestamp', sortOrder = 'desc' } = req.query;

  // Validate tokenId
  if (!tokenId || isNaN(tokenId) || tokenId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Token ID must be a positive integer'
    });
  }

  try {
    // Fetch completed orders from Kaspa API
    const response = await kaspaApi.fetchCompletedOrdersForToken('KASPUNKS', tokenId, {
      offset,
      limit,
      sortField: sortBy,
      sortDirection: sortOrder
    });

    logger.info(`Sales history request for token ${tokenId}`, {
      tokenId,
      page,
      limit,
      sortBy,
      sortOrder,
      totalFound: response.totalCount
    });

    res.json({
      success: true,
      data: {
        listings: response.orders,
        pagination: {
          page,
          limit,
          total: response.totalCount,
          totalPages: Math.ceil(response.totalCount / limit)
        }
      }
    });

  } catch (error) {
    logger.error(`Error fetching sales history for token ${tokenId}:`, error);
    
    // Return empty result instead of error for better UX
    res.json({
      success: true,
      data: {
        listings: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      }
    });
  }
}));

/**
 * @swagger
 * /api/listings/{id}:
 *   get:
 *     summary: Get listing by ID
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Listing retrieved successfully
 *       404:
 *         description: Listing not found
 */
router.get('/:id', authenticate, validateListingId, asyncHandler(async (req, res) => {
  // Parse id as integer
  const id = parseInt(req.params.id);

  const result = await retrySupabaseCall(async () => {
    return await req.supabaseClient
      .from('listings')
      .select('*, tokens(token_images(public_url))')
      .eq('id', id)
      .single();
  });

  const { data: listing, error } = result;

  if (error) {
    if (error.code === 'PGRST116') { // No rows returned
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    logger.error('Error fetching listing:', error);
    throw error;
  }

  // Flatten the image URL for the single listing
  const listingWithImage = flattenImageUrl(listing);

  res.json({
    success: true,
    data: { listing: listingWithImage }
  });
}));

export default router;