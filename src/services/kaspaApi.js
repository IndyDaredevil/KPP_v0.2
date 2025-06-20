import axios from 'axios';
import { logger } from '../utils/logger.js';

const ticker = 'KASPUNKS';
// Use the correct API endpoints
const KASPA_API_ORDERS = process.env.KRC721_API_ORDER_URL || 'https://api.kaspa.com/krc721-orders/listed-orders';
const KASPA_API_TOKENS = process.env.KRC721_API_TOKEN_URL || 'https://api.kaspa.com/api/krc721/tokens';
const KASPA_API_KRC721 = 'https://api.kaspa.com/krc721';

class KaspaService {
  constructor() {
    this.client = axios.create({
      baseURL: KASPA_API_ORDERS,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'KasPunk Predictor/1.0.0'
      }
    });

    this.tokenClient = axios.create({
      baseURL: KASPA_API_TOKENS,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'KasPunk Predictor/1.0.0'
      }
    });

    this.krc721Client = axios.create({
      baseURL: KASPA_API_KRC721,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'KasPunk Predictor/1.0.0'
      }
    });

    // Add request/response interceptors for logging for orders client
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Kaspa API Orders Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
          url: `${config.baseURL}${config.url}`,
          method: config.method?.toUpperCase(),
          headers: config.headers,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('Kaspa API Orders Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Kaspa API Orders Response: ${response.status} ${response.config.url}`, {
          status: response.status,
          url: response.config.url,
          dataLength: response.data ? JSON.stringify(response.data).length : 0
        });
        return response;
      },
      (error) => {
        logger.error('Kaspa API Orders Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          message: error.message,
          baseURL: error.config?.baseURL
        });
        return Promise.reject(error);
      }
    );

    // Add request/response interceptors for logging for tokens client
    this.tokenClient.interceptors.request.use(
      (config) => {
        logger.debug(`Kaspa API Tokens Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
          url: `${config.baseURL}${config.url}`,
          method: config.method?.toUpperCase(),
          headers: config.headers,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('Kaspa API Tokens Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.tokenClient.interceptors.response.use(
      (response) => {
        logger.debug(`Kaspa API Tokens Response: ${response.status} ${response.config.url}`, {
          status: response.status,
          url: response.config.url,
          dataLength: response.data ? JSON.stringify(response.data).length : 0
        });
        return response;
      },
      (error) => {
        logger.error('Kaspa API Tokens Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          message: error.message,
          baseURL: error.config?.baseURL
        });
        return Promise.reject(error);
      }
    );

    // Add request/response interceptors for logging for KRC721 client
    this.krc721Client.interceptors.request.use(
      (config) => {
        logger.debug(`Kaspa API KRC721 Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
          url: `${config.baseURL}${config.url}`,
          method: config.method?.toUpperCase(),
          headers: config.headers,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('Kaspa API KRC721 Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.krc721Client.interceptors.response.use(
      (response) => {
        logger.debug(`Kaspa API KRC721 Response: ${response.status} ${response.config.url}`, {
          status: response.status,
          url: response.config.url,
          dataLength: response.data ? JSON.stringify(response.data).length : 0
        });
        return response;
      },
      (error) => {
        logger.error('Kaspa API KRC721 Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          message: error.message,
          baseURL: error.config?.baseURL
        });
        return Promise.reject(error);
      }
    );
  }

  // Helper method to implement retry logic for API calls
  async retryApiCall(apiCall, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        
        // Check if it's a retryable error
        const shouldRetry = this.isRetryableError(error);
        
        if (!shouldRetry || attempt === maxRetries) {
          // Don't retry for non-retryable errors or if we've exhausted retries
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        
        logger.warn(`API call failed with ${error.response?.status || error.code || error.message}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`, {
          status: error.response?.status,
          code: error.code,
          message: error.message,
          attempt,
          maxRetries,
          delay
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never be reached, but just in case
    throw lastError;
  }

  // Helper method to determine if an error should be retried
  isRetryableError(error) {
    // HTTP 500-level errors should be retried
    if (error.response?.status >= 500 && error.response?.status < 600) {
      return true;
    }
    
    // Network-level errors that should be retried
    const retryableNetworkErrors = [
      'ECONNRESET',     // Connection reset by peer
      'ENOTFOUND',      // DNS lookup failed
      'ECONNREFUSED',   // Connection refused
      'ETIMEDOUT',      // Request timeout
      'ECONNABORTED',   // Connection aborted
      'EPIPE',          // Broken pipe
      'socket hang up'  // Socket hang up
    ];
    
    // Check error code
    if (error.code && retryableNetworkErrors.includes(error.code)) {
      return true;
    }
    
    // Check error message for socket hang up
    if (error.message && error.message.includes('socket hang up')) {
      return true;
    }
    
    // Check if it's a timeout error
    if (error.message && error.message.includes('timeout')) {
      return true;
    }
    
    return false;
  }

  // FIXED: Use the correct token API endpoint for trait fetching
  async fetchTokenTraits(ticker, tokenId) {
    try {
      // Ensure tokenId is a number
      const numericTokenId = parseInt(tokenId);
      if (isNaN(numericTokenId)) {
        throw new Error(`Invalid token ID: ${tokenId}`);
      }

      const requestData = {
        ticker: ticker,
        tokenIds: [numericTokenId] // API expects array of numbers
      };
      
      logger.debug(`Fetching traits for ${ticker} token ${numericTokenId} from ${this.tokenClient.defaults.baseURL}`);

      const response = await this.retryApiCall(async () => {
        return await this.tokenClient.post('/', requestData);
      }, 2, 500); // Faster retry for trait API

      if (!response.data || !response.data.items || response.data.items.length === 0) {
        logger.debug(`No trait data found for ${ticker} token ${numericTokenId}`);
        return null;
      }

      const tokenData = response.data.items[0];
      const traitCount = Object.keys(tokenData.traits || {}).length;
      logger.debug(`Found trait data for ${ticker} token ${numericTokenId}: ${traitCount} traits`);
      
      return tokenData;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.debug(`Token ${tokenId} not found in trait API`);
        return null;
      }
      
      logger.error(`Failed to fetch traits for ${ticker} token ${tokenId}:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        data: error.response?.data
      });
      throw new Error(`Failed to fetch token traits: ${error.message}`);
    }
  }

  // New method to fetch Kaspunk owners
  async fetchKaspunkOwners() {
    try {
      logger.info(`Fetching Kaspunk owners from ${this.krc721Client.defaults.baseURL}/KASPUNKS`);

      const response = await this.retryApiCall(async () => {
        return await this.krc721Client.get('/KASPUNKS');
      }, 3, 1000);

      if (!response.data || !response.data.holders) {
        logger.warn('No holders data found in Kaspunk owners API response');
        return { holders: [], totalHolders: 0, totalMinted: 0 };
      }

      const { holders, totalHolders, totalMinted } = response.data;
      
      logger.info(`Successfully fetched ${holders.length} Kaspunk owners (API reports ${totalHolders} total holders)`);
      
      return { 
        holders, 
        totalHolders, 
        totalMinted,
        totalSupply: response.data.totalSupply || 1000
      };
    } catch (error) {
      logger.error('Failed to fetch Kaspunk owners:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        data: error.response?.data
      });
      
      throw new Error(`Failed to fetch Kaspunk owners: ${error.message}`);
    }
  }

  async fetchCompletedOrdersForToken(ticker, tokenId, options = {}) {
    const {
      offset = 0,
      limit = 25,
      sortField = 'totalPrice',
      sortDirection = 'asc'
    } = options;

    try {
      // Ensure tokenId is a number
      const numericTokenId = parseInt(tokenId);
      if (isNaN(numericTokenId)) {
        throw new Error(`Invalid token ID: ${tokenId}`);
      }

      const requestData = {
        pagination: { offset, limit },
        sort: { field: sortField, direction: sortDirection },
        completedOrders: true,
        tokenId: numericTokenId.toString()
      };

      logger.debug(`Fetching completed orders for ${ticker} token ${numericTokenId}`, {
        ticker,
        tokenId: numericTokenId,
        requestData
      });

      const response = await this.retryApiCall(async () => {
        return await this.client.post(`/${ticker}`, requestData);
      });

      if (!response.data.success) {
        throw new Error(`Kaspa API returned error: ${JSON.stringify(response.data)}`);
      }

      logger.debug(`Found ${response.data.orders?.length || 0} completed orders for token ${numericTokenId}`, {
        ticker,
        tokenId: numericTokenId,
        totalCount: response.data.totalCount
      });

      return {
        orders: response.data.orders || [],
        totalCount: response.data.totalCount || 0
      };
    } catch (error) {
      // If it's a 404 or similar, the token might not have any completed orders
      if (error.response?.status === 404 || error.response?.status === 400) {
        logger.debug(`No completed orders found for ${ticker} token ${tokenId}`);
        return { orders: [], totalCount: 0 };
      }
      
      logger.error(`Failed to fetch completed orders for ${ticker} token ${tokenId}:`, error);
      throw new Error(`Failed to fetch Kaspa sales history: ${error.message}`);
    }
  }

  async fetchListedOrdersForToken(ticker, tokenId) {
    try {
      // Ensure tokenId is a number
      const numericTokenId = parseInt(tokenId);
      if (isNaN(numericTokenId)) {
        throw new Error(`Invalid token ID: ${tokenId}`);
      }

      const requestData = {
        pagination: { offset: 0, limit: 1 },
        sort: { field: 'totalPrice', direction: 'asc' },
        tokenId: numericTokenId.toString()
      };

      const response = await this.retryApiCall(async () => {
        return await this.client.post(`/${ticker}`, requestData);
      });

      if (!response.data.success) {
        throw new Error(`Kaspa API Order returned error: ${JSON.stringify(response.data)}`);
      }

      return {
        orders: response.data.orders || [],
        totalCount: response.data.totalCount || 0
      };
    } catch (error) {
      // If it's a 404 or similar, the token might not be listed
      if (error.response?.status === 404 || error.response?.status === 400) {
        logger.debug(`No listing found for ${ticker} token ${tokenId}`);
        return { orders: [], totalCount: 0 };
      }
      
      logger.error(`Failed to fetch listed order for ${ticker} token ${tokenId}:`, error);
      throw new Error(`Failed to fetch Kaspa listing: ${error.message}`);
    }
  }

  // DEPRECATED: Keep for backward compatibility but use fetchTokenTraits instead
  async fetchTokenDetailsFromApi(ticker, tokenId) {
    logger.debug('fetchTokenDetailsFromApi is deprecated, use fetchTokenTraits instead');
    return await this.fetchTokenTraits(ticker, tokenId);
  }

  async fetchListedOrders(ticker, options = {}) {
    const {
      offset = 0,
      limit = 25,
      sortField = 'totalPrice',
      sortDirection = 'asc',
      tokenId = null
    } = options;

    try {
      const requestData = {
        pagination: { offset, limit },
        sort: { field: sortField, direction: sortDirection }
      };

      if (tokenId) {
        // Ensure tokenId is a number
        const numericTokenId = parseInt(tokenId);
        if (isNaN(numericTokenId)) {
          throw new Error(`Invalid token ID: ${tokenId}`);
        }
        requestData.tokenId = numericTokenId.toString();
      }

      logger.debug(`Fetching listed orders for ${ticker}`, {
        ticker,
        offset,
        limit,
        sortField,
        sortDirection,
        tokenId: tokenId || 'all',
        requestUrl: `${this.client.defaults.baseURL}/${ticker}`,
        requestData
      });

      const response = await this.retryApiCall(async () => {
        return await this.client.post(`/${ticker}`, requestData);
      });

      if (!response.data.success) {
        throw new Error(`Kaspa API returned error: ${JSON.stringify(response.data)}`);
      }

      logger.debug(`Kaspa API returned ${response.data.orders?.length || 0} orders for ${ticker}`, {
        ticker,
        ordersReceived: response.data.orders?.length || 0,
        totalCount: response.data.totalCount || 0,
        offset,
        limit
      });

      return {
        orders: response.data.orders || [],
        totalCount: response.data.totalCount || 0
      };
    } catch (error) {
      logger.error(`Failed to fetch listed orders for ${ticker}:`, {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        data: error.response?.data
      });
      
      // Provide more specific error information
      if (error.response?.status === 404) {
        throw new Error(`Kaspa API endpoint not found. Check if the API URL is correct: ${this.client.defaults.baseURL}/${ticker}`);
      } else if (error.response?.status === 400) {
        throw new Error(`Bad request to Kaspa API. Check request format for ticker: ${ticker}`);
      } else if (error.code === 'ENOTFOUND') {
        throw new Error(`Cannot reach Kaspa API server. Check network connection and API URL: ${this.client.defaults.baseURL}`);
      }
      
      throw new Error(`Failed to fetch Kaspa listings: ${error.message}`);
    }
  }
}

export const kaspaApi = new KaspaService();