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

// WebContainer DNS routing detection and workaround
let dnsRoutingIssueDetected = false;
let consecutiveRoutingErrors = 0;
const MAX_ROUTING_ERRORS = 3;

// WebContainer-optimized fetch wrapper with DNS routing workaround
const createWebContainerFetch = (apiKey) => {
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // If we've detected persistent DNS routing issues, try alternative approaches
      if (dnsRoutingIssueDetected && consecutiveRoutingErrors >= MAX_ROUTING_ERRORS) {
        logger.warn('🔄 [DNS WORKAROUND] Attempting alternative fetch configuration due to persistent routing issues');
        
        // Try with minimal configuration to bypass WebContainer routing issues
        const minimalResponse = await fetch(url, {
          method: options.method || 'GET',
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: options.body,
          signal: controller.signal
        });
        
        if (minimalResponse.ok) {
          logger.info('✅ [DNS WORKAROUND] Alternative fetch configuration successful');
          consecutiveRoutingErrors = 0;
          dnsRoutingIssueDetected = false;
          return minimalResponse;
        }
      }
      
      logger.networkDebug('DNS resolution attempt', {
        hostname,
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
        isSupabaseUrl: hostname.includes('supabase.co'),
        routingIssueDetected: dnsRoutingIssueDetected,
        consecutiveErrors: consecutiveRoutingErrors
      });

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
      
      logger.networkDebug('Supabase fetch request', {
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
        method: options.method || 'GET',
        hostname,
        hasHeaders: !!headers,
        hasBody: !!options.body,
        bodyLength: options.body ? JSON.stringify(options.body).length : 0,
        timeout: 30000,
        userAgent: headers['User-Agent']
      });
      
      const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers,
        keepalive: false,
        cache: 'no-cache',
        mode: 'cors',
        credentials: 'omit'
      };

      const response = await fetch(url, fetchOptions);
      
      // Reset error counters on successful response
      if (response.ok) {
        consecutiveRoutingErrors = 0;
        if (dnsRoutingIssueDetected) {
          logger.info('✅ [DNS RECOVERY] DNS routing issue appears to be resolved');
          dnsRoutingIssueDetected = false;
        }
      }
      
      logger.networkDebug('Supabase fetch response', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
        headers: Object.fromEntries(response.headers.entries()),
        hostname
      });
      
      return response;
    } catch (error) {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Detect DNS routing issues
      const isLocalhostRouting = error.cause?.socket?.remoteAddress === '127.0.0.1';
      const isSocketError = error.cause?.code === 'UND_ERR_SOCKET';
      
      if (isLocalhostRouting || (isSocketError && error.message?.includes('fetch failed'))) {
        consecutiveRoutingErrors++;
        dnsRoutingIssueDetected = true;
        
        logger.error('🌐 [NETWORK] WebContainer DNS routing issue detected', {
          url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
          hostname,
          method: options.method || 'GET',
          errorName: error.name,
          errorMessage: error.message,
          errorCode: error.code,
          consecutiveErrors: consecutiveRoutingErrors,
          isLocalhostRouting,
          remoteAddress: error.cause?.socket?.remoteAddress,
          localAddress: error.cause?.socket?.localAddress
        });
        
        // Create a more descriptive error for WebContainer DNS issues
        const routingError = new Error(`WebContainer network connectivity issue: Unable to reach ${hostname}. This appears to be a temporary WebContainer networking problem.`);
        routingError.code = 'WEBCONTAINER_CONNECTIVITY_ERROR';
        routingError.hostname = hostname;
        routingError.isTemporary = true;
        routingError.consecutiveErrors = consecutiveRoutingErrors;
        routingError.originalError = error;
        throw routingError;
      }
      
      // Handle other network errors
      logger.error('🌐 [NETWORK] Supabase fetch failed', {
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
        hostname,
        method: options.method || 'GET',
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        errorCause: error.cause,
        stack: error.stack?.substring(0, 500),
        isAbortError: error.name === 'AbortError',
        isNetworkError: error.message?.includes('fetch failed'),
        isSocketError: error.cause?.code === 'UND_ERR_SOCKET'
      });
      
      if (error.name === 'AbortError') {
        const newError = new Error(`Request timeout: Connection to ${hostname} took too long to respond`);
        newError.code = 'TIMEOUT_ERROR';
        newError.hostname = hostname;
        newError.originalError = error;
        throw newError;
      }
      
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };
};

// WebContainer-optimized client configuration with graceful degradation
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
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
};

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

// WebContainer-friendly test connection with graceful degradation
export async function testConnection() {
  try {
    logger.info('Testing database connection (WebContainer mode with connectivity workarounds)...');
    
    const { data, error } = await Promise.race([
      supabase.from('users').select('count', { count: 'exact', head: true }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 20 seconds')), 20000)
      )
    ]);

    if (error) {
      logger.warn('Database connection test failed (will continue with graceful degradation):', {
        message: error.message,
        code: error.code,
        isConnectivityError: error.code === 'WEBCONTAINER_CONNECTIVITY_ERROR',
        isTemporary: error.isTemporary
      });
      return false;
    }

    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.warn('Database connection test failed (will continue with graceful degradation):', {
      message: error.message,
      name: error.name,
      code: error.code,
      isTimeout: error.message?.includes('timeout'),
      isConnectivityError: error.code === 'WEBCONTAINER_CONNECTIVITY_ERROR'
    });
    return false;
  }
}

// Enhanced retry function with WebContainer-specific handling
export async function retrySupabaseCall(operation, maxRetries = 5, baseDelay = 3000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`🔄 [SUPABASE] Attempt ${attempt}/${maxRetries} starting...`);
      
      const result = await operation();
      
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
      
      logger.error(`❌ [SUPABASE] Attempt ${attempt}/${maxRetries} failed`, {
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        errorStack: error.stack?.substring(0, 300),
        supabaseError: error.supabaseError,
        isWebContainerConnectivityError: error.code === 'WEBCONTAINER_CONNECTIVITY_ERROR',
        isTimeoutError: error.code === 'TIMEOUT_ERROR',
        hostname: error.hostname,
        consecutiveErrors: error.consecutiveErrors,
        isTemporary: error.isTemporary
      });
      
      const shouldRetry = isRetryableSupabaseError(error);
      
      // Special handling for WebContainer connectivity issues
      if (error.code === 'WEBCONTAINER_CONNECTIVITY_ERROR') {
        logger.warn(`🔄 [WEBCONTAINER] Connectivity issue detected (attempt ${attempt}/${maxRetries})`);
        
        if (attempt === maxRetries) {
          logger.error(`🚫 [WEBCONTAINER] Connectivity issues persist after ${maxRetries} attempts. Operations may be degraded.`);
        }
      }
      
      if (!shouldRetry || attempt === maxRetries) {
        logger.error(`🚫 [SUPABASE] Operation failed after ${attempt} attempts (final):`, {
          error: error.message,
          code: error.code,
          hostname: error.hostname,
          finalAttempt: true,
          shouldRetry,
          maxRetriesReached: attempt === maxRetries,
          isConnectivityIssue: error.code === 'WEBCONTAINER_CONNECTIVITY_ERROR'
        });
        throw error;
      }
      
      // Adaptive delay based on error type
      let delay = baseDelay * Math.pow(1.5, attempt - 1);
      
      if (error.code === 'WEBCONTAINER_CONNECTIVITY_ERROR') {
        // Longer delays for connectivity issues
        delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 15000);
      } else {
        delay = Math.min(delay, 10000);
      }
      
      logger.warn(`🔄 [SUPABASE] Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`, {
        error: error.message,
        code: error.code,
        hostname: error.hostname,
        attempt,
        maxRetries,
        delay,
        shouldRetry,
        isConnectivityIssue: error.code === 'WEBCONTAINER_CONNECTIVITY_ERROR',
        isTemporary: error.isTemporary
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Enhanced error detection with WebContainer-specific handling
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

  // Always retry WebContainer connectivity errors (they're often temporary)
  if (error.code === 'WEBCONTAINER_CONNECTIVITY_ERROR' || 
      error.code === 'TIMEOUT_ERROR') {
    return true;
  }

  // Retry network-level errors
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

// WebContainer-friendly connectivity check with graceful degradation
export async function checkSupabaseConnectivity() {
  try {
    const startTime = Date.now();
    const urlObj = new URL(supabaseUrl);
    const hostname = urlObj.hostname;
    
    logger.info('🔍 Starting WebContainer connectivity check with graceful degradation...', {
      hostname,
      url: supabaseUrl,
      dnsIssueDetected: dnsRoutingIssueDetected,
      consecutiveErrors: consecutiveRoutingErrors
    });
    
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
        setTimeout(() => reject(new Error('Connectivity check timeout after 15 seconds')), 15000)
      )
    ]);
    
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    const result = {
      connected: response.ok,
      latency,
      status: response.status,
      statusText: response.statusText,
      hostname
    };
    
    if (response.ok) {
      logger.info('✅ Supabase connectivity check successful', {
        status: response.status,
        latency: `${latency}ms`,
        hostname,
        url: supabaseUrl
      });
    } else {
      logger.warn('⚠️ Supabase connectivity check failed', {
        status: response.status,
        statusText: response.statusText,
        latency: `${latency}ms`,
        hostname,
        url: supabaseUrl
      });
    }
    
    return result;
    
  } catch (error) {
    const urlObj = new URL(supabaseUrl);
    const hostname = urlObj.hostname;
    const isLocalhostRouting = error.cause?.socket?.remoteAddress === '127.0.0.1';
    
    logger.warn('⚠️ Supabase connectivity check failed (WebContainer networking issue):', {
      error: error.message,
      hostname,
      url: supabaseUrl,
      isTimeout: error.message?.includes('timeout'),
      isNetworkError: error.message?.includes('fetch failed'),
      isSocketError: error.cause?.code === 'UND_ERR_SOCKET',
      isLocalhostRouting,
      remoteAddress: error.cause?.socket?.remoteAddress,
      willContinueWithDegradation: true
    });
    
    return {
      connected: false,
      latency: null,
      error: error.message,
      hostname,
      isLocalhostRouting,
      degradedMode: true
    };
  }
}