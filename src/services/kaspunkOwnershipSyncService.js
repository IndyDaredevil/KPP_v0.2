import axios from 'axios';
import { supabaseAdmin, retrySupabaseCall } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Comprehensive Kaspunk ownership sync service
 * Migrated from Deno edge function to Node.js for better efficiency and stability
 * Enhanced for WebContainer network resilience
 */

class KaspunkOwnershipSyncService {
  constructor() {
    this.apiUrl = 'https://mainnet.krc721.stream/api/v1/krc721/mainnet/owners/KASPUNKS';
    this.maxPages = 100; // Safety limit to prevent infinite loops
    this.batchSize = 50; // Reduced batch size for WebContainer stability
    this.ownerBatchSize = 50; // Reduced batch size for owner records
    this.requestTimeout = 45000; // Increased timeout for WebContainer
    this.requestDelay = 500; // Increased delay between API requests
    this.batchDelay = 200; // Increased delay between database batches
    this.maxRetries = 5; // Increased retries for WebContainer
  }

  /**
   * Main sync function - orchestrates the entire ownership sync process
   */
  async syncKaspunkOwnership() {
    const startTime = Date.now();
    
    try {
      console.log('🔍 ========================================');
      console.log('🔍 STARTING KASPUNK OWNERSHIP SYNC SERVICE');
      console.log('🔍 ========================================');
      console.log('🔍 Starting KasPunk token ownership sync (WebContainer optimized)...');
      console.log('🔧 Service configuration:');
      console.log('   - API URL:', this.apiUrl);
      console.log('   - Max pages:', this.maxPages);
      console.log('   - Batch size:', this.batchSize);
      console.log('   - Owner batch size:', this.ownerBatchSize);
      console.log('   - Request timeout:', this.requestTimeout + 'ms');
      console.log('   - Request delay:', this.requestDelay + 'ms');
      console.log('   - Batch delay:', this.batchDelay + 'ms');
      console.log('   - Max retries:', this.maxRetries);
      console.log('');

      logger.info('🔍 Starting KasPunk token ownership sync (WebContainer optimized)...');

      // Step 1: Fetch all ownership data from Kaspa API
      console.log('📡 STEP 1: Fetching ownership data from Kaspa API...');
      const allOwnershipData = await this.fetchAllOwnershipData();
      
      if (allOwnershipData.length === 0) {
        console.log('❌ No ownership data received from Kaspa API');
        throw new Error('No valid ownership data received from Kaspa API');
      }

      console.log('✅ STEP 1 COMPLETED: Fetched', allOwnershipData.length, 'ownership records');
      logger.info(`📊 Total ownership records collected: ${allOwnershipData.length}`);

      // Step 2: Clear and repopulate kaspunk_token_ownership table
      console.log('');
      console.log('🗄️ STEP 2: Updating token ownership table...');
      await this.updateTokenOwnershipTable(allOwnershipData);
      console.log('✅ STEP 2 COMPLETED: Token ownership table updated');

      // Step 3: Calculate token counts per wallet
      console.log('');
      console.log('📊 STEP 3: Calculating wallet token counts...');
      const walletTokenCounts = this.calculateWalletTokenCounts(allOwnershipData);
      console.log('✅ STEP 3 COMPLETED: Found', walletTokenCounts.size, 'unique wallet addresses');
      logger.info(`📊 Found ${walletTokenCounts.size} unique wallet addresses`);

      // Step 4: Clear and repopulate kaspunk_owners table
      console.log('');
      console.log('🧑‍🤝‍🧑 STEP 4: Updating owners table...');
      await this.updateOwnersTable(walletTokenCounts);
      console.log('✅ STEP 4 COMPLETED: Owners table updated');

      // Step 5: Update collection statistics
      console.log('');
      console.log('📈 STEP 5: Updating collection statistics...');
      await this.updateCollectionStats(allOwnershipData, walletTokenCounts);
      console.log('✅ STEP 5 COMPLETED: Collection statistics updated');

      // Calculate final statistics
      const uniqueTokens = new Set(allOwnershipData.map(item => item.token_id)).size;
      const duration = Date.now() - startTime;

      const result = {
        success: true,
        message: 'KasPunk ownership data synced successfully',
        duration_ms: duration,
        total_ownership_records: allOwnershipData.length,
        unique_tokens: uniqueTokens,
        unique_owners: walletTokenCounts.size,
        collection_stats: {
          total_supply: 1000,
          total_minted: Math.max(...allOwnershipData.map(item => item.token_id)),
          total_holders: walletTokenCounts.size,
          average_holding: Math.round((allOwnershipData.length / walletTokenCounts.size) * 100) / 100
        },
        timestamp: new Date().toISOString()
      };

      console.log('');
      console.log('🎉 ========================================');
      console.log('🎉 KASPUNK OWNERSHIP SYNC COMPLETED');
      console.log('🎉 ========================================');
      console.log('✅ KasPunk ownership sync completed successfully');
      console.log('📊 Final Results:');
      console.log('   - Duration:', (duration / 1000).toFixed(2) + 's');
      console.log('   - Total ownership records:', allOwnershipData.length);
      console.log('   - Unique tokens:', uniqueTokens);
      console.log('   - Unique owners:', walletTokenCounts.size);
      console.log('   - Average holding:', result.collection_stats.average_holding);
      console.log('');

      logger.info('✅ KasPunk ownership sync completed successfully:', result);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log('');
      console.log('💥 ========================================');
      console.log('💥 KASPUNK OWNERSHIP SYNC FAILED');
      console.log('💥 ========================================');
      console.log('❌ KasPunk ownership sync failed after', (duration / 1000).toFixed(2) + 's');
      console.log('❌ Error:', error.message);
      console.log('❌ Full error details:', error);
      console.log('');

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
    let offset = 0; // FIXED: Initialize to 0 instead of undefined for clarity
    let pageCount = 0;

    console.log('📡 Fetching token ownership data from Kaspa API (WebContainer optimized)...');
    console.log('📡 API URL:', this.apiUrl);
    logger.info('📡 Fetching token ownership data from Kaspa API (WebContainer optimized)...');

    while (pageCount < this.maxPages && offset !== null) { // FIXED: Added offset !== null check
      pageCount++;
      
      // Construct API URL with pagination
      let apiUrl = this.apiUrl;
      if (offset !== undefined && offset !== null) {
        apiUrl += `?offset=${offset}`;
      }

      console.log(`📄 Fetching page ${pageCount}${offset ? ` (offset: ${offset})` : ''}...`);
      logger.debug(`📄 Fetching page ${pageCount}${offset ? ` (offset: ${offset})` : ''}...`);
      
      // Enhanced logging before API call
      logger.apiDebug('kaspa', 'ownership-fetch-request', {
        url: apiUrl,
        page: pageCount,
        offset: offset,
        timeout: this.requestTimeout,
        maxPages: this.maxPages,
        maxRetries: this.maxRetries
      });

      let lastError;
      let success = false;

      // Retry logic for API calls in WebContainer
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          console.log(`🔄 [KASPA API] Attempt ${attempt}/${this.maxRetries} for page ${pageCount}`);
          logger.debug(`🔄 [KASPA API] Attempt ${attempt}/${this.maxRetries} for page ${pageCount}`);

          // Fetch data from Kaspa API with timeout and WebContainer optimizations
          const response = await axios.get(apiUrl, {
            timeout: this.requestTimeout,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'KasPunkPredictor/1.0',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            },
            // WebContainer-specific axios configuration
            maxRedirects: 3,
            validateStatus: (status) => status >= 200 && status < 300,
            // Force IPv4 to avoid IPv6 issues in WebContainer
            family: 4
          });

          logger.apiDebug('kaspa', 'ownership-fetch-response', {
            status: response.status,
            statusText: response.statusText,
            dataLength: response.data ? JSON.stringify(response.data).length : 0,
            hasResult: !!(response.data && response.data.result),
            hasOwners: !!(response.data && response.data.owners),
            isArray: Array.isArray(response.data),
            attempt: attempt,
            page: pageCount
          });

          const data = response.data;
          console.log(`📄 Raw response preview: ${JSON.stringify(data).substring(0, 200)}...`);
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
            console.log(`❌ Unexpected response format:`, data);
            logger.error(`❌ Unexpected response format:`, data);
            throw new Error('Invalid response format from Kaspa API - no recognizable data structure');
          }

          console.log(`✅ Page ${pageCount}: Received ${ownershipRecords.length} ownership records (attempt ${attempt})`);
          logger.info(`✅ Page ${pageCount}: Received ${ownershipRecords.length} ownership records (attempt ${attempt})`);

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
            console.log(`🔄 Next page available with offset: ${offset}`);
            logger.debug(`🔄 Next page available with offset: ${offset}`);
          } else if (data.hasMore === true) {
            offset = (offset || 0) + ownershipRecords.length;
            console.log(`🔄 Next page available with calculated offset: ${offset}`);
            logger.debug(`🔄 Next page available with calculated offset: ${offset}`);
          } else {
            console.log('✅ No more pages available - setting offset to null to terminate loop');
            logger.info('✅ No more pages available - setting offset to null to terminate loop');
            offset = null; // FIXED: Set offset to null to break the main while loop
            success = true;
            break;
          }

          success = true;
          break; // Success, exit retry loop

        } catch (error) {
          lastError = error;
          
          // Enhanced error logging for API calls
          console.log(`❌ Error fetching page ${pageCount} (attempt ${attempt}/${this.maxRetries}):`, error.message);
          logger.error(`❌ Error fetching page ${pageCount} (attempt ${attempt}/${this.maxRetries}):`, {
            errorName: error.name,
            errorMessage: error.message,
            errorCode: error.code,
            errorResponse: error.response ? {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data
            } : null,
            url: apiUrl,
            page: pageCount,
            attempt: attempt,
            timeout: this.requestTimeout,
            isNetworkError: error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT',
            isTimeoutError: error.code === 'ECONNABORTED' || error.message?.includes('timeout')
          });

          // Don't retry on certain errors
          if (error.response?.status === 404 || error.response?.status === 401 || error.response?.status === 403) {
            console.log(`❌ Non-retryable error for page ${pageCount}: ${error.response.status}`);
            logger.error(`❌ Non-retryable error for page ${pageCount}: ${error.response.status}`);
            break;
          }

          // Wait before retrying (exponential backoff)
          if (attempt < this.maxRetries) {
            const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            console.log(`🔄 Retrying page ${pageCount} in ${retryDelay}ms (attempt ${attempt + 1}/${this.maxRetries})`);
            logger.warn(`🔄 Retrying page ${pageCount} in ${retryDelay}ms (attempt ${attempt + 1}/${this.maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }

      if (!success) {
        console.log(`❌ Failed to fetch page ${pageCount} after ${this.maxRetries} attempts`);
        throw new Error(`Failed to fetch ownership data from Kaspa API after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
      }

      // If we've reached the end (offset is null), break
      if (offset === null) {
        console.log('🏁 Pagination complete - offset is null, exiting loop');
        break;
      }

      // Longer delay between requests for WebContainer stability
      console.log(`⏳ Waiting ${this.requestDelay}ms before next request...`);
      await new Promise(resolve => setTimeout(resolve, this.requestDelay));
    }

    if (pageCount >= this.maxPages) {
      console.log(`⚠️ Reached maximum page limit (${this.maxPages}). There might be more data available.`);
      logger.warn(`⚠️ Reached maximum page limit (${this.maxPages}). There might be more data available.`);
    }

    console.log(`📡 API fetch completed: ${allOwnershipData.length} total ownership records collected`);
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

    if (!isNaN(tokenId) && tokenId > 0 && owner) {
      return {
        token_id: tokenId,
        wallet_address: owner
      };
    }

    return null;
  }

  /**
   * Clear and repopulate kaspunk_token_ownership table with WebContainer optimizations
   */
  async updateTokenOwnershipTable(allOwnershipData) {
    console.log('🗑️ Clearing existing token ownership data (WebContainer optimized)...');
    logger.info('🗑️ Clearing existing token ownership data (WebContainer optimized)...');
    
    // Enhanced logging before database operation
    logger.debug('🗄️ [DATABASE] Starting token ownership table clear operation');
    
    // Use enhanced retry with longer delays for WebContainer
    const { error: deleteOwnershipError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('kaspunk_token_ownership')
        .delete()
        .neq('token_id', 0); // Delete all records
    }, 5, 3000); // 5 retries with 3 second base delay

    if (deleteOwnershipError) {
      console.log('⚠️ Warning: Failed to clear existing ownership data:', deleteOwnershipError.message);
      logger.warn('⚠️ Warning: Failed to clear existing ownership data:', deleteOwnershipError);
    } else {
      console.log('✅ Token ownership table cleared successfully');
      logger.debug('✅ [DATABASE] Token ownership table cleared successfully');
    }

    // Insert new ownership data in smaller batches for WebContainer stability
    console.log('💾 Inserting new token ownership data (WebContainer optimized)...');
    console.log('💾 Total records to insert:', allOwnershipData.length);
    console.log('💾 Batch size:', this.batchSize);
    logger.info('💾 Inserting new token ownership data (WebContainer optimized)...');
    let insertedOwnershipCount = 0;

    for (let i = 0; i < allOwnershipData.length; i += this.batchSize) {
      const batch = allOwnershipData.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(allOwnershipData.length / this.batchSize);

      console.log(`📝 Inserting ownership batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      logger.debug(`📝 Inserting ownership batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      // Enhanced logging before database batch operation
      logger.debug('🗄️ [DATABASE] Starting ownership batch insert', {
        batchNumber,
        totalBatches,
        batchSize: batch.length,
        totalRecords: allOwnershipData.length
      });

      // Use enhanced retry with longer delays for WebContainer
      const { error: insertError } = await retrySupabaseCall(async () => {
        return await supabaseAdmin
          .from('kaspunk_token_ownership')
          .insert(batch);
      }, 5, 3000); // 5 retries with 3 second base delay

      if (insertError) {
        console.log(`❌ Error inserting ownership batch ${batchNumber}:`, insertError.message);
        logger.error(`❌ Error inserting ownership batch ${batchNumber}:`, insertError);
        throw new Error(`Failed to insert ownership data: ${insertError.message}`);
      }

      insertedOwnershipCount += batch.length;
      console.log(`✅ Ownership batch ${batchNumber} inserted successfully (${insertedOwnershipCount}/${allOwnershipData.length} total)`);
      logger.debug(`✅ [DATABASE] Ownership batch ${batchNumber} inserted successfully`);

      // Longer delay between batches for WebContainer stability
      if (batchNumber < totalBatches) {
        console.log(`⏳ Waiting ${this.batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }

    console.log(`✅ Inserted ${insertedOwnershipCount} ownership records successfully`);
    logger.info(`✅ Inserted ${insertedOwnershipCount} ownership records`);
  }

  /**
   * Calculate token counts per wallet address
   */
  calculateWalletTokenCounts(allOwnershipData) {
    console.log('📊 Calculating token counts per wallet...');
    logger.info('📊 Calculating token counts per wallet...');
    
    const walletTokenCounts = new Map();
    
    for (const ownership of allOwnershipData) {
      const currentCount = walletTokenCounts.get(ownership.wallet_address) || 0;
      walletTokenCounts.set(ownership.wallet_address, currentCount + 1);
    }

    console.log(`📊 Wallet calculation complete: ${walletTokenCounts.size} unique wallets`);
    logger.debug(`📊 Wallet calculation complete: ${walletTokenCounts.size} unique wallets`);
    return walletTokenCounts;
  }

  /**
   * Clear and repopulate kaspunk_owners table with WebContainer optimizations
   */
  async updateOwnersTable(walletTokenCounts) {
    console.log('🗑️ Clearing existing kaspunk_owners data (WebContainer optimized)...');
    logger.info('🗑️ Clearing existing kaspunk_owners data (WebContainer optimized)...');
    
    // Enhanced logging before database operation
    logger.debug('🗄️ [DATABASE] Starting kaspunk_owners table clear operation');
    
    // Use enhanced retry with longer delays for WebContainer
    const { error: deleteOwnersError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('kaspunk_owners')
        .delete()
        .neq('wallet_address', ''); // Delete all records
    }, 5, 3000); // 5 retries with 3 second base delay

    if (deleteOwnersError) {
      console.log('⚠️ Warning: Failed to clear existing owners data:', deleteOwnersError.message);
      logger.warn('⚠️ Warning: Failed to clear existing owners data:', deleteOwnersError);
    } else {
      console.log('✅ Kaspunk_owners table cleared successfully');
      logger.debug('✅ [DATABASE] Kaspunk_owners table cleared successfully');
    }

    // Insert new owners data in smaller batches for WebContainer stability
    console.log('💾 Inserting new kaspunk_owners data (WebContainer optimized)...');
    logger.info('💾 Inserting new kaspunk_owners data (WebContainer optimized)...');
    
    const ownerRecords = Array.from(walletTokenCounts.entries()).map(([wallet_address, token_count]) => ({
      wallet_address,
      token_count,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    console.log('💾 Total owner records to insert:', ownerRecords.length);
    console.log('💾 Owner batch size:', this.ownerBatchSize);

    let insertedOwnersCount = 0;

    for (let i = 0; i < ownerRecords.length; i += this.ownerBatchSize) {
      const batch = ownerRecords.slice(i, i + this.ownerBatchSize);
      const batchNumber = Math.floor(i / this.ownerBatchSize) + 1;
      const totalBatches = Math.ceil(ownerRecords.length / this.ownerBatchSize);

      console.log(`📝 Inserting owners batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      logger.debug(`📝 Inserting owners batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      // Enhanced logging before database batch operation
      logger.debug('🗄️ [DATABASE] Starting owners batch insert', {
        batchNumber,
        totalBatches,
        batchSize: batch.length,
        totalOwners: ownerRecords.length
      });

      // Use enhanced retry with longer delays for WebContainer
      const { error: insertOwnersError } = await retrySupabaseCall(async () => {
        return await supabaseAdmin
          .from('kaspunk_owners')
          .insert(batch);
      }, 5, 3000); // 5 retries with 3 second base delay

      if (insertOwnersError) {
        console.log(`❌ Error inserting owners batch ${batchNumber}:`, insertOwnersError.message);
        logger.error(`❌ Error inserting owners batch ${batchNumber}:`, insertOwnersError);
        throw new Error(`Failed to insert owners data: ${insertOwnersError.message}`);
      }

      insertedOwnersCount += batch.length;
      console.log(`✅ Owners batch ${batchNumber} inserted successfully (${insertedOwnersCount}/${ownerRecords.length} total)`);
      logger.debug(`✅ [DATABASE] Owners batch ${batchNumber} inserted successfully`);

      // Longer delay between batches for WebContainer stability
      if (batchNumber < totalBatches) {
        console.log(`⏳ Waiting ${this.batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }

    console.log(`✅ Inserted ${insertedOwnersCount} owner records successfully`);
    logger.info(`✅ Inserted ${insertedOwnersCount} owner records`);
  }

  /**
   * Update collection statistics with WebContainer optimizations
   */
  async updateCollectionStats(allOwnershipData, walletTokenCounts) {
    console.log('📊 Updating collection statistics (WebContainer optimized)...');
    logger.info('📊 Updating collection statistics (WebContainer optimized)...');
    
    const totalSupply = 1000; // Known KasPunk total supply
    const totalMinted = Math.max(...allOwnershipData.map(item => item.token_id)); // Highest token ID
    const totalHolders = walletTokenCounts.size;
    const averageHolding = totalHolders > 0 ? allOwnershipData.length / totalHolders : 0;

    const collectionStats = {
      total_supply: totalSupply,
      total_minted: totalMinted,
      total_holders: totalHolders,
      average_holding: averageHolding,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('📊 Collection statistics to update:');
    console.log('   - Total supply:', totalSupply);
    console.log('   - Total minted:', totalMinted);
    console.log('   - Total holders:', totalHolders);
    console.log('   - Average holding:', averageHolding.toFixed(2));

    // Enhanced logging before database operation
    logger.debug('🗄️ [DATABASE] Starting collection stats upsert', {
      totalSupply,
      totalMinted,
      totalHolders,
      averageHolding: averageHolding.toFixed(2)
    });

    // Use enhanced retry with longer delays for WebContainer
    const { error: statsError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('kaspunk_collection_stats')
        .upsert(collectionStats, {
          onConflict: 'id',
          ignoreDuplicates: false
        });
    }, 5, 3000); // 5 retries with 3 second base delay

    if (statsError) {
      console.log('❌ Error updating collection statistics:', statsError.message);
      logger.error('❌ Error updating collection statistics:', statsError);
      throw new Error(`Failed to update collection statistics: ${statsError.message}`);
    }

    console.log('✅ Collection statistics updated successfully');
    logger.info('✅ Collection statistics updated successfully');
  }
}

// Export singleton instance
export const kaspunkOwnershipSyncService = new KaspunkOwnershipSyncService();

// Export the main sync function for direct use
export const syncKaspunkOwnership = () => kaspunkOwnershipSyncService.syncKaspunkOwnership();