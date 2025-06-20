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
    <div className="border rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-lg ${result?.success ? 'text-green-600' : result?.skipped ? 'text-yellow-600' : 'text-red-600'}`}>
          {result?.success ? '✅' : result?.skipped ? '⏭️' : '❌'}
        </span>
        <h3 className="font-semibold">{title}</h3>
        {result?.skipped && (
          <span className="text-sm text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
            {result?.error === 'Authentication required' ? 'AUTH REQUIRED' : 'SKIPPED'}
          </span>
        )}
      </div>
      <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-40">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );

  // Get the current API base URL for display
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 
    (import.meta.env.MODE === 'development' ? "http://localhost:3000" : "");

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">API Integration Test</h1>
      
      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800">Backend Health</h3>
          {healthLoading ? (
            <p className="text-blue-600">Checking...</p>
          ) : healthError ? (
            <p className="text-red-600">❌ Offline</p>
          ) : (
            <p className="text-green-600">✅ Online</p>
          )}
          {healthData && (
            <p className="text-sm text-gray-600 mt-1">
              Env: {(healthData as any).environment || 'Unknown'}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            API URL: {apiBaseUrl || 'Relative URLs (via proxy)'}
          </p>
          <p className="text-xs text-gray-500">
            Mode: {import.meta.env.MODE}
          </p>
        </div>

        <div className={`${isAuthenticated ? 'bg-green-50' : 'bg-yellow-50'} p-4 rounded-lg`}>
          <h3 className={`font-semibold ${isAuthenticated ? 'text-green-800' : 'text-yellow-800'}`}>Authentication</h3>
          <p className={`${isAuthenticated ? 'text-green-600' : 'text-yellow-600'}`}>
            {isAuthenticated ? '✅ Authenticated' : '⚠️ Not Authenticated'}
          </p>
          {user && (
            <p className="text-sm text-gray-600 mt-1">
              {user.email} ({user.role})
            </p>
          )}
          {!isAuthenticated && (
            <p className="text-sm text-yellow-700 mt-1">
              Some tests will be skipped
            </p>
          )}
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-800">Read-Only Mode</h3>
          <p className="text-green-600">✅ View Only</p>
          <p className="text-sm text-gray-600 mt-1">
            Create/Edit functionality removed
          </p>
        </div>
      </div>

      {/* Test Controls */}
      <div className="mb-6">
        <button
          onClick={runApiTests}
          disabled={isRunningTests || Boolean(healthError)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunningTests ? 'Running Tests...' : 
           `Run API Test Suite ${!isAuthenticated ? '(Limited - No Auth)' : ''}`}
        </button>
        
        {healthError && (
          <p className="text-red-600 mt-2">
            ⚠️ Backend is not accessible. The backend server may be down or there may be a network connectivity issue.
          </p>
        )}

        {!isAuthenticated && (
          <p className="text-yellow-600 mt-2">
            ⚠️ You are not authenticated. Some API tests will be skipped. Please log in to test all endpoints.
          </p>
        )}
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Test Results</h2>
          
          <TestResult title="Health Check" result={testResults.health} />
          <TestResult title="Get Listings" result={testResults.listings} />
          <TestResult title="Historical Listings" result={testResults.historical} />
          <TestResult title="Sales History" result={testResults.salesHistory} />

          {/* Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Test Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-green-600 font-semibold">
                  ✅ Passed: {Object.values(testResults).filter((r: any) => r?.success).length}
                </span>
              </div>
              <div>
                <span className="text-red-600 font-semibold">
                  ❌ Failed: {Object.values(testResults).filter((r: any) => !r?.success && !r?.skipped).length}
                </span>
              </div>
              <div>
                <span className="text-yellow-600 font-semibold">
                  ⏭️ Skipped: {Object.values(testResults).filter((r: any) => r?.skipped).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-2">Deployment Status</h3>
        <div className="text-sm text-yellow-700 space-y-2">
          <p><strong>Frontend:</strong> Deployed on Netlify</p>
          <p><strong>Backend:</strong> Deployed on Railway ({apiBaseUrl || 'via proxy'})</p>
          <p><strong>Database:</strong> Supabase (managed by backend)</p>
          
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Troubleshooting:</h4>
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