import 'dotenv/config';
import { supabaseAdmin, retrySupabaseCall, checkSupabaseConnectivity } from './src/config/database.js';
import { kaspaApi } from './src/services/kaspaApi.js';
import { logger } from './src/utils/logger.js';

// Parse command line arguments
const args = process.argv.slice(2);
const numTokensArg = args.find(arg => arg.startsWith('--num-tokens='));
const numTokens = numTokensArg ? Math.min(parseInt(numTokensArg.split('=')[1]), 1000) : 50; // Cap at 1000

// Show usage if help is requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Network Stability Test Tool Usage:

Basic Test (50 tokens):
  node test-network-stability.js

Custom Token Count (up to 1000):
  node test-network-stability.js --num-tokens=100
  node test-network-stability.js --num-tokens=500
  node test-network-stability.js --num-tokens=1000

Options:
  --num-tokens=N    Test N tokens (max 1000, default 50)
  --help, -h        Show this help message

Examples:
  node test-network-stability.js                    # Test 50 tokens
  node test-network-stability.js --num-tokens=250   # Test 250 tokens
  node test-network-stability.js --num-tokens=1000  # Test 1000 tokens (max)

Notes:
  - Each token test includes both Kaspa API and Supabase calls
  - Results table shows success rates and performance metrics
  - Test is capped at 1000 tokens to prevent excessive runtime
`);
  process.exit(0);
}

async function runNetworkStabilityTest() {
  const startTime = Date.now();
  
  console.log('Starting network stability test for ' + numTokens + ' tokens...');
  logger.info('Starting network stability test for ' + numTokens + ' tokens...');

  const results = {
    totalTokens: numTokens,
    kaspaApi: { success: 0, fail: 0, totalTime: 0 },
    supabase: { success: 0, fail: 0, totalTime: 0 },
    startTime: new Date(startTime).toISOString(),
    endTime: '',
    durationMs: 0,
    durationSeconds: ''
  };

  for (let tokenId = 1; tokenId <= numTokens; tokenId++) {
    // Progress logging every 50 tokens or at key milestones
    if (tokenId % 50 === 0 || tokenId === 1 || tokenId === numTokens) {
      console.log('Progress: ' + tokenId + '/' + numTokens + ' tokens tested (' + ((tokenId/numTokens)*100).toFixed(1) + '%)');
    }

    // Test Kaspa API
    const kaspaStartTime = Date.now();
    try {
      const response = await kaspaApi.fetchCompletedOrdersForToken('KASPUNKS', tokenId.toString(), { limit: 1 });
      const kaspaEndTime = Date.now();
      results.kaspaApi.totalTime += (kaspaEndTime - kaspaStartTime);
      
      if (response && Array.isArray(response.orders)) {
        results.kaspaApi.success++;
        // Only log errors or significant milestones to reduce noise
        if (tokenId % 100 === 0) {
          logger.debug('[Kaspa API] Token ' + tokenId + ': Success (' + response.orders.length + ' orders)');
        }
      } else {
        results.kaspaApi.success++; // API call succeeded even if no orders
      }
    } catch (error) {
      const kaspaEndTime = Date.now();
      results.kaspaApi.totalTime += (kaspaEndTime - kaspaStartTime);
      results.kaspaApi.fail++;
      logger.error('[Kaspa API] Token ' + tokenId + ': ' + error.message);
    }

    // Test Supabase connection
    const supabaseStartTime = Date.now();
    try {
      const { data, error } = await retrySupabaseCall(async () => {
        return await supabaseAdmin
          .from('users')
          .select('id', { count: 'exact', head: true });
      });

      const supabaseEndTime = Date.now();
      results.supabase.totalTime += (supabaseEndTime - supabaseStartTime);

      if (error) {
        results.supabase.fail++;
        logger.error('[Supabase] Token ' + tokenId + ': ' + error.message);
      } else {
        results.supabase.success++;
        if (tokenId % 100 === 0) {
          logger.debug('[Supabase] Token ' + tokenId + ': Success');
        }
      }
    } catch (error) {
      const supabaseEndTime = Date.now();
      results.supabase.totalTime += (supabaseEndTime - supabaseStartTime);
      results.supabase.fail++;
      logger.error('[Supabase] Token ' + tokenId + ': ' + error.message);
    }

    // Add a small delay between iterations to prevent overwhelming the APIs
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Calculate final results
  const endTime = Date.now();
  results.durationMs = endTime - startTime;
  results.durationSeconds = (results.durationMs / 1000).toFixed(2) + 's';
  results.endTime = new Date(endTime).toISOString();

  // Display comprehensive results table
  console.log('\n' + '='.repeat(80));
  console.log('NETWORK STABILITY TEST RESULTS');
  console.log('='.repeat(80));

  console.log('\nSUMMARY:');
  console.log('Total Tokens Tested: ' + results.totalTokens);
  console.log('Total Duration: ' + results.durationSeconds);
  console.log('Average Time per Token: ' + (results.durationMs / results.totalTokens).toFixed(0) + 'ms');
  console.log('Tokens per Second: ' + (results.totalTokens / (results.durationMs / 1000)).toFixed(2));

  console.log('\nKASPA API RESULTS:');
  console.log('Success: ' + results.kaspaApi.success + '/' + results.totalTokens + ' (' + ((results.kaspaApi.success/results.totalTokens)*100).toFixed(1) + '%)');
  console.log('Failures: ' + results.kaspaApi.fail + '/' + results.totalTokens + ' (' + ((results.kaspaApi.fail/results.totalTokens)*100).toFixed(1) + '%)');
  console.log('Average Response Time: ' + (results.kaspaApi.success > 0 ? (results.kaspaApi.totalTime / results.kaspaApi.success).toFixed(0) : 'N/A') + 'ms');
  console.log('Total API Time: ' + (results.kaspaApi.totalTime / 1000).toFixed(2) + 's');

  console.log('\nSUPABASE RESULTS:');
  console.log('Success: ' + results.supabase.success + '/' + results.totalTokens + ' (' + ((results.supabase.success/results.totalTokens)*100).toFixed(1) + '%)');
  console.log('Failures: ' + results.supabase.fail + '/' + results.totalTokens + ' (' + ((results.supabase.fail/results.totalTokens)*100).toFixed(1) + '%)');
  console.log('Average Response Time: ' + (results.supabase.success > 0 ? (results.supabase.totalTime / results.supabase.success).toFixed(0) : 'N/A') + 'ms');
  console.log('Total DB Time: ' + (results.supabase.totalTime / 1000).toFixed(2) + 's');

  console.log('\nPERFORMANCE METRICS:');
  const totalApiCalls = results.totalTokens * 2; // 2 calls per token
  const totalSuccessfulCalls = results.kaspaApi.success + results.supabase.success;
  const totalFailedCalls = results.kaspaApi.fail + results.supabase.fail;

  console.log('Total API Calls: ' + totalApiCalls);
  console.log('Successful Calls: ' + totalSuccessfulCalls + ' (' + ((totalSuccessfulCalls/totalApiCalls)*100).toFixed(1) + '%)');
  console.log('Failed Calls: ' + totalFailedCalls + ' (' + ((totalFailedCalls/totalApiCalls)*100).toFixed(1) + '%)');
  console.log('Calls per Second: ' + (totalApiCalls / (results.durationMs / 1000)).toFixed(2));

  console.log('\nRELIABILITY ASSESSMENT:');
  const overallSuccessRate = (totalSuccessfulCalls / totalApiCalls) * 100;
  let reliabilityGrade = 'F';
  let reliabilityDescription = 'Poor - Significant issues detected';

  if (overallSuccessRate >= 99) {
    reliabilityGrade = 'A+';
    reliabilityDescription = 'Excellent - Highly reliable';
  } else if (overallSuccessRate >= 95) {
    reliabilityGrade = 'A';
    reliabilityDescription = 'Very Good - Minor issues';
  } else if (overallSuccessRate >= 90) {
    reliabilityGrade = 'B';
    reliabilityDescription = 'Good - Some reliability concerns';
  } else if (overallSuccessRate >= 80) {
    reliabilityGrade = 'C';
    reliabilityDescription = 'Fair - Notable reliability issues';
  } else if (overallSuccessRate >= 70) {
    reliabilityGrade = 'D';
    reliabilityDescription = 'Poor - Significant reliability issues';
  }

  console.log('Overall Success Rate: ' + overallSuccessRate.toFixed(1) + '%');
  console.log('Reliability Grade: ' + reliabilityGrade);
  console.log('Assessment: ' + reliabilityDescription);

  console.log('\n' + '='.repeat(80));

  // Log summary to logger as well
  logger.info('Network stability test completed', {
    totalTokens: results.totalTokens,
    duration: results.durationSeconds,
    kaspaApiSuccessRate: ((results.kaspaApi.success/results.totalTokens)*100).toFixed(1) + '%',
    supabaseSuccessRate: ((results.supabase.success/results.totalTokens)*100).toFixed(1) + '%',
    overallSuccessRate: overallSuccessRate.toFixed(1) + '%',
    reliabilityGrade
  });

  // Return results for potential programmatic use
  return results;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nNetwork stability test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nNetwork stability test terminated');
  process.exit(0);
});

runNetworkStabilityTest().catch(error => {
  logger.error('An unhandled error occurred during the network stability test:', error);
  console.error('Test failed:', error.message);
  process.exit(1);
});
