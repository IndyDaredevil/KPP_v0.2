import axios from 'axios';
import { supabaseAdmin, retrySupabaseCall } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Comprehensive Kaspunk ownership sync service
 * Updated for new table structure with unique_token_id constraint
 */

class KaspunkOwnershipSyncService {
  constructor() {
    this.apiUrl = 'https://mainnet.krc721.stream/api/v1/krc721/mainnet/owners/KASPUNKS';
    this.maxPages = 100; // Safety limit to prevent infinite loops
    this.batchSize = 25; // Reduced batch size for better stability
    this.requestTimeout = 30000; // Reduced timeout for faster failure detection
    this.requestDelay = 300; // Reduced delay between API requests
    this.batchDelay = 500; // Increased delay between database batches for network stability
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
      logger.info('🔍 Starting KasPunk token ownership sync (one record per token_id)...');

      // Step 1: Check current table state
      await this.checkCurrentTableState();

      // Step 2: Fetch all ownership data from Kaspa API
      const allOwnershipData = await this.fetchAllOwnershipData();
      
      if (allOwnershipData.length === 0) {
        throw new Error('No valid ownership data received from Kaspa API');
      }

      logger.info(`📊 Total ownership records collected: ${allOwnershipData.length}`);

      // Step 3: Deduplicate by token_id (should be 1000 unique records)
      const deduplicatedData = this.deduplicateByTokenId(allOwnershipData);

      // Step 4: Show sample data for debugging
      this.logSampleData(deduplicatedData);

      // Step 5: Upsert token ownership data
      await this.upsertTokenOwnershipTable(deduplicatedData);

      // Calculate final statistics
      const uniqueTokens = deduplicatedData.length;
      const duration = Date.now() - startTime;

      const result = {
        success: true,
        message: 'KasPunk ownership data synced successfully',
        duration_ms: duration,
        total_ownership_records: deduplicatedData.length,
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
   * Check current table state for debugging
   */
  async checkCurrentTableState() {
    try {
      logger.info('🔍 Checking current table state...');
      
      // Temporarily disable table state check to avoid syntax errors
      logger.info('📊 Table state check temporarily disabled');
      
      /*
      const { count: currentCount, error: countError } = await retrySupabaseCall(async () => {
        return await supabaseAdmin
          .from('kaspunk_token_ownership')
          .select('*', { count: 'exact', head: true });
      }, 3, 2000);

      if (countError) {
        logger.warn('⚠️ Could not check current table state:', countError.message);
      } else {
        logger.info(`📊 Current table has ${currentCount || 0} records`);
        
        // Get a few sample records to see the structure
        const { data: sampleRecords, error: sampleError } = await retrySupabaseCall(async () => {
          return await supabaseAdmin
            .from('kaspunk_token_ownership')
            .select('token_id, wallet_address')
            .limit(3);
        }, 3, 2000);

        if (!sampleError && sampleRecords && sampleRecords.length > 0) {
          logger.info('📋 Sample existing records:', sampleRecords);
        }
      }
      */
    } catch (error) {
      logger.warn('⚠️ Error checking table state:', error.message);
    }
  }

  /**
   * Log sample data for debugging
   */
  logSampleData(data) {
    if (data && data.length > 0) {
      const sampleSize = Math.min(3, data.length);
      const samples = data.slice(0, sampleSize);
      logger.info(`📋 Sample data to upsert (first ${sampleSize} records):`, samples);
    }
  }

  /**
   * Fetch all ownership data from Kaspa API with pagination
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
   * Deduplicate ownership data by token_id (keep the last occurrence)
   */
  deduplicateByTokenId(allOwnershipData) {
    logger.info('🔍 Deduplicating ownership data by token_id...');
    
    const deduplicatedMap = new Map();
    
    // Process records and keep the last occurrence for each token_id
    for (const record of allOwnershipData) {
      deduplicatedMap.set(record.token_id, record);
    }
    
    const deduplicatedData = Array.from(deduplicatedMap.values());
    
    const duplicatesRemoved = allOwnershipData.length - deduplicatedData.length;
    if (duplicatesRemoved > 0) {
      logger.info(`📊 Removed ${duplicatesRemoved} duplicate token_id records (kept last occurrence for each token)`);
    } else {
      logger.info('📊 No duplicates found - all token_ids are unique');
    }
    
    logger.info(`📊 Final deduplicated records: ${deduplicatedData.length}`);
    
    return deduplicatedData;
  }

  /**
   * Upsert token ownership data to the new table structure
   */
  async upsertTokenOwnershipTable(ownershipData) {
    logger.info(`💾 Upserting ${ownershipData.length} token ownership records...`);
    
    let upsertedCount = 0;

    // Process data in batches
    for (let i = 0; i < ownershipData.length; i += this.batchSize) {
      const batch = ownershipData.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(ownershipData.length / this.batchSize);

      logger.debug(`📝 Upserting ownership batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);

      // Prepare batch data with timestamps
      const batchWithTimestamps = batch.map(record => ({
        token_id: record.token_id,
        wallet_address: record.wallet_address,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      logger.debug(`🔍 Sample batch data:`, batchWithTimestamps.slice(0, 2));

      try {
        // Call the new Supabase RPC function for upserting with increased retries and delay
        const { error: upsertError } = await retrySupabaseCall(async () => {
          return await supabaseAdmin.rpc('upsert_kaspunk_ownership', {
            records: batchWithTimestamps // Pass the array of records to the function
          });
        }, 5, 2000); // Increased retries from 1 to 5 and delay from 1000 to 2000

        if (upsertError) {
          logger.error(`❌ Error upserting ownership batch ${batchNumber}:`, {
            error: upsertError,
            batchSize: batch.length,
            sampleData: batchWithTimestamps.slice(0, 2)
          });
          throw new Error(`Failed to upsert ownership data: ${upsertError.message}`);
        }

        upsertedCount += batch.length;
        logger.debug(`✅ Ownership batch ${batchNumber} upserted successfully`);

      } catch (error) {
        logger.error(`❌ Critical error in batch ${batchNumber}:`, {
          error: error.message,
          batchData: batchWithTimestamps.slice(0, 2)
        });
        throw error;
      }

      // Delay between batches
      if (batchNumber < totalBatches) {
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }

    logger.info(`✅ Successfully upserted ${upsertedCount} ownership records`);

    // Verify final record count
    await this.verifyFinalRecordCount();
  }

  /**
   * Verify the final record count in the database
   */
  async verifyFinalRecordCount() {
    try {
      const { count: finalCount, error: countError } = await retrySupabaseCall(async () => {
        return await supabaseAdmin
          .from('kaspunk_token_ownership')
          .select('*', { count: 'exact', head: true });
      }, 3, 2000);

      if (countError) {
        logger.warn('⚠️ Could not verify final record count:', countError.message);
      } else {
        logger.info(`📊 Final verification: ${finalCount || 0} records in kaspunk_token_ownership table`);
        
        // Expected count should be 1000 (one for each KasPunk token)
        if (finalCount === 1000) {
          logger.info('✅ Perfect! Expected 1000 records and found exactly 1000');
        } else if (finalCount && finalCount > 0) {
          logger.warn(`⚠️ Found ${finalCount} records, expected 1000. This might be normal if not all tokens are owned.`);
        } else {
          logger.error('❌ No records found in table after upsert operation');
        }
      }
    } catch (error) {
      logger.warn('⚠️ Error during final verification:', error.message);
    }
  }
}

// Export singleton instance
export const kaspunkOwnershipSyncService = new KaspunkOwnershipSyncService();

// Export the main sync function for direct use
export const syncKaspunkOwnership = () => kaspunkOwnershipSyncService.syncKaspunkOwnership();