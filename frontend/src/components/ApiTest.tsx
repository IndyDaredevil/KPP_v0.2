import React, { useState } from 'react';
import { useHealthCheck, useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

const ApiTest: React.FC = () => {
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [isRunningTests, setIsRunningTests] = useState(false);
  
  const { data: healthData, isLoading: healthLoading, error: healthError } = useHealthCheck();
  const { isAuthenticated, user } = useAuth();

  const runApiTests = async () => {
    setIsRunningTests(true);
    const results: Record<string, any> = {};

    try {
      // Test 1: Health Check
      console.log('🔍 Testing health endpoint...');
      try {
        const health = await api.health();
        results.health = { success: true, data: health };
        console.log('✅ Health check passed:', health);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.health = { success: false, error: errorMessage };
        console.error('❌ Health check failed:', error);
      }

      // Test 2: Get Listings (authenticated)
      console.log('🔍 Testing listings endpoint...');
      if (!isAuthenticated) {
        results.listings = { success: false, error: 'Authentication required', skipped: true };
        console.log('⏭️ Skipping listings test - authentication required');
      } else {
        try {
          const listings = await api.getListings({ page: 1, limit: 5 });
          results.listings = { success: true, data: listings };
          console.log('✅ Listings fetch passed:', listings);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.listings = { success: false, error: errorMessage };
          console.error('❌ Listings fetch failed:', error);
        }
      }

      // Test 3: Historical Listings
      console.log('🔍 Testing historical listings...');
      if (!isAuthenticated) {
        results.historical = { success: false, error: 'Authentication required', skipped: true };
        console.log('⏭️ Skipping historical listings test - authentication required');
      } else {
        try {
          const historical = await api.getHistoricalListings({ page: 1, limit: 5 });
          results.historical = { success: true, data: historical };
          console.log('✅ Historical listings passed:', historical);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.historical = { success: false, error: errorMessage };
          console.error('❌ Historical listings failed:', error);
        }
      }

      // Test 4: Sales History (for a sample token)
      console.log('🔍 Testing sales history...');
      if (!isAuthenticated) {
        results.salesHistory = { success: false, error: 'Authentication required', skipped: true };
        console.log('⏭️ Skipping sales history test - authentication required');
      } else {
        try {
          const salesHistory = await api.getSalesHistory(1, { page: 1, limit: 5 });
          results.salesHistory = { success: true, data: salesHistory };
          console.log('✅ Sales history passed:', salesHistory);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.salesHistory = { success: false, error: errorMessage };
          console.error('❌ Sales history failed:', error);
        }
      }

    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }

    setTestResults(results);
    setIsRunningTests(false);
  };

  const TestResult = ({ title, result }: { title: string; result: any }) => (
    <div className="border border-kaspa-primary-green/20 rounded-lg p-4 mb-4 bg-kaspa-accent-medium-blue/50">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-lg ${result?.success ? 'text-kaspa-secondary-green' : result?.skipped ? 'text-yellow-400' : 'text-red-400'}`}>
          {result?.success ? '✅' : result?.skipped ? '⏭️' : '❌'}
        </span>
        <h3 className="font-semibold text-white font-kaspa-header">{title}</h3>
        {result?.skipped && (
          <span className="text-sm text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20 font-kaspa-body">
            {result?.error === 'Authentication required' ? 'AUTH REQUIRED' : 'SKIPPED'}
          </span>
        )}
      </div>
      <pre className="bg-kaspa-accent-dark-blue p-2 rounded text-sm overflow-auto max-h-40 text-kaspa-primary-gray font-mono">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );

  // Get the current API base URL for display
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 
    (import.meta.env.MODE === 'development' ? "http://localhost:3000" : "");

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-white font-kaspa-header">API Integration Test</h1>
      
      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-kaspa-accent-medium-blue p-4 rounded-lg border border-kaspa-primary-green/20">
          <h3 className="font-semibold text-kaspa-secondary-green font-kaspa-header">Backend Health</h3>
          {healthLoading ? (
            <p className="text-kaspa-accent-teal font-kaspa-body">Checking...</p>
          ) : healthError ? (
            <p className="text-red-400 font-kaspa-body">❌ Offline</p>
          ) : (
            <p className="text-kaspa-secondary-green font-kaspa-body">✅ Online</p>
          )}
          {healthData && (
            <p className="text-sm text-kaspa-primary-gray mt-1 font-kaspa-body">
              Env: {(healthData as any).environment || 'Unknown'}
            </p>
          )}
          <p className="text-xs text-kaspa-primary-gray mt-2 font-kaspa-body">
            API URL: {apiBaseUrl || 'Relative URLs (via proxy)'}
          </p>
          <p className="text-xs text-kaspa-primary-gray font-kaspa-body">
            Mode: {import.meta.env.MODE}
          </p>
        </div>

        <div className={`${isAuthenticated ? 'bg-kaspa-secondary-green/10 border-kaspa-secondary-green/20' : 'bg-yellow-500/10 border-yellow-500/20'} p-4 rounded-lg border`}>
          <h3 className={`font-semibold ${isAuthenticated ? 'text-kaspa-secondary-green' : 'text-yellow-400'} font-kaspa-header`}>Authentication</h3>
          <p className={`${isAuthenticated ? 'text-kaspa-secondary-green' : 'text-yellow-400'} font-kaspa-body`}>
            {isAuthenticated ? '✅ Authenticated' : '⚠️ Not Authenticated'}
          </p>
          {user && (
            <p className="text-sm text-kaspa-primary-gray mt-1 font-kaspa-body">
              {user.email} ({user.role})
            </p>
          )}
          {!isAuthenticated && (
            <p className="text-sm text-yellow-300 mt-1 font-kaspa-body">
              Some tests will be skipped
            </p>
          )}
        </div>

        <div className="bg-kaspa-secondary-green/10 p-4 rounded-lg border border-kaspa-secondary-green/20">
          <h3 className="font-semibold text-kaspa-secondary-green font-kaspa-header">Read-Only Mode</h3>
          <p className="text-kaspa-secondary-green font-kaspa-body">✅ View Only</p>
          <p className="text-sm text-kaspa-primary-gray mt-1 font-kaspa-body">
            Create/Edit functionality removed
          </p>
        </div>
      </div>

      {/* Test Controls */}
      <div className="mb-6">
        <button
          onClick={runApiTests}
          disabled={isRunningTests || Boolean(healthError)}
          className="bg-kaspa-primary-green text-kaspa-accent-dark-blue px-6 py-2 rounded-lg hover:bg-kaspa-secondary-green disabled:opacity-50 disabled:cursor-not-allowed font-kaspa-body font-medium transition-all duration-200 transform hover:scale-105"
        >
          {isRunningTests ? 'Running Tests...' : 
           `Run API Test Suite ${!isAuthenticated ? '(Limited - No Auth)' : ''}`}
        </button>
        
        {healthError && (
          <p className="text-red-400 mt-2 font-kaspa-body">
            ⚠️ Backend is not accessible. The backend server may be down or there may be a network connectivity issue.
          </p>
        )}

        {!isAuthenticated && (
          <p className="text-yellow-400 mt-2 font-kaspa-body">
            ⚠️ You are not authenticated. Some API tests will be skipped. Please log in to test all endpoints.
          </p>
        )}
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4 text-white font-kaspa-header">Test Results</h2>
          
          <TestResult title="Health Check" result={testResults.health} />
          <TestResult title="Get Listings" result={testResults.listings} />
          <TestResult title="Historical Listings" result={testResults.historical} />
          <TestResult title="Sales History" result={testResults.salesHistory} />

          {/* Summary */}
          <div className="mt-6 p-4 bg-kaspa-accent-medium-blue/50 rounded-lg border border-kaspa-primary-green/20">
            <h3 className="font-semibold mb-2 text-white font-kaspa-header">Test Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-kaspa-secondary-green font-semibold font-kaspa-body">
                  ✅ Passed: {Object.values(testResults).filter((r: any) => r?.success).length}
                </span>
              </div>
              <div>
                <span className="text-red-400 font-semibold font-kaspa-body">
                  ❌ Failed: {Object.values(testResults).filter((r: any) => !r?.success && !r?.skipped).length}
                </span>
              </div>
              <div>
                <span className="text-yellow-400 font-semibold font-kaspa-body">
                  ⏭️ Skipped: {Object.values(testResults).filter((r: any) => r?.skipped).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
        <h3 className="font-semibold text-yellow-400 mb-2 font-kaspa-header">Deployment Status</h3>
        <div className="text-sm text-yellow-300 space-y-2 font-kaspa-body">
          <p><strong>Frontend:</strong> Deployed on Netlify</p>
          <p><strong>Backend:</strong> Deployed on Railway ({apiBaseUrl || 'via proxy'})</p>
          <p><strong>Database:</strong> Supabase (managed by backend)</p>
          
          <div className="mt-4">
            <h4 className="font-semibold mb-2 font-kaspa-header">Troubleshooting:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>If backend health shows offline, check if the Railway deployment is running</li>
              <li>Verify the VITE_API_BASE_URL environment variable is NOT set in Netlify (should use proxy)</li>
              <li>Check browser console for CORS or network errors</li>
              <li><strong>For full testing:</strong> Log in to test authenticated endpoints</li>
              <li>Click "Run API Test Suite" to test all available endpoints</li>
              <li><strong>Note:</strong> This application is in read-only mode - no create/edit functionality</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiTest;