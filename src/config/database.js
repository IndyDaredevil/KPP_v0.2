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

// WebContainer-optimized fetch wrapper with enhanced logging
const createWebContainerFetch = (apiKey) => {
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Reduced timeout for WebContainer
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'nft-listings-webcontainer/1.0.0',
        ...options.headers
      };
      
      // Enhanced logging before fetch call
      logger.networkDebug('Supabase fetch request', {
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
        method: options.method || 'GET',
        hasHeaders: !!headers,
        hasBody: !!options.body,
        bodyLength: options.body ? JSON.stringify(options.body).length : 0,
        timeout: 15000
      });
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
        // WebContainer-specific optimizations
        keepalive: false,
        cache: 'no-cache'
      });
      
      // Log successful response
      logger.networkDebug('Supabase fetch response', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: url.substring(0, 100) + (url.length > 100 ? '...' : '')
      });
      
      return response;
    } catch (error) {
      // Enhanced error logging
      logger.error('🌐 [NETWORK] Supabase fetch failed', {
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
        method: options.method || 'GET',
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        errorCause: error.cause,
        stack: error.stack?.substring(0, 500)
      });
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };
};

// WebContainer-optimized client configuration
const clientConfig = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'User-Agent': 'nft-listings-webcontainer/1.0.0',
      'X-Client-Info': 'webcontainer-mode'
    },
    fetch: createWebContainerFetch(supabaseKey)
  }
};

// Admin client configuration
const adminClientConfig = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'User-Agent': 'nft-listings-webcontainer/1.0.0',
      'X-Client-Info': 'webcontainer-mode'
    },
    fetch: createWebContainerFetch(supabaseServiceRoleKey)
  }
};

export const supabase = createClient(supabaseUrl, supabaseKey, clientConfig);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, adminClientConfig);

// WebContainer-friendly test connection function
export async function testConnection() {
  try {
    logger.info('Testing database connection (WebContainer mode)...');
    
    // Use a simpler test that's more likely to work in WebContainer
    const { data, error } = await Promise.race([
      supabase.from('users').select('count', { count: 'exact', head: true }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      )
    ]);

    if (error) {
      logger.warn('Database connection test failed (non-critical in WebContainer):', {
        message: error.message,
        code: error.code
      });
      // In WebContainer, we'll allow the server to start even if the initial connection fails
      return false;
    }

    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.warn('Database connection test failed (non-critical in WebContainer):', {
      message: error.message,
      name: error.name
    });
    // In WebContainer, we'll allow the server to start even if the initial connection fails
    return false;
  }
}

// Simplified retry function for WebContainer with improved resilience and enhanced logging
export async function retrySupabaseCall(operation, maxRetries = 3, baseDelay = 1500) {
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
      
      // Enhanced error logging
      logger.error(`❌ [SUPABASE] Attempt ${attempt}/${maxRetries} failed`, {
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        errorStack: error.stack?.substring(0, 300),
        supabaseError: error.supabaseError
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
      
      // Longer delays for better stability
      const delay = Math.min(baseDelay * attempt, 4500);
      
      logger.warn(`🔄 [SUPABASE] Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`, {
        error: error.message,
        code: error.code,
        attempt,
        maxRetries,
        delay,
        shouldRetry
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Enhanced error detection for WebContainer
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
    'Connection timeout'
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

// WebContainer-friendly connectivity check
export async function checkSupabaseConnectivity() {
  try {
    const startTime = Date.now();
    const response = await Promise.race([
      fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'User-Agent': 'nft-listings-webcontainer/1.0.0'
        },
        cache: 'no-cache'
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connectivity check timeout')), 8000)
      )
    ]);
    
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    const result = {
      connected: response.ok,
      latency,
      status: response.status
    };
    
    if (response.ok) {
      logger.info('Supabase connectivity check successful', {
        status: response.status,
        latency: `${latency}ms`,
        url: supabaseUrl
      });
    } else {
      logger.warn('Supabase connectivity check failed', {
        status: response.status,
        latency: `${latency}ms`,
        url: supabaseUrl
      });
    }
    
    return result;
    
  } catch (error) {
    logger.warn('Supabase connectivity check failed (WebContainer limitation):', {
      error: error.message,
      url: supabaseUrl
    });
    
    return {
      connected: false,
      latency: null,
      error: error.message
    };
  }
}