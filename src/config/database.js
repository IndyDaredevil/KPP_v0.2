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

// WebContainer-optimized fetch wrapper with DNS resolution fixes
const createWebContainerFetch = (apiKey) => {
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // Increased timeout
    
    try {
      // Extract hostname from URL for DNS debugging
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Log DNS resolution attempt
      logger.networkDebug('DNS resolution attempt', {
        hostname,
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
        isSupabaseUrl: hostname.includes('supabase.co')
      });

      const headers = {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'nft-listings-webcontainer/1.0.0',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        // Add DNS resolution hints
        'Host': hostname,
        ...options.headers
      };
      
      // Enhanced logging before fetch call
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
      
      // WebContainer-specific fetch configuration with DNS fixes
      const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers,
        // WebContainer-specific optimizations
        keepalive: false,
        cache: 'no-cache',
        mode: 'cors',
        credentials: 'omit',
        // Force IPv4 resolution to avoid localhost routing
        family: 4
      };

      const response = await fetch(url, fetchOptions);
      
      // Log successful response with connection details
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
      // Enhanced error logging with network diagnostics
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      logger.error('🌐 [NETWORK] Supabase fetch failed', {
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
        hostname,
        method: options.method || 'GET',
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        errorCause: error.cause,
        stack: error.stack?.substring(0, 500),
        // WebContainer-specific debugging
        isAbortError: error.name === 'AbortError',
        isNetworkError: error.message?.includes('fetch failed'),
        isSocketError: error.cause?.code === 'UND_ERR_SOCKET',
        // DNS resolution debugging
        isDnsError: error.message?.includes('getaddrinfo'),
        isLocalhostRouting: error.cause?.socket?.remoteAddress === '127.0.0.1'
      });
      
      // Transform WebContainer-specific errors with better diagnostics
      if (error.cause?.code === 'UND_ERR_SOCKET') {
        const isLocalhostRouting = error.cause?.socket?.remoteAddress === '127.0.0.1';
        
        if (isLocalhostRouting) {
          const newError = new Error(`WebContainer DNS routing error: Request to ${hostname} was incorrectly routed to localhost (127.0.0.1). This is a WebContainer network configuration issue.`);
          newError.code = 'WEBCONTAINER_DNS_ROUTING_ERROR';
          newError.hostname = hostname;
          newError.originalError = error;
          throw newError;
        } else {
          const newError = new Error(`WebContainer network error: Unable to establish connection to ${hostname}. This may be a temporary network issue.`);
          newError.code = 'WEBCONTAINER_NETWORK_ERROR';
          newError.hostname = hostname;
          newError.originalError = error;
          throw newError;
        }
      }
      
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
    logger.info('Testing database connection (WebContainer mode with DNS diagnostics)...');
    
    // Use a simpler test that's more likely to work in WebContainer
    const { data, error } = await Promise.race([
      supabase.from('users').select('count', { count: 'exact', head: true }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 20 seconds')), 20000)
      )
    ]);

    if (error) {
      logger.warn('Database connection test failed (non-critical in WebContainer):', {
        message: error.message,
        code: error.code,
        isNetworkError: error.message?.includes('fetch failed'),
        isSocketError: error.message?.includes('UND_ERR_SOCKET'),
        isDnsRoutingError: error.code === 'WEBCONTAINER_DNS_ROUTING_ERROR'
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
      isNetworkError: error.message?.includes('network'),
      isDnsRoutingError: error.code === 'WEBCONTAINER_DNS_ROUTING_ERROR'
    });
    // In WebContainer, we'll allow the server to start even if the initial connection fails
    return false;
  }
}

// Enhanced retry function with DNS routing error handling
export async function retrySupabaseCall(operation, maxRetries = 5, baseDelay = 3000) {
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
      
      // Enhanced error logging with DNS routing diagnostics
      logger.error(`❌ [SUPABASE] Attempt ${attempt}/${maxRetries} failed`, {
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        errorStack: error.stack?.substring(0, 300),
        supabaseError: error.supabaseError,
        isWebContainerNetworkError: error.code === 'WEBCONTAINER_NETWORK_ERROR',
        isDnsRoutingError: error.code === 'WEBCONTAINER_DNS_ROUTING_ERROR',
        isTimeoutError: error.code === 'TIMEOUT_ERROR',
        hostname: error.hostname
      });
      
      // Check if it's a retryable error
      const shouldRetry = isRetryableSupabaseError(error);
      
      // Special handling for DNS routing errors
      if (error.code === 'WEBCONTAINER_DNS_ROUTING_ERROR') {
        logger.error(`🚨 [DNS] Critical DNS routing issue detected - requests to ${error.hostname} are being routed to localhost`);
        
        if (attempt === maxRetries) {
          logger.error(`🚫 [DNS] DNS routing issue persists after ${maxRetries} attempts. This requires WebContainer network configuration fixes.`);
        }
      }
      
      if (!shouldRetry || attempt === maxRetries) {
        logger.error(`🚫 [SUPABASE] Operation failed after ${attempt} attempts (final):`, {
          error: error.message,
          code: error.code,
          hostname: error.hostname,
          finalAttempt: true,
          shouldRetry,
          maxRetriesReached: attempt === maxRetries
        });
        throw error;
      }
      
      // Exponential backoff with longer delays for DNS issues
      const delay = error.code === 'WEBCONTAINER_DNS_ROUTING_ERROR' 
        ? Math.min(baseDelay * Math.pow(2, attempt - 1), 15000)
        : Math.min(baseDelay * Math.pow(1.5, attempt - 1), 10000);
      
      logger.warn(`🔄 [SUPABASE] Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`, {
        error: error.message,
        code: error.code,
        hostname: error.hostname,
        attempt,
        maxRetries,
        delay,
        shouldRetry,
        isNetworkIssue: error.code === 'WEBCONTAINER_NETWORK_ERROR' || error.code === 'TIMEOUT_ERROR',
        isDnsIssue: error.code === 'WEBCONTAINER_DNS_ROUTING_ERROR'
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Enhanced error detection with DNS routing error handling
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

  // Always retry WebContainer-specific network errors (including DNS routing)
  if (error.code === 'WEBCONTAINER_NETWORK_ERROR' || 
      error.code === 'WEBCONTAINER_DNS_ROUTING_ERROR' || 
      error.code === 'TIMEOUT_ERROR') {
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

// WebContainer-friendly connectivity check with DNS diagnostics
export async function checkSupabaseConnectivity() {
  try {
    const startTime = Date.now();
    const urlObj = new URL(supabaseUrl);
    const hostname = urlObj.hostname;
    
    logger.info('🔍 Starting WebContainer-optimized connectivity check with DNS diagnostics...', {
      hostname,
      url: supabaseUrl
    });
    
    const response = await Promise.race([
      fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'User-Agent': 'nft-listings-webcontainer/1.0.0',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Host': hostname
        },
        cache: 'no-cache',
        mode: 'cors',
        credentials: 'omit',
        family: 4 // Force IPv4
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
    
    logger.warn('⚠️ Supabase connectivity check failed (WebContainer network issue):', {
      error: error.message,
      hostname,
      url: supabaseUrl,
      isTimeout: error.message?.includes('timeout'),
      isNetworkError: error.message?.includes('fetch failed'),
      isSocketError: error.cause?.code === 'UND_ERR_SOCKET',
      isLocalhostRouting,
      remoteAddress: error.cause?.socket?.remoteAddress
    });
    
    return {
      connected: false,
      latency: null,
      error: error.message,
      hostname,
      isLocalhostRouting
    };
  }
}