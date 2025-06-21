import 'dotenv/config';
import { syncKaspaListings, syncKaspaSalesHistory, syncKaspaTraits } from './src/services/syncOrchestrator.js';
import { syncSingleTokenTraits, syncKaspunkOwners } from './src/services/kaspaDbSync.js';
import { logger } from './src/utils/logger.js';

// Validate environment variables before starting
function validateEnvironment() {
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('💡 Please check your .env file and ensure all Supabase credentials are properly configured.');
    process.exit(1);
  }

  // Validate KASPA_SYNC_ENABLED
  if (process.env.KASPA_SYNC_ENABLED !== 'true') {
    console.error('❌ Kaspa sync is disabled via KASPA_SYNC_ENABLED environment variable');
    console.error('💡 Set KASPA_SYNC_ENABLED=true in your .env file to enable sync');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

// Parse command line arguments
const args = process.argv.slice(2);
const batchArg = args.find(arg => arg.startsWith('--batch='));
const singleBatch = batchArg ? parseInt(batchArg.split('=')[1]) : null;
const tokenIdArg = args.find(arg => arg.startsWith('--token-id='));
const singleTokenId = tokenIdArg ? parseInt(tokenIdArg.split('=')[1]) : null;
const startTokenIdArg = args.find(arg => arg.startsWith('--start-token-id='));
const startTokenId = startTokenIdArg ? parseInt(startTokenIdArg.split('=')[1]) : null;
const syncSalesHistory = args.includes('--sync-sales-history');
const syncTraits = args.includes('--sync-traits');
const syncOwners = args.includes('--sync-owners');
const syncListings = args.includes('--sync-listings') || (!syncSalesHistory && !syncTraits && !syncOwners && !args.includes('--help') && !args.includes('-h'));

async function runManualSync() {
  // Validate environment first
  validateEnvironment();

  if (syncOwners) {
    console.log('🧑‍🤝‍🧑 ========================================');
    console.log('🧑‍🤝‍🧑 STARTING KASPUNK OWNERS SYNC');
    console.log('🧑‍🤝‍🧑 ========================================');
    console.log('Starting Kaspunk owners sync...');
    console.log('📅 Started at:', new Date().toISOString());
    console.log('🔧 This will fetch all KasPunk token ownership data from the Kaspa API');
    console.log('🔧 and update the database with current ownership information');
    console.log('');

    try {
      const startTime = Date.now();
      console.log('⏱️  Sync start time recorded:', startTime);
      console.log('🚀 Calling syncKaspunkOwners() function...');
      
      const result = await syncKaspunkOwners();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log('⏱️  Sync end time recorded:', endTime);
      console.log('⏱️  Total sync duration:', duration, 'ms');

      console.log('');
      console.log('🧑‍🤝‍🧑 ========================================');
      console.log('🧑‍🤝‍🧑 KASPUNK OWNERS SYNC COMPLETED');
      console.log('🧑‍🤝‍🧑 ========================================');
      console.log('✅ Kaspunk owners sync completed!');
      console.log('Results:', {
        totalHolders: result.totalHolders,
        processedHolders: result.processedHolders,
        addedHolders: result.addedHolders,
        updatedHolders: result.updatedHolders,
        errors: result.errors,
        duration: `${(duration / 1000).toFixed(2)}s`
      });

      if (result.action === 'error') {
        console.log('❌ Error occurred during sync:', result.error);
      } else {
        console.log(`✅ Successfully processed ${result.processedHolders} holders (${result.addedHolders} added, ${result.updatedHolders} updated)`);
      }

    } catch (error) {
      console.log('');
      console.log('🧑‍🤝‍🧑 ========================================');
      console.log('🧑‍🤝‍🧑 KASPUNK OWNERS SYNC FAILED');
      console.log('🧑‍🤝‍🧑 ========================================');
      console.error('❌ Kaspunk owners sync failed:', error.message);
      console.error('❌ Full error details:', error);
      logger.error('Kaspunk owners sync failed:', error);
      process.exit(1);
    }
  } else if (syncTraits) {
    if (singleTokenId) {
      // NEW: Single token trait sync
      console.log(`Starting trait sync for single token ${singleTokenId}...`);
      console.log('📅 Started at:', new Date().toISOString());

      try {
        const startTime = Date.now();
        const result = await syncSingleTokenTraits('KASPUNKS', singleTokenId);
        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`\n✅ Single token trait sync completed! (Token ${singleTokenId})`);
        console.log('Results:', {
          tokenId: singleTokenId,
          action: result.action,
          traitsFound: result.traitsFound,
          traitsSynced: result.traitsSynced,
          errors: result.errors,
          duration: `${duration}ms`
        });

        if (result.action === 'error') {
          console.log(`Error: ${result.error}`);
        } else if (result.action === 'no_data') {
          console.log(`No trait data found for token ${singleTokenId}`);
        } else {
          console.log(`Successfully synced ${result.traitsSynced} traits for token ${singleTokenId}`);
        }

      } catch (error) {
        console.error('Single token trait sync failed:', error.message);
        logger.error('Single token trait sync failed:', error);
        process.exit(1);
      }

    } else {
      // Calculate token range based on flags
      let calculatedStartTokenId = 1;
      let calculatedEndTokenId = 1000;

      if (startTokenId && singleBatch) {
        // Both start token and batch specified - use batch as the number of tokens to process
        calculatedStartTokenId = startTokenId;
        calculatedEndTokenId = startTokenId + singleBatch - 1;
        console.log(`Starting trait sync for ${singleBatch} tokens starting from ${startTokenId} (${calculatedStartTokenId}-${calculatedEndTokenId})...`);
      } else if (startTokenId) {
        // Only start token specified
        calculatedStartTokenId = startTokenId;
        calculatedEndTokenId = 1000;
        console.log(`Starting trait sync from token ${startTokenId} to 1000...`);
      } else if (singleBatch) {
        // Only batch specified - use old batch logic (10 tokens per batch)
        calculatedStartTokenId = ((singleBatch - 1) * 10) + 1;
        calculatedEndTokenId = singleBatch * 10;
        console.log(`Starting trait sync for batch ${singleBatch} (tokens ${calculatedStartTokenId}-${calculatedEndTokenId})...`);
      } else {
        // Full sync
        console.log('Starting comprehensive Kaspa trait sync...');
      }

      console.log('📅 Started at:', new Date().toISOString());

      try {
        // Use fast parameters for trait sync - NOW PASSING THE CALCULATED RANGE
        const results = await syncKaspaTraits({
          startTokenId: calculatedStartTokenId,
          endTokenId: calculatedEndTokenId,
          batchSize: 20, // Increased batch size
          delayBetweenTokens: 50, // Reduced delay (50ms)
          delayBetweenBatches: 500 // Reduced batch delay (500ms)
        });

        if (singleBatch || startTokenId) {
          console.log(`\n✅ Trait sync completed! (Tokens ${calculatedStartTokenId}-${calculatedEndTokenId})`);
          console.log('Results:', {
            tokenRange: `${calculatedStartTokenId}-${calculatedEndTokenId}`,
            tokensProcessed: results.totalTokensProcessed,
            traitsFound: results.totalTraitsFound,
            traitsSynced: results.totalTraitsSynced,
            tokensWithTraits: results.tokensWithTraits,
            errors: results.totalErrors,
            duration: results.durationSeconds,
            avgTimePerToken: `${(results.durationMs / results.totalTokensProcessed).toFixed(0)}ms`
          });
        } else {
          console.log('\n✅ Comprehensive trait sync completed successfully!');
          console.log('Results:', {
            tokensProcessed: results.totalTokensProcessed,
            traitsFound: results.totalTraitsFound,
            traitsSynced: results.totalTraitsSynced,
            tokensWithTraits: results.tokensWithTraits,
            tokensWithoutTraits: results.tokensWithoutTraits,
            tokensWithErrors: results.tokensWithErrors,
            errors: results.totalErrors,
            duration: results.durationSeconds,
            performance: results.performance
          });
        }

        if (results.totalErrors > 0) {
          console.log(`Warning: ${results.totalErrors} errors occurred during trait sync. This is expected with API rate limits.`);
        }

      } catch (error) {
        console.error('Manual trait sync failed:', error.message);
        logger.error('Manual trait sync failed:', error);
        process.exit(1);
      }
    }
  } else if (syncSalesHistory) {
    // Calculate token range for sales history
    let calculatedStartTokenId = 1;
    let calculatedEndTokenId = 1000;

    if (startTokenId && singleBatch) {
      // Both start token and batch specified - use batch as the number of tokens to process
      calculatedStartTokenId = startTokenId;
      calculatedEndTokenId = startTokenId + singleBatch - 1;
    } else if (startTokenId) {
      calculatedStartTokenId = startTokenId;
      calculatedEndTokenId = 1000;
    } else if (singleBatch) {
      // Only batch specified - use old batch logic (10 tokens per batch)
      calculatedStartTokenId = ((singleBatch - 1) * 10) + 1;
      calculatedEndTokenId = singleBatch * 10;
    }

    console.log('Starting conservative Kaspa sales history sync...');
    console.log('📅 Started at:', new Date().toISOString());

    try {
      // Use conservative parameters for sales history sync
      const results = await syncKaspaSalesHistory({
        startTokenId: calculatedStartTokenId,
        endTokenId: calculatedEndTokenId,
        batchSize: 5, // Smaller batch size
        delayBetweenTokens: 1000, // Longer delays
        delayBetweenBatches: 5000
      });

      if (singleBatch || startTokenId) {
        console.log(`\n✅ Sales history sync completed! (Tokens ${calculatedStartTokenId}-${calculatedEndTokenId})`);
        console.log('Results:', {
          tokenRange: `${calculatedStartTokenId}-${calculatedEndTokenId}`,
          tokensProcessed: results.totalTokensProcessed,
          salesFound: results.totalSalesFound,
          salesAdded: results.totalSalesAdded,
          salesUpdated: results.totalSalesUpdated,
          errors: results.totalErrors
        });
      } else {
        console.log('\n✅ Conservative sales history sync completed successfully!');
        console.log('Results:', {
          tokensProcessed: results.totalTokensProcessed,
          salesFound: results.totalSalesFound,
          salesAdded: results.totalSalesAdded,
          salesUpdated: results.totalSalesUpdated,
          tokensWithSales: results.tokensWithSales,
          tokensWithoutSales: results.tokensWithoutSales,
          errors: results.totalErrors,
          duration: results.durationSeconds
        });
      }

      if (results.totalErrors > 0) {
        console.log(`Warning: ${results.totalErrors} errors occurred during sync. This is expected with socket issues.`);
      }

    } catch (error) {
      console.error('Manual sales history sync failed:', error.message);
      logger.error('Manual sales history sync failed:', error);
      process.exit(1);
    }
  } else if (syncListings) {
    if (singleBatch) {
      console.log(`Starting SINGLE BATCH test sync for batch ${singleBatch}...`);
      console.log('Warning: This is a test mode - only one batch will be processed');
    } else {
      console.log('Starting conservative Kaspa listings sync...');
    }
    console.log('📅 Started at:', new Date().toISOString());

    try {
      // Run the sync with optional batch limit
      const results = await syncKaspaListings(singleBatch);

      if (singleBatch) {
        console.log(`\n✅ Single batch test completed successfully! (Batch ${singleBatch})`);
        console.log('Test Results:', {
          batchTested: singleBatch,
          added: results.added,
          updated: results.updated,
          removed: results.removed,
          errors: results.errors,
          noChange: results.noChange
        });
      } else {
        console.log('\n✅ Conservative sync completed successfully!');
        console.log('Results:', {
          added: results.added,
          updated: results.updated,
          removed: results.removed,
          errors: results.errors,
          noChange: results.noChange,
          finalDatabaseCount: results.finalDatabaseCount
        });
      }

      if (results.errors > 0) {
        console.log(`Warning: ${results.errors} errors occurred during sync. This is expected with socket issues.`);
      }

    } catch (error) {
      console.error('Manual sync failed:', error.message);
      logger.error('Manual sync failed:', error);
      process.exit(1);
    }
  }

  console.log('📅 Completed at:', new Date().toISOString());
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nManual sync interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nManual sync terminated');
  process.exit(0);
});

// Show usage if help is requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Fast Kaspa Sync Tool Usage:

LISTINGS SYNC:
Full Sync (conservative approach):
  node sync-now.js
  node sync-now.js --sync-listings

Single Batch Test (10 tokens):
  node sync-now.js --batch=1    # Tests tokens 1-10
  node sync-now.js --batch=5    # Tests tokens 41-50
  node sync-now.js --batch=10   # Tests tokens 91-100

SALES HISTORY SYNC (Conservative):
Full Sales History Sync (1000 tokens):
  node sync-now.js --sync-sales-history

Single Batch Sales History Test (10 tokens):
  node sync-now.js --sync-sales-history --batch=1    # Tests tokens 1-10
  node sync-now.js --sync-sales-history --batch=5    # Tests tokens 41-50

Resume from specific token:
  node sync-now.js --sync-sales-history --start-token-id=491    # Resume from token 491

TRAIT SYNC (FAST - Optimized for 50-100ms per token):
Full Trait Sync (1000 tokens):
  node sync-now.js --sync-traits

Single Batch Trait Test (10 tokens):
  node sync-now.js --sync-traits --batch=1    # Tests tokens 1-10
  node sync-now.js --sync-traits --batch=5    # Tests tokens 41-50

Resume trait sync from specific token:
  node sync-now.js --sync-traits --start-token-id=491    # Resume from token 491 to 1000
  node sync-now.js --sync-traits --start-token-id=491 --batch=1    # Sync 10 tokens starting from 491

Single Token Trait Sync (for testing specific tokens):
  node sync-now.js --sync-traits --token-id=100    # Sync only token 100
  node sync-now.js --sync-traits --token-id=452    # Sync only token 452

OWNER SYNC (NEW):
Sync all Kaspunk owners:
  node sync-now.js --sync-owners    # Sync all wallet addresses that hold Kaspunks

Options:
  --sync-listings       Sync active listings (default if no other option specified)
  --sync-sales-history  Sync sales history data (1000 tokens by default)
  --sync-traits         Sync trait data for all tokens (FAST - 50-100ms per token)
  --sync-owners         Sync wallet addresses that hold Kaspunks (NEW)
  --batch=N            Run only batch N (each batch = 10 tokens)
  --token-id=N         Sync traits for a specific token ID
  --start-token-id=N   Start sync from specific token ID
  --help, -h           Show this help message

Examples:
  node sync-now.js                                    # Conservative listings sync
  node sync-now.js --batch=1                          # Test first 10 tokens (listings)
  node sync-now.js --sync-sales-history               # Full sales history sync (1000 tokens)
  node sync-now.js --sync-sales-history --batch=15    # Test tokens 141-150 (sales history)
  node sync-now.js --sync-traits                      # Fast trait sync (1000 tokens) - OPTIMIZED!
  node sync-now.js --sync-traits --batch=10           # Test tokens 91-100 (traits) - FAST!
  node sync-now.js --sync-traits --start-token-id=491 # Resume trait sync from token 491 to 1000
  node sync-now.js --sync-traits --start-token-id=491 --batch=195 # Sync tokens 491-685 only
  node sync-now.js --sync-traits --token-id=100       # Sync traits for token 100 only
  node sync-now.js --sync-owners                      # Sync all Kaspunk owners
`);
  process.exit(0);
}

// Run the sync
runManualSync();