import { logger } from '../utils/logger.js';
import { syncAllTickerListings, syncSingleTokenListing, syncAllSalesHistory, syncAllTraits } from './kaspaDbSync.js';
import { kaspaApi } from './kaspaApi.js';
import { supabaseAdmin, retrySupabaseCall } from '../config/database.js';

// Enhanced metrics collection
class SyncMetrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.apiCalls = {
      kaspa: { total: 0, successful: 0, failed: 0 },
      supabase: { total: 0, successful: 0, failed: 0, retries: 0 }
    };
    this.operations = {
      inserts: { total: 0, successful: 0, failed: 0 },
      updates: { total: 0, successful: 0, failed: 0 },
      deletes: { total: 0, successful: 0, failed: 0 }
    };
    this.phases = {
      apiDataFetch: { startTime: null, endTime: null, duration: 0 },
      databaseOperations: { startTime: null, endTime: null, duration: 0 },
      verification: { startTime: null, endTime: null, duration: 0 }
    };
    this.verification = {
      sampleSize: 0,
      verified: 0,
      discrepancies: 0,
      errors: 0,
      details: []
    };
  }

  startPhase(phaseName) {
    if (this.phases[phaseName]) {
      this.phases[phaseName].startTime = Date.now();
    }
  }

  endPhase(phaseName) {
    if (this.phases[phaseName] && this.phases[phaseName].startTime) {
      this.phases[phaseName].endTime = Date.now();
      this.phases[phaseName].duration = this.phases[phaseName].endTime - this.phases[phaseName].startTime;
    }
  }

  recordApiCall(service, success) {
    if (this.apiCalls[service]) {
      this.apiCalls[service].total++;
      if (success) {
        this.apiCalls[service].successful++;
      } else {
        this.apiCalls[service].failed++;
      }
    }
  }

  recordOperation(operation, success) {
    if (this.operations[operation]) {
      this.operations[operation].total++;
      if (success) {
        this.operations[operation].successful++;
      } else {
        this.operations[operation].failed++;
      }
    }
  }

  recordRetry() {
    this.apiCalls.supabase.retries++;
  }

  getSummary() {
    const totalDuration = Object.values(this.phases).reduce((sum, phase) => sum + phase.duration, 0);
    
    return {
      totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
      phases: Object.fromEntries(
        Object.entries(this.phases).map(([name, phase]) => [
          name, 
          { duration: `${(phase.duration / 1000).toFixed(2)}s` }
        ])
      ),
      apiCalls: this.apiCalls,
      operations: this.operations,
      verification: this.verification
    };
  }
}

// Global metrics instance
const syncMetrics = new SyncMetrics();

// Post-sync data verification function
async function verifyDataIntegrity(ticker, sampleSize = 10) {
  logger.info(`🔍 Starting post-sync data verification for ${ticker} (sample size: ${sampleSize})`);
  syncMetrics.startPhase('verification');
  
  try {
    // Get a random sample of active listings from database
    const { data: sampleListings, error: sampleError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('listings')
        .select('kaspa_order_id, token_id, total_price, rarity_rank, seller_wallet_address, ticker')
        .eq('ticker', ticker)
        .eq('status', 'active')
        .not('kaspa_order_id', 'is', null)
        .limit(sampleSize * 2); // Get more than needed to allow for random selection
    });

    if (sampleError) {
      throw new Error(`Failed to fetch sample listings: ${sampleError.message}`);
    }

    if (!sampleListings || sampleListings.length === 0) {
      logger.warn(`No active listings found for verification in ${ticker}`);
      syncMetrics.verification.sampleSize = 0;
      return { verified: 0, discrepancies: 0, errors: 0, details: [] };
    }

    // Randomly select sample listings
    const shuffled = sampleListings.sort(() => 0.5 - Math.random());
    const selectedSample = shuffled.slice(0, Math.min(sampleSize, shuffled.length));
    
    syncMetrics.verification.sampleSize = selectedSample.length;
    logger.info(`Verifying ${selectedSample.length} randomly selected listings`);

    const verificationResults = {
      verified: 0,
      discrepancies: 0,
      errors: 0,
      details: []
    };

    // Verify each listing against Kaspa API
    for (const listing of selectedSample) {
      try {
        // Fetch the current listing from Kaspa API
        const kaspaResponse = await kaspaApi.fetchListedOrdersForToken(ticker, listing.token_id);
        syncMetrics.recordApiCall('kaspa', true);
        
        const kaspaOrder = kaspaResponse.orders.find(order => order.id === listing.kaspa_order_id);
        
        if (!kaspaOrder) {
          // Listing not found in API - this could be a legitimate removal
          verificationResults.details.push({
            tokenId: listing.token_id,
            kaspaOrderId: listing.kaspa_order_id,
            issue: 'listing_not_found_in_api',
            severity: 'warning',
            description: 'Listing exists in database but not found in Kaspa API'
          });
          continue;
        }

        // Compare critical fields
        const discrepancies = [];
        
        if (parseFloat(listing.total_price) !== kaspaOrder.totalPrice) {
          discrepancies.push({
            field: 'total_price',
            dbValue: listing.total_price,
            apiValue: kaspaOrder.totalPrice
          });
        }

        if (listing.rarity_rank !== kaspaOrder.rarityRank) {
          discrepancies.push({
            field: 'rarity_rank',
            dbValue: listing.rarity_rank,
            apiValue: kaspaOrder.rarityRank
          });
        }

        if (listing.seller_wallet_address !== kaspaOrder.sellerWalletAddress) {
          discrepancies.push({
            field: 'seller_wallet_address',
            dbValue: listing.seller_wallet_address,
            apiValue: kaspaOrder.sellerWalletAddress
          });
        }

        if (discrepancies.length > 0) {
          verificationResults.discrepancies++;
          verificationResults.details.push({
            tokenId: listing.token_id,
            kaspaOrderId: listing.kaspa_order_id,
            issue: 'data_mismatch',
            severity: 'error',
            description: 'Data mismatch between database and Kaspa API',
            discrepancies
          });
          
          logger.warn(`Data discrepancy found for token ${listing.token_id}:`, discrepancies);
        } else {
          verificationResults.verified++;
        }

        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        syncMetrics.recordApiCall('kaspa', false);
        verificationResults.errors++;
        verificationResults.details.push({
          tokenId: listing.token_id,
          kaspaOrderId: listing.kaspa_order_id,
          issue: 'verification_error',
          severity: 'error',
          description: `Failed to verify listing: ${error.message}`
        });
        
        logger.error(`Error verifying token ${listing.token_id}:`, error);
      }
    }

    // Update metrics
    Object.assign(syncMetrics.verification, verificationResults);

    // Log verification summary
    const verificationSummary = {
      sampleSize: selectedSample.length,
      verified: verificationResults.verified,
      discrepancies: verificationResults.discrepancies,
      errors: verificationResults.errors,
      successRate: `${((verificationResults.verified / selectedSample.length) * 100).toFixed(1)}%`
    };

    if (verificationResults.discrepancies > 0 || verificationResults.errors > 0) {
      logger.warn(`⚠️ Data verification completed with issues for ${ticker}:`, verificationSummary);
      
      // Log detailed issues
      verificationResults.details.forEach(detail => {
        if (detail.severity === 'error') {
          logger.error(`Verification issue for token ${detail.tokenId}:`, detail);
        } else {
          logger.warn(`Verification warning for token ${detail.tokenId}:`, detail);
        }
      });
    } else {
      logger.info(`✅ Data verification passed for ${ticker}:`, verificationSummary);
    }

    return verificationResults;

  } catch (error) {
    logger.error(`Data verification failed for ${ticker}:`, error);
    syncMetrics.verification.errors++;
    return { verified: 0, discrepancies: 0, errors: 1, details: [] };
  } finally {
    syncMetrics.endPhase('verification');
  }
}

export const syncKaspaListings = async (singleBatch = null) => {
  // Check if sync is enabled
  const startTime = Date.now();
  syncMetrics.reset();
  
  if (process.env.KASPA_SYNC_ENABLED !== 'true') {
    logger.info('Kaspa sync is disabled via KASPA_SYNC_ENABLED environment variable');
    return { message: 'Sync disabled', enabled: false };
  }

  const ticker = 'KASPUNKS';
  const startTokenId = singleBatch ? ((singleBatch - 1) * 10) + 1 : 1;
  const endTokenId = singleBatch ? singleBatch * 10 : 1000;
  
  if (singleBatch) {
    logger.info(`🧪 Starting SINGLE BATCH sync for ${ticker} (batch ${singleBatch}: tokens ${startTokenId}-${endTokenId})`);
  } else {
    logger.info(`🔄 Starting full sync for ${ticker} using efficient batch method`);
  }

  const results = {
    added: 0,
    updated: 0,
    removed: 0,
    errors: 0,
    noChange: 0,
    durationMs: 0,
    durationSeconds: '',
    startTime: new Date(startTime).toISOString(),
    endTime: '',
    finalDatabaseCount: undefined,
    verification: null,
    metrics: null
  };

  try {
    if (singleBatch) {
      // Single batch mode - process tokens one by one
      syncMetrics.startPhase('databaseOperations');
      let listingsFound = 0;
      
      for (let tokenId = startTokenId; tokenId <= endTokenId; tokenId++) {
        try {
          syncMetrics.recordApiCall('kaspa', true);
          const result = await syncSingleTokenListing(ticker, tokenId);
          
          // Count listings found
          if (result.action === 'added' || result.action === 'updated' || result.action === 'no_change') {
            listingsFound++;
          }
          
          switch (result.action) {
            case 'added':
              results.added++;
              syncMetrics.recordOperation('inserts', true);
              break;
            case 'updated':
              results.updated++;
              syncMetrics.recordOperation('updates', true);
              break;
            case 'removed':
              results.removed++;
              syncMetrics.recordOperation('deletes', true);
              break;
            case 'error':
              results.errors++;
              syncMetrics.recordOperation('updates', false);
              break;
            default:
              results.noChange++;
          }

          // Add delay between requests to respect rate limits
          if (tokenId % 10 === 0) {
            logger.info(`🔄 Token sync progress ${tokenId}/${endTokenId} - Active ${listingsFound}, Added: ${results.added}, Updated: ${results.updated}, Removed: ${results.removed}, Errors: ${results.errors}`);
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay every 10 requests
          } else {
            await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay between requests
          }

        } catch (error) {
          logger.error(`Failed to sync token ${tokenId}:`, error);
          results.errors++;
          syncMetrics.recordApiCall('kaspa', false);
          syncMetrics.recordOperation('updates', false);
        }
      }
      syncMetrics.endPhase('databaseOperations');

    } else {
      // Full sync mode - use the more efficient syncAllTickerListings method
      logger.info(`🚀 Starting full sync using syncAllTickerListings for ${ticker}...`);
      
      syncMetrics.startPhase('apiDataFetch');
      syncMetrics.startPhase('databaseOperations');
      
      const syncResults = await syncAllTickerListings(ticker);
      
      syncMetrics.endPhase('apiDataFetch');
      syncMetrics.endPhase('databaseOperations');
      
      // Record metrics for full sync
      syncMetrics.recordApiCall('kaspa', true); // Assume API calls were successful if we got results
      syncMetrics.recordOperation('inserts', syncResults.added > 0);
      syncMetrics.recordOperation('updates', syncResults.updated > 0);
      syncMetrics.recordOperation('deletes', syncResults.removed > 0);
      
      // Map the results from syncAllTickerListings to our results format
      results.added = syncResults.added;
      results.updated = syncResults.updated;
      results.removed = syncResults.removed;
      results.finalDatabaseCount = syncResults.finalDatabaseCount;
      
      // For full sync, calculate noChange based on total minus operations
      results.noChange = syncResults.total - syncResults.added - syncResults.updated - syncResults.removed;
      results.errors = syncResults.errors || 0;
    }

    // Perform post-sync data verification (only for full sync or larger batches)
    if (!singleBatch || (endTokenId - startTokenId + 1) >= 50) {
      const verificationSampleSize = singleBatch ? 3 : 10; // Smaller sample for batch mode
      results.verification = await verifyDataIntegrity(ticker, verificationSampleSize);
    }

  } catch (error) {
    logger.error(`Error during sync:`, error);
    results.errors++;
    syncMetrics.recordOperation('updates', false);
  }

  // Calculate duration and collect metrics
  const endTime = Date.now();
  results.durationMs = endTime - startTime;
  results.durationSeconds = `${(results.durationMs / 1000).toFixed(2)}s`;
  results.endTime = new Date(endTime).toISOString();
  results.metrics = syncMetrics.getSummary();

  // Enhanced logging with detailed metrics
  const logData = {
    ...results,
    syncMode: singleBatch ? `batch_${singleBatch}` : 'full_sync',
    ticker,
    performance: {
      totalDuration: results.durationSeconds,
      apiCallsPerSecond: (syncMetrics.apiCalls.kaspa.total / (results.durationMs / 1000)).toFixed(2),
      operationsPerSecond: (
        (syncMetrics.operations.inserts.total + syncMetrics.operations.updates.total + syncMetrics.operations.deletes.total) / 
        (results.durationMs / 1000)
      ).toFixed(2)
    }
  };

  if (singleBatch) {
    logger.info(`🧪 Single batch sync completed for ${ticker} (batch ${singleBatch}):`, logData);
  } else {
    logger.info(`✅ Full sync completed for ${ticker}:`, logData);
  }

  // Log any verification issues
  if (results.verification && (results.verification.discrepancies > 0 || results.verification.errors > 0)) {
    logger.warn(`⚠️ Post-sync verification found ${results.verification.discrepancies} discrepancies and ${results.verification.errors} errors`);
  }
  
  return results;
};

export const syncKaspaSalesHistory = async (options = {}) => {
  // Check if sync is enabled
  const startTime = Date.now();
  if (process.env.KASPA_SYNC_ENABLED !== 'true') {
    logger.info('Kaspa sales history sync is disabled via KASPA_SYNC_ENABLED environment variable');
    return { message: 'Sync disabled', enabled: false };
  }

  const ticker = 'KASPUNKS';
  const {
    startTokenId = 1,
    endTokenId = 1000,
    batchSize = 10
  } = options;

  logger.info(`📈 Starting sales history sync for ${ticker} (tokens ${startTokenId}-${endTokenId})`);

  try {
    const results = await syncAllSalesHistory(ticker, {
      startTokenId,
      endTokenId,
      batchSize,
      delayBetweenTokens: 100, // 100ms between tokens
      delayBetweenBatches: 1000 // 1s between batches
    });

    // Calculate duration
    const endTime = Date.now();
    results.durationMs = endTime - startTime;
    results.durationSeconds = `${(results.durationMs / 1000).toFixed(2)}s`;

    // Enhanced logging for sales history sync
    const enhancedResults = {
      ...results,
      performance: {
        tokensPerSecond: (results.totalTokensProcessed / (results.durationMs / 1000)).toFixed(2),
        salesPerSecond: (results.totalSalesFound / (results.durationMs / 1000)).toFixed(2),
        averageSalesPerToken: results.totalTokensProcessed > 0 ? 
          (results.totalSalesFound / results.totalTokensProcessed).toFixed(2) : '0'
      }
    };

    logger.info(`✅ Sales history sync completed for ${ticker}:`, enhancedResults);
    
    return enhancedResults;

  } catch (error) {
    logger.error(`💥 Error during sales history sync:`, error);
    
    const endTime = Date.now();
    return {
      totalTokensProcessed: 0,
      totalSalesFound: 0,
      totalSalesAdded: 0,
      totalSalesUpdated: 0,
      totalErrors: 1,
      tokensWithSales: 0,
      tokensWithoutSales: 0,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      durationMs: endTime - startTime,
      durationSeconds: `${((endTime - startTime) / 1000).toFixed(2)}s`,
      error: error.message
    };
  }
};

// NEW: Comprehensive trait sync orchestrator
export const syncKaspaTraits = async (options = {}) => {
  // Check if sync is enabled
  const startTime = Date.now();
  if (process.env.KASPA_SYNC_ENABLED !== 'true') {
    logger.info('Kaspa trait sync is disabled via KASPA_SYNC_ENABLED environment variable');
    return { message: 'Sync disabled', enabled: false };
  }

  const ticker = 'KASPUNKS';
  const {
    startTokenId = 1,
    endTokenId = 1000,
    batchSize = 10
  } = options;

  logger.info(`🎨 Starting comprehensive trait sync for ${ticker} (tokens ${startTokenId}-${endTokenId})`);

  try {
    const results = await syncAllTraits(ticker, {
      startTokenId,
      endTokenId,
      batchSize,
      delayBetweenTokens: 150, // 150ms between tokens (slightly slower for trait API)
      delayBetweenBatches: 2000 // 2s between batches
    });

    // Calculate duration
    const endTime = Date.now();
    results.durationMs = endTime - startTime;
    results.durationSeconds = `${(results.durationMs / 1000).toFixed(2)}s`;

    // Enhanced logging for trait sync
    const enhancedResults = {
      ...results,
      performance: {
        tokensPerSecond: (results.totalTokensProcessed / (results.durationMs / 1000)).toFixed(2),
        traitsPerSecond: (results.totalTraitsFound / (results.durationMs / 1000)).toFixed(2),
        averageTraitsPerToken: results.totalTokensProcessed > 0 ? 
          (results.totalTraitsFound / results.totalTokensProcessed).toFixed(2) : '0'
      }
    };

    logger.info(`✅ Comprehensive trait sync completed for ${ticker}:`, enhancedResults);
    
    return enhancedResults;

  } catch (error) {
    logger.error(`💥 Error during trait sync:`, error);
    
    const endTime = Date.now();
    return {
      totalTokensProcessed: 0,
      totalTraitsFound: 0,
      totalTraitsSynced: 0,
      totalErrors: 1,
      tokensWithTraits: 0,
      tokensWithoutTraits: 0,
      tokensWithErrors: 0,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      durationMs: endTime - startTime,
      durationSeconds: `${((endTime - startTime) / 1000).toFixed(2)}s`,
      error: error.message
    };
  }
};