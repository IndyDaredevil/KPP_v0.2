import type { 
  ApiResponse,
  User,
  LoginRequest,
  RegisterRequest,
  Token,
  Listing,
  ListingsFilters,
  ListingsResponse,
  HistoricalListing,
  KaspaCompletedOrder,
  SalesFilters,
  AllSalesHistoryResponse
} from '../types/api';

// Use environment variable for API base URL
// For local development connecting to Railway: use VITE_API_BASE_URL
// For production (Netlify): should be empty to use relative URLs with proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

console.log('API Configuration:', {
  mode: import.meta.env.MODE,
  apiBaseUrl: API_BASE_URL,
  hasApiBaseUrl: !!import.meta.env.VITE_API_BASE_URL
});

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('supabase_token');
};

// Helper function to create headers with auth token
const createHeaders = (includeAuth = true, explicitToken?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (includeAuth) {
    const token = explicitToken || getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
};

// Generic API request function with timeout handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log('Making API request:', {
    url,
    method: options.method || 'GET',
    hasAuth: !!(options.headers as Record<string, string>)?.['Authorization']
  });
  
  // Create AbortController for timeout handling
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | undefined;
  
  try {
    // Set up timeout - increased to 30 seconds to accommodate network latency
    // and backend processing delays
    timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);

    const config: RequestInit = {
      ...options,
      signal: controller.signal,
      headers: {
        ...createHeaders(),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);
    
    console.log('API response:', {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Handle different types of errors
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(`API request timeout for ${endpoint} after 30 seconds`);
        throw new Error('Request timeout. The server is taking too long to respond. Please try again.');
      }
      
      if (error.message === 'Failed to fetch') {
        console.error(`Network error for ${endpoint}:`, error);
        throw new Error('Network error. Please check your internet connection and try again.');
      }
    }
    
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  } finally {
    // Always clear the timeout to prevent memory leaks
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

// API functions
export const api = {
  // Health check
  health: (): Promise<ApiResponse> => 
    apiRequest('/api/health', { headers: createHeaders(false) }),

  // Authentication
  login: (credentials: LoginRequest): Promise<ApiResponse<{ user: User; session: any }>> =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
      headers: createHeaders(false),
    }),

  register: (userData: RegisterRequest): Promise<ApiResponse<{ user: User }>> =>
    apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
      headers: createHeaders(false),
    }),

  logout: (): Promise<ApiResponse> =>
    apiRequest('/api/auth/logout', { method: 'POST' }),

  getCurrentUser: (token?: string): Promise<ApiResponse<{ user: User }>> => {
    // Use explicit token if provided, otherwise check localStorage
    const authToken = token || getAuthToken();
    if (!authToken) {
      return Promise.reject(new Error('No authentication token available'));
    }
    return apiRequest('/api/auth/me', {
      headers: createHeaders(true, authToken)
    });
  },

  // Unified Listings API - Updated to work with the unified listings table
  getListings: (filters: ListingsFilters = {}): Promise<ListingsResponse> => {
    const queryParams = new URLSearchParams();
    
    if (filters.page) queryParams.append('page', filters.page.toString());
    if (filters.limit) queryParams.append('limit', filters.limit.toString());
    if (filters.ticker) queryParams.append('ticker', filters.ticker);
    if (filters.token_id !== undefined) queryParams.append('token_id', filters.token_id.toString());
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
    
    // Default to active listings if no status specified
    const status = filters.status || 'active';
    if (Array.isArray(status)) {
      status.forEach(s => queryParams.append('status', s));
    } else {
      queryParams.append('status', status);
    }

    const queryString = queryParams.toString();
    const endpoint = `/api/listings${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest<{ listings: Listing[]; pagination: any }>(endpoint).then(response => ({
      success: response.success,
      data: response.data!
    }));
  },

  getListing: (id: number): Promise<ApiResponse<{ listing: Listing }>> =>
    apiRequest(`/api/listings/${id}`),

  getHistoricalListings: (filters: ListingsFilters = {}): Promise<ApiResponse<{ listings: HistoricalListing[]; pagination: any }>> => {
    const queryParams = new URLSearchParams();
    
    if (filters.page) queryParams.append('page', filters.page.toString());
    if (filters.limit) queryParams.append('limit', filters.limit.toString());
    if (filters.ticker) queryParams.append('ticker', filters.ticker);
    if (filters.token_id !== undefined) queryParams.append('token_id', filters.token_id.toString());
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
    
    // Add status filter for historical listings if specified
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        filters.status.forEach(s => queryParams.append('status', s));
      } else {
        queryParams.append('status', filters.status);
      }
    }

    const queryString = queryParams.toString();
    const endpoint = `/api/listings/historical${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest(endpoint);
  },

  getSalesHistory: (tokenId: number, filters: ListingsFilters = {}): Promise<ApiResponse<{ listings: KaspaCompletedOrder[]; pagination: any }>> => {
    const queryParams = new URLSearchParams();
    
    if (filters.page) queryParams.append('page', filters.page.toString());
    if (filters.limit) queryParams.append('limit', filters.limit.toString());
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

    const queryString = queryParams.toString();
    const endpoint = `/api/listings/sales-history/${tokenId}${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest(endpoint);
  },

  // New API function for all sales history - Fixed endpoint path
  getAllSalesHistory: (filters: SalesFilters = {}): Promise<AllSalesHistoryResponse> => {
    const queryParams = new URLSearchParams();
    
    if (filters.page) queryParams.append('page', filters.page.toString());
    if (filters.limit) queryParams.append('limit', filters.limit.toString());
    if (filters.ticker) queryParams.append('ticker', filters.ticker);
    if (filters.token_id !== undefined) queryParams.append('token_id', filters.token_id.toString());
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

    const queryString = queryParams.toString();
    const endpoint = `/api/listings/sales-history${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest(endpoint);
  },

  // Tokens
  getTokens: (): Promise<ApiResponse<Token[]>> =>
    apiRequest('/api/tokens'),

  getToken: (tokenId: number): Promise<ApiResponse<Token>> =>
    apiRequest(`/api/tokens/${tokenId}`),
};