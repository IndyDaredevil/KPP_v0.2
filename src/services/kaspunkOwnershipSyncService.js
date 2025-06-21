import axios from 'axios';
import { supabaseAdmin, retrySupabaseCall } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Comprehensive Kaspunk ownership sync service
 * Migrated from Deno edge function to Node.js for better efficiency and stability
 */

class KaspunkOwnershipSyncService {
  constructor() {
    this.apiUrl = 'https://mainnet.krc721.stream/api/v1/krc721/mainnet/owners/KASPUNKS';
    this.maxPages = 100; // Safety limit to prevent infinite loops
    this.batchSize = 100; // Batch size for database operations
    this.ownerBatchSize = 100; // Batch size for owner records
    this.requestTimeout = 30000; // 30 second timeout
    this.requestDelay = 200; // Delay between API requests
    this.batchDelay = 50; // Delay between database batches
  }

  /**
   * Main sync function - orchestrates the entire ownership sync process
   */
  async syncKaspunkOwnership() {
    const startTime = Date.now();
    
    try {
      logger.info('🔍 Starting KasPunk token ownership sync...');

      // Step 1: Fetch all ownership data from Kaspa API
      const allOwnershipData = await this.fetchAllOwnershipData();
      
      if (allOwnershipData.length === 0) {
        throw new Error('No valid ownership data received from Kaspa API');
      }

      logger.info(`📊 Total ownership records collected: ${allOwnershipData.length}`);

      // Step 2: Clear and repopulate kaspunk_token_ownership table
      await this.updateTokenOwnershipTable(allOwnershipData);

      // Step 3: Calculate token counts per wallet
      const walletTokenCounts = this.calculateWalletTokenCounts(allOwnershipData);
      logger.info(`📊 Found ${walletTokenCounts.size} unique wallet addresses`);

      // Step 4: Clear and repopulate kaspunk_owners table
      await this.updateOwnersTable(walletTokenCounts);

      // Step 5: Update collection statistics
      await this.updateCollectionStats(allOwnershipData, walletTokenCounts);

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
   * Fetch all ownership data from Kaspa API with pagination
   */
  async fetchAllOwnershipData() {
    const allOwnershipData = [];
    let offset = undefined;
    let pageCount = 0;

    logger.info('📡 Fetching token ownership data from Kaspa API...');

    while (pageCount < this.maxPages) {
      pageCount++;
      
      // Construct API URL with pagination
      let apiUrl = this.apiUrl;
      if (offset !== undefined) {
        apiUrl += `?offset=${offset}`;
      }

      logger.debug(`📄 Fetching page ${pageCount}${offset ? ` (offset: ${offset})` : ''}...`);
      
      // Enhanced logging before API call
      logger.apiDebug('kaspa', 'ownership-fetch-request', {
        url: apiUrl,
        page: pageCount,
        offset: offset,
        timeout: this.requestTimeout,
        maxPages: this.maxPages
      });

      try {
        // Fetch data from Kaspa API with timeout
        const response = await axios.get(apiUrl, {
          timeout: this.requestTimeout,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'KasPunkPredictor/1.0'
          }
        });

        logger.apiDebug('kaspa', 'ownership-fetch-response', {
          status: response.status,
          statusText: response.statusText,
          dataLength: response.data ? JSON.stringify(response.data).length : 0,
          hasResult: !!(response.data && response.data.result),
          hasOwners: !!(response.data && response.data.owners),
          isArray: Array.isArray(response.data)
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
          break;
        }

        // Small delay between requests to be API-friendly
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));

      } catch (error) {
        // Enhanced error logging for API calls
        logger.error(`❌ Error fetching page ${pageCount}:`, {
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
          timeout: this.requestTimeout
        });
        throw new Error(`Failed to fetch ownership data from Kaspa API: ${error.message}`);
      }
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

    if (!isNaN(tokenId) && tokenId > 0 && owner) {
      return {
        token_id: tokenId,
        wallet_address: owner
      };
    }

    return null;
  }

  /**
   * Clear and repopulate kaspunk_token_ownership table
   */
  async updateTokenOwnershipTable(allOwnershipData) {
    logger.info('🗑️ Clearing existing token ownership data...');
    
    // Enhanced logging before database operation
    logger.debug('🗄️ [DATABASE] Starting token ownership table clear operation');
    
    const { error: deleteOwnershipError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('kaspunk_token_ownership')
        .delete()
        .neq('token_id', 0); // Delete all records
    });

    if (deleteOwnershipError) {
      logger.warn('⚠️ Warning: Failed to clear existing ownership data:', deleteOwnershipError);
    } else {
      logger.debug('✅ [DATABASE] Token ownership table cleared successfully');
    }

    // Insert new ownership data in batches
    logger.info('💾 Inserting new token ownership data...');
    let insertedOwnershipCount = 0;

    for (let i = 0; i < allOwnershipData.length; i += this.batchSize) {
      const batch = allOwnershipData.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(allOwnershipData.length / this.batchSize);

      logger.debug(`📝 Inserting ownership batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      // Enhanced logging before database batch operation
      logger.debug('🗄️ [DATABASE] Starting ownership batch insert', {
        batchNumber,
        totalBatches,
        batchSize: batch.length,
        totalRecords: allOwnershipData.length
      });

      const { error: insertError } = await retrySupabaseCall(async () => {
        return await supabaseAdmin
          .from('kaspunk_token_ownership')
          .insert(batch);
      });

      if (insertError) {
        logger.error(`❌ Error inserting ownership batch ${batchNumber}:`, insertError);
        throw new Error(`Failed to insert ownership data: ${insertError.message}`);
      }

      insertedOwnershipCount += batch.length;
      logger.debug(`✅ [DATABASE] Ownership batch ${batchNumber} inserted successfully`);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, this.batchDelay));
    }

    logger.info(`✅ Inserted ${insertedOwnershipCount} ownership records`);
  }

  /**
   * Calculate token counts per wallet address
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
   * Clear and repopulate kaspunk_owners table
   */
  async updateOwnersTable(walletTokenCounts) {
    logger.info('🗑️ Clearing existing kaspunk_owners data...');
    
    // Enhanced logging before database operation
    logger.debug('🗄️ [DATABASE] Starting kaspunk_owners table clear operation');
    
    const { error: deleteOwnersError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('kaspunk_owners')
        .delete()
        .neq('wallet_address', ''); // Delete all records
    });

    if (deleteOwnersError) {
      logger.warn('⚠️ Warning: Failed to clear existing owners data:', deleteOwnersError);
    } else {
      logger.debug('✅ [DATABASE] Kaspunk_owners table cleared successfully');
    }

    // Insert new owners data in batches
    logger.info('💾 Inserting new kaspunk_owners data...');
    
    const ownerRecords = Array.from(walletTokenCounts.entries()).map(([wallet_address, token_count]) => ({
      wallet_address,
      token_count,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    let insertedOwnersCount = 0;

    for (let i = 0; i < ownerRecords.length; i += this.ownerBatchSize) {
      const batch = ownerRecords.slice(i, i + this.ownerBatchSize);
      const batchNumber = Math.floor(i / this.ownerBatchSize) + 1;
      const totalBatches = Math.ceil(ownerRecords.length / this.ownerBatchSize);

      logger.debug(`📝 Inserting owners batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      // Enhanced logging before database batch operation
      logger.debug('🗄️ [DATABASE] Starting owners batch insert', {
        batchNumber,
        totalBatches,
        batchSize: batch.length,
        totalOwners: ownerRecords.length
      });

      const { error: insertOwnersError } = await retrySupabaseCall(async () => {
        return await supabaseAdmin
          .from('kaspunk_owners')
          .insert(batch);
      });

      if (insertOwnersError) {
        logger.error(`❌ Error inserting owners batch ${batchNumber}:`, insertOwnersError);
        throw new Error(`Failed to insert owners data: ${insertOwnersError.message}`);
      }

      insertedOwnersCount += batch.length;
      logger.debug(`✅ [DATABASE] Owners batch ${batchNumber} inserted successfully`);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, this.batchDelay));
    }

    logger.info(`✅ Inserted ${insertedOwnersCount} owner records`);
  }

  /**
   * Update collection statistics
   */
  async updateCollectionStats(allOwnershipData, walletTokenCounts) {
    logger.info('📊 Updating collection statistics...');
    
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

    // Enhanced logging before database operation
    logger.debug('🗄️ [DATABASE] Starting collection stats upsert', {
      totalSupply,
      totalMinted,
      totalHolders,
      averageHolding: averageHolding.toFixed(2)
    });

    // Upsert collection statistics
    const { error: statsError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('kaspunk_collection_stats')
        .upsert(collectionStats, {
          onConflict: 'id',
          ignoreDuplicates: false
        });
    });

    if (statsError) {
      logger.error('❌ Error updating collection statistics:', statsError);
      throw new Error(`Failed to update collection statistics: ${statsError.message}`);
    }

    logger.info('✅ Collection statistics updated successfully');
  }
}

// Export singleton instance
export const kaspunkOwnershipSyncService = new KaspunkOwnershipSyncService();

// Export the main sync function for direct use
export const syncKaspunkOwnership = () => kaspunkOwnershipSyncService.syncKaspunkOwnership();