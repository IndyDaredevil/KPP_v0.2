import axios from 'axios';
import { supabaseAdmin, retrySupabaseCall } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Comprehensive Kaspunk ownership sync service
 * Enhanced with upsert-based approach for better WebContainer stability
 */

class KaspunkOwnershipSyncService {
  constructor() {
    this.apiUrl = 'https://mainnet.krc721.stream/api/v1/krc721/mainnet/owners/KASPUNKS';
    this.maxPages = 100; // Safety limit to prevent infinite loops
    this.batchSize = 25; // Reduced batch size for better stability
    this.ownerBatchSize = 25; // Reduced batch size for owner records
    this.requestTimeout = 30000; // Reduced timeout for faster failure detection
    this.requestDelay = 300; // Reduced delay between API requests
    this.batchDelay = 100; // Reduced delay between database batches
    this.maxRetries = 3; // Reduced retries for faster failure detection
  }

  /**
   * Normalize wallet address to ensure consistency
   */
  normalizeWalletAddress(address) {
    if (!address || typeof address !== 'string') {
      return null;
    }
    // Trim whitespace and convert to lowercase for consistency
    return address.trim().toLowerCase();
  }

  /**
   * Main sync function - orchestrates the entire ownership sync process
   */
  async syncKaspunkOwnership() {
    const startTime = Date.now();
    
    try {
      logger.info('🔍 Starting KasPunk token ownership sync (token_id deduplication only)...');

      // Step 1: Fetch all ownership data from Kaspa API
      const allOwnershipData = await this.fetchAllOwnershipData();
      
      if (allOwnershipData.length === 0) {
        throw new Error('No valid ownership data received from Kaspa API');
      }

      logger.info(`📊 Total ownership records collected: ${allOwnershipData.length}`);

      // Step 2: Upsert token ownership data (with token_id deduplication)
      await this.upsertTokenOwnershipTable(allOwnershipData);

      // DISABLED: Step 3: Calculate token counts per wallet
      // const walletTokenCounts = this.calculateWalletTokenCounts(allOwnershipData);
      // logger.info(`📊 Found ${walletTokenCounts.size} unique wallet addresses`);

      // DISABLED: Step 4: Upsert owners data
      // await this.upsertOwnersTable(walletTokenCounts);

      // DISABLED: Step 5: Update collection statistics
      // await this.updateCollectionStats(allOwnershipData, walletTokenCounts);

      // Calculate final statistics
      const uniqueTokens = new Set(allOwnershipData.map(item => item.token_id)).size;
      const duration = Date.now() - startTime;

      const result = {
        success: true,
        message: 'KasPunk ownership data synced successfully',
        duration_ms: duration,
        total_ownership_records: allOwnershipData.length,
        unique_tokens: uniqueTokens,
        timestamp: new Date().toISOString()
      };

      logger.info('✅ KasPunk ownership sync completed successfully:', result);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('❌ KasPunk ownership sync failed:', error);
      
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        duration_ms: duration,
        timestamp: new Date().toISOString()
      };

      throw errorResult;
    }
  }

  /**
   * Fetch all ownership data from Kaspa API with pagination and WebContainer optimizations
   */
  async fetchAllOwnershipData() {
    const allOwnershipData = [];
    let offset = 0;
    let pageCount = 0;

    logger.info('📡 Fetching token ownership data from Kaspa API...');

    while (pageCount < this.maxPages && offset !== null) {
      pageCount++;
      
      // Construct API URL with pagination
      let apiUrl = this.apiUrl;
      if (offset !== undefined && offset !== null) {
        apiUrl += `?offset=${offset}`;
      }

      logger.debug(`📄 Fetching page ${pageCount}${offset ? ` (offset: ${offset})` : ''}...`);

      let lastError;
      let success = false;

      // Retry logic for API calls
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          logger.debug(`🔄 [KASPA API] Attempt ${attempt}/${this.maxRetries} for page ${pageCount}`);

          // Fetch data from Kaspa API
          const response = await axios.get(apiUrl, {
            timeout: this.requestTimeout,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'KasPunkPredictor/1.0',
              'Cache-Control': 'no-cache'
            },
            maxRedirects: 3,
            validateStatus: (status) => status >= 200 && status < 300
          });

          const data = response.data;
          logger.debug(`📄 Raw response preview: ${JSON.stringify(data).substring(0, 200)}...`);

          // Handle different response formats
          let ownershipRecords = [];
          if (data.result && Array.isArray(data.result)) {
            ownershipRecords = data.result;
          } else if (Array.isArray(data)) {
            ownershipRecords = data;
          } else if (data.owners && Array.isArray(data.owners)) {
            ownershipRecords = data.owners;
          } else {
            logger.error(`❌ Unexpected response format:`, data);
            throw new Error('Invalid response format from Kaspa API - no recognizable data structure');
          }

          logger.info(`✅ Page ${pageCount}: Received ${ownershipRecords.length} ownership records`);

          // Process the ownership data
          for (const item of ownershipRecords) {
            const processedItem = this.processOwnershipRecord(item);
            if (processedItem) {
              allOwnershipData.push(processedItem);
            }
          }

          // Check if there's a next page
          if (data.next !== undefined && data.next !== null) {
            offset = data.next;
            logger.debug(`🔄 Next page available with offset: ${offset}`);
          } else if (data.hasMore === true) {
            offset = (offset || 0) + ownershipRecords.length;
            logger.debug(`🔄 Next page available with calculated offset: ${offset}`);
          } else {
            logger.info('✅ No more pages available');
            offset = null;
            success = true;
            break;
          }

          success = true;
          break; // Success, exit retry loop

        } catch (error) {
          lastError = error;
          
          logger.error(`❌ Error fetching page ${pageCount} (attempt ${attempt}/${this.maxRetries}):`, {
            errorMessage: error.message,
            errorCode: error.code,
            status: error.response?.status
          });

          // Don't retry on certain errors
          if (error.response?.status === 404 || error.response?.status === 401 || error.response?.status === 403) {
            logger.error(`❌ Non-retryable error for page ${pageCount}: ${error.response.status}`);
            break;
          }

          // Wait before retrying (exponential backoff)
          if (attempt < this.maxRetries) {
            const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            logger.warn(`🔄 Retrying page ${pageCount} in ${retryDelay}ms`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }

      if (!success) {
        throw new Error(`Failed to fetch ownership data from Kaspa API after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
      }

      // If we've reached the end (offset is null), break
      if (offset === null) {
        break;
      }

      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, this.requestDelay));
    }

    if (pageCount >= this.maxPages) {
      logger.warn(`⚠️ Reached maximum page limit (${this.maxPages}). There might be more data available.`);
    }

    return allOwnershipData;
  }

  /**
   * Process individual ownership record from API response
   */
  processOwnershipRecord(item) {
    let tokenId;
    let owner;

    if (item.tokenId && item.owner) {
      tokenId = parseInt(item.tokenId, 10);
      owner = item.owner;
    } else if (item.token_id && item.wallet_address) {
      tokenId = parseInt(String(item.token_id), 10);
      owner = item.wallet_address;
    } else if (item.id && item.address) {
      tokenId = parseInt(String(item.id), 10);
      owner = item.address;
    } else {
      logger.warn(`⚠️ Skipping invalid ownership record:`, item);
      return null;
    }

    // Normalize the wallet address to ensure consistency
    const normalizedOwner = this.normalizeWalletAddress(owner);

    if (!isNaN(tokenId) && tokenId > 0 && normalizedOwner) {
      return {
        token_id: tokenId,
        wallet_address: normalizedOwner
      };
    }

    return null;
  }

  /**
   * Upsert token ownership data with token_id deduplication
   */
  async upsertTokenOwnershipTable(allOwnershipData) {
    logger.info('💾 Upserting token ownership data (token_id deduplication only)...');
    
    // Step 1: Deduplicate by token_id only (keep last occurrence)
    const deduplicatedData = new Map();
    for (const record of allOwnershipData) {
      // Use only token_id as the key to ensure uniqueness by token_id
      deduplicatedData.set(record.token_id, record);
    }
    
    const uniqueOwnershipData = Array.from(deduplicatedData.values());
    
    if (uniqueOwnershipData.length !== allOwnershipData.length) {
      logger.info(`📊 Removed ${allOwnershipData.length - uniqueOwnershipData.length} duplicate token_id records from API data`);
    }

    let upsertedOwnershipCount = 0;

    // Step 2: Upsert all data in batches
    for (let i = 0; i < uniqueOwnershipData.length; i += this.batchSize) {
      const batch = uniqueOwnershipData.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(uniqueOwnershipData.length / this.batchSize);

      logger.debug(`📝 Upserting ownership batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);

      // Use upsert with conflict resolution on token_id only
      const { error: upsertError } = await retrySupabaseCall(async () => {
        return await supabaseAdmin
          .from('kaspunk_token_ownership')
          .upsert(batch, {
            onConflict: 'token_id',
            ignoreDuplicates: false
          });
      }, 3, 2000);

      if (upsertError) {
        logger.error(`❌ Error upserting ownership batch ${batchNumber}:`, upsertError);
        throw new Error(`Failed to upsert ownership data: ${upsertError.message}`);
      }

      upsertedOwnershipCount += batch.length;
      logger.debug(`✅ Ownership batch ${batchNumber} upserted successfully`);

      // Shorter delay between batches
      if (batchNumber < totalBatches) {
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }

    logger.info(`✅ Upserted ${upsertedOwnershipCount} ownership records`);

    // Step 3: Verify final record count
    const { count: finalCount, error: finalCountError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('kaspunk_token_ownership')
        .select('*', { count: 'exact', head: true });
    }, 3, 2000);

    if (finalCountError) {
      logger.warn('⚠️ Could not verify final record count:', finalCountError.message);
    } else {
      logger.info(`📊 Final records in kaspunk_token_ownership: ${finalCount || 0}`);
    }
  }

  /**
   * Calculate token counts per wallet address
   * DISABLED - not used in current implementation
   */
  calculateWalletTokenCounts(allOwnershipData) {
    logger.info('📊 Calculating token counts per wallet...');
    
    const walletTokenCounts = new Map();
    
    for (const ownership of allOwnershipData) {
      const currentCount = walletTokenCounts.get(ownership.wallet_address) || 0;
      walletTokenCounts.set(ownership.wallet_address, currentCount + 1);
    }

    logger.debug(`📊 Wallet calculation complete: ${walletTokenCounts.size} unique wallets`);
    return walletTokenCounts;
  }

  /**
   * Upsert owners data - DISABLED
   */
  async upsertOwnersTable(walletTokenCounts) {
    logger.info('💾 Upserting kaspunk_owners data - DISABLED...');
    // This function is disabled as requested
    return;
  }

  /**
   * Update collection statistics - DISABLED
   */
  async updateCollectionStats(allOwnershipData, walletTokenCounts) {
    logger.info('📊 Updating collection statistics - DISABLED...');
    // This function is disabled as requested
    return;
  }
}

// Export singleton instance
export const kaspunkOwnershipSyncService = new KaspunkOwnershipSyncService();

// Export the main sync function for direct use
export const syncKaspunkOwnership = () => kaspunkOwnershipSyncService.syncKaspunkOwnership();