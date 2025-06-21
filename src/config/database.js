import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Enhanced validation with detailed error messages
if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is missing');
}

if (!supabaseKey) {
  throw new Error('SUPABASE_ANON_KEY environment variable is missing');
}

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is missing');
}

// Validate URL format
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  throw new Error(`Invalid SUPABASE_URL format: ${supabaseUrl}. Expected format: https://your-project.supabase.co`);
}

// Validate key formats (basic check)
if (!supabaseKey.startsWith('eyJ') || supabaseKey.length < 100) {
  throw new Error('SUPABASE_ANON_KEY appears to be invalid (should be a JWT token starting with "eyJ")');
}

if (!supabaseServiceRoleKey.startsWith('eyJ') || supabaseServiceRoleKey.length < 100) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY appears to be invalid (should be a JWT token starting with "eyJ")');
}

logger.info('Supabase environment variables validated successfully', {
  url: `${supabaseUrl.substring(0, 30)}...`,
  anonKeyPrefix: `${supabaseKey.substring(0, 20)}...`,
  serviceKeyPrefix: `${supabaseServiceRoleKey.substring(0, 20)}...`
});

// WebContainer-optimized fetch wrapper with enhanced logging and network fixes
const createWebContainerFetch = (apiKey) => {
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // Increased timeout for WebContainer
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'nft-listings-webcontainer/1.0.0',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...options.headers
      };
      
      // Enhanced logging before fetch call
      logger.networkDebug('Supabase fetch request', {
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
        method: options.method || 'GET',
        hasHeaders: !!headers,
        hasBody: !!options.body,
        bodyLength: options.body ? JSON.stringify(options.body).length : 0,
        timeout: 25000,
        userAgent: headers['User-Agent']
      });
      
      // WebContainer-specific fetch configuration
      const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers,
        // WebContainer-specific optimizations
        keepalive: false,
        cache: 'no-cache',
        mode: 'cors',
        credentials: 'omit',
        // Force IPv4 resolution to avoid IPv6 issues in WebContainer
        family: 4
      };

      const response = await fetch(url, fetchOptions);
      
      // Log successful response
      logger.networkDebug('Supabase fetch response', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
        headers: Object.fromEntries(response.headers.entries())
      });
      
      return response;
    } catch (error) {
      // Enhanced error logging with WebContainer-specific details
      logger.error('🌐 [NETWORK] Supabase fetch failed', {
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
        method: options.method || 'GET',
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        errorCause: error.cause,
        stack: error.stack?.substring(0, 500),
        // WebContainer-specific debugging
        isAbortError: error.name === 'AbortError',
        isNetworkError: error.message?.includes('fetch failed'),
        isSocketError: error.cause?.code === 'UND_ERR_SOCKET'
      });
      
      // Transform WebContainer-specific errors into more actionable messages
      if (error.cause?.code === 'UND_ERR_SOCKET') {
        const newError = new Error(`WebContainer network error: Unable to establish connection to Supabase. This may be a temporary network issue.`);
        newError.code = 'WEBCONTAINER_NETWORK_ERROR';
        newError.originalError = error;
        throw newError;
      }
      
      if (error.name === 'AbortError') {
        const newError = new Error('Request timeout: Supabase connection took too long to respond');
        newError.code = 'TIMEOUT_ERROR';
        newError.originalError = error;
        throw newError;
      }
      
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };
};

// WebContainer-optimized client configuration with network resilience
const clientConfig = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'User-Agent': 'nft-listings-webcontainer/1.0.0',
      'X-Client-Info': 'webcontainer-mode',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    },
    fetch: createWebContainerFetch(supabaseKey)
  },
  // WebContainer-specific database configuration
  db: {
    schema: 'public'
  },
  // Disable realtime for better stability in WebContainer
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
};

// Admin client configuration with enhanced error handling
const adminClientConfig = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'User-Agent': 'nft-listings-webcontainer/1.0.0',
      'X-Client-Info': 'webcontainer-admin-mode',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    },
    fetch: createWebContainerFetch(supabaseServiceRoleKey)
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseKey, clientConfig);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, adminClientConfig);

// WebContainer-friendly test connection function with enhanced error handling
export async function testConnection() {
  try {
    logger.info('Testing database connection (WebContainer mode with network resilience)...');
    
    // Use a simpler test that's more likely to work in WebContainer
    const { data, error } = await Promise.race([
      supabase.from('users').select('count', { count: 'exact', head: true }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000)
      )
    ]);

    if (error) {
      logger.warn('Database connection test failed (non-critical in WebContainer):', {
        message: error.message,
        code: error.code,
        isNetworkError: error.message?.includes('fetch failed'),
        isSocketError: error.message?.includes('UND_ERR_SOCKET')
      });
      // In WebContainer, we'll allow the server to start even if the initial connection fails
      return false;
    }

    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.warn('Database connection test failed (non-critical in WebContainer):', {
      message: error.message,
      name: error.name,
      code: error.code,
      isTimeout: error.message?.includes('timeout'),
      isNetworkError: error.message?.includes('network')
    });
    // In WebContainer, we'll allow the server to start even if the initial connection fails
    return false;
  }
}

// Enhanced retry function for WebContainer with improved resilience and network-specific handling
export async function retrySupabaseCall(operation, maxRetries = 3, baseDelay = 2000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`🔄 [SUPABASE] Attempt ${attempt}/${maxRetries} starting...`);
      
      const result = await operation();
      
      // Check if the result contains an error (Supabase pattern)
      if (result && typeof result === 'object' && result.error) {
        const error = new Error(result.error.message || 'Supabase operation failed');
        error.code = result.error.code;
        error.details = result.error.details;
        error.hint = result.error.hint;
        error.supabaseError = result.error;
        
        logger.error(`🔄 [SUPABASE] Operation returned error on attempt ${attempt}`, {
          errorMessage: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint
        });
        
        throw error;
      }
      
      logger.debug(`✅ [SUPABASE] Operation succeeded on attempt ${attempt}`);
      return result;
    } catch (error) {
      lastError = error;
      
      // Enhanced error logging with WebContainer-specific context
      logger.error(`❌ [SUPABASE] Attempt ${attempt}/${maxRetries} failed`, {
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        errorStack: error.stack?.substring(0, 300),
        supabaseError: error.supabaseError,
        isWebContainerNetworkError: error.code === 'WEBCONTAINER_NETWORK_ERROR',
        isTimeoutError: error.code === 'TIMEOUT_ERROR'
      });
      
      // Check if it's a retryable error
      const shouldRetry = isRetryableSupabaseError(error);
      
      if (!shouldRetry || attempt === maxRetries) {
        logger.error(`🚫 [SUPABASE] Operation failed after ${attempt} attempts (final):`, {
          error: error.message,
          code: error.code,
          finalAttempt: true,
          shouldRetry,
          maxRetriesReached: attempt === maxRetries
        });
        throw error;
      }
      
      // Longer delays for WebContainer network issues
      const delay = Math.min(baseDelay * Math.pow(1.5, attempt - 1), 8000);
      
      logger.warn(`🔄 [SUPABASE] Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`, {
        error: error.message,
        code: error.code,
        attempt,
        maxRetries,
        delay,
        shouldRetry,
        isNetworkIssue: error.code === 'WEBCONTAINER_NETWORK_ERROR' || error.code === 'TIMEOUT_ERROR'
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Enhanced error detection for WebContainer with network-specific handling
function isRetryableSupabaseError(error) {
  // Don't retry authentication/authorization errors
  if (error.message && (
    error.message.includes('No API key found') ||
    error.message.includes('Invalid API key') ||
    error.message.includes('Unauthorized') ||
    error.message.includes('Forbidden')
  )) {
    return false;
  }

  // Don't retry content-type errors (PGRST102)
  if (error.code === 'PGRST102') {
    return false;
  }

  // Don't retry constraint violations
  if (error.code && error.code.startsWith('23')) {
    return false;
  }

  // Always retry WebContainer-specific network errors
  if (error.code === 'WEBCONTAINER_NETWORK_ERROR' || error.code === 'TIMEOUT_ERROR') {
    return true;
  }

  // Retry network-level errors (common in WebContainer)
  const networkErrors = [
    'fetch failed',
    'ECONNRESET',
    'ENOTFOUND', 
    'ECONNREFUSED',
    'ETIMEDOUT',
    'socket hang up',
    'network error',
    'connection error',
    'Connection timeout',
    'UND_ERR_SOCKET'
  ];
  
  if (error.message) {
    for (const indicator of networkErrors) {
      if (error.message.toLowerCase().includes(indicator.toLowerCase())) {
        return true;
      }
    }
  }
  
  // Supabase connection errors
  if (error.code === '08000' || error.code === '08003' || error.code === '08006') {
    return true;
  }
  
  // Timeout errors
  if (error.name === 'AbortError') {
    return true;
  }
  
  return false;
}

// WebContainer-friendly connectivity check with enhanced error handling
export async function checkSupabaseConnectivity() {
  try {
    const startTime = Date.now();
    
    logger.info('🔍 Starting WebContainer-optimized connectivity check...');
    
    const response = await Promise.race([
      fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'User-Agent': 'nft-listings-webcontainer/1.0.0',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-cache',
        mode: 'cors',
        credentials: 'omit'
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connectivity check timeout after 10 seconds')), 10000)
      )
    ]);
    
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    const result = {
      connected: response.ok,
      latency,
      status: response.status,
      statusText: response.statusText
    };
    
    if (response.ok) {
      logger.info('✅ Supabase connectivity check successful', {
        status: response.status,
        latency: `${latency}ms`,
        url: supabaseUrl
      });
    } else {
      logger.warn('⚠️ Supabase connectivity check failed', {
        status: response.status,
        statusText: response.statusText,
        latency: `${latency}ms`,
        url: supabaseUrl
      });
    }
    
    return result;
    
  } catch (error) {
    logger.warn('⚠️ Supabase connectivity check failed (WebContainer limitation):', {
      error: error.message,
      url: supabaseUrl,
      isTimeout: error.message?.includes('timeout'),
      isNetworkError: error.message?.includes('fetch failed')
    });
    
    return {
      connected: false,
      latency: null,
      error: error.message
    };
  }
}