// Database types based on unified schema
export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface Token {
  token_id: number;
  rarity_rank?: number;
  is_legendary?: boolean;
  created_at?: string;
  updated_at?: string;
  mint_implied_value?: number;
  trait_count?: number;
  rarest_rarity?: number;
}

export interface TraitCategory {
  id: string;
  name: string;
  display_order: number;
  created_at?: string;
}

export interface TraitData {
  id: string;
  token_id: number;
  trait_name: string;
  trait_value: string;
  rarity: number;
  created_at?: string;
  category_id?: string;
  updated_at?: string;
}

// Unified Listing interface with expanded status types
export interface Listing {
  id: string;
  kaspa_order_id?: string;
  ticker: string;
  token_id: number;
  total_price: number;
  seller_wallet_address: string;
  rarity_rank?: number;
  required_kaspa?: number;
  kaspa_created_at?: string;
  source?: 'manual' | 'kaspa_api';
  is_owner?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  
  // NEW: Image URL field from the backend
  image_url?: string | null;
  
  // Expanded status field to include history-preserving statuses
  status: 'active' | 'sold' | 'cancelled' | 'expired' | 'manually_removed' | 'api_sync_removed' | 'price_changed' | 'manually_updated' | 'unknown';
  
  // Historical tracking fields (only populated for non-active listings)
  deactivated_at?: string;
  deactivated_by?: string;
}

// Helper type for active listings
export type ActiveListing = Listing & { status: 'active' };

// Helper type for historical listings (now includes price_changed and manually_updated)
export type HistoricalListing = Listing & { 
  status: Exclude<Listing['status'], 'active'>;
  deactivated_at: string;
  deactivated_by?: string;
};

// Sales History Types
export interface SalesRecord {
  id: string;
  token_id: number;
  sale_price: number;
  sale_date: string;
  created_at: string;
  image_url?: string | null; // NEW: Add image URL field
}

// Kaspa API Types
export interface KaspaTrait {
  value: string | null;
  rarity: number;
}

export interface KaspaTokenTraits {
  type?: KaspaTrait;
  head?: KaspaTrait;
  eyes?: KaspaTrait;
  mouth?: KaspaTrait;
  acc1?: KaspaTrait;
  acc2?: KaspaTrait;
  // Add other traits as needed
}

export interface KaspaTokenItem {
  _id: string;
  ticker: string;
  tokenId: number; // Kaspa API returns number for tokenId
  traits: KaspaTokenTraits;
  rarityRank: number;
  legendary: boolean;
  id: string;
}

export interface KaspaTokenApiResponse {
  items: KaspaTokenItem[];
  totalCount: number;
}

// Kaspa Completed Order Types
export interface KaspaCompletedOrder {
  id: string;
  createdAt: string;
  isOwner: boolean;
  ticker: string;
  tokenId: string;
  totalPrice: number;
  sellerWalletAddress: string;
  rarityRank: number;
  requiredKaspa: number;
  fullfillmentTimestamp: number; // Unix timestamp in milliseconds
}

// Generic API Response interface
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

// API Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    session?: {
      access_token: string;
      refresh_token: string;
      expires_at?: number;
    };
  };
}

export interface ListingsResponse {
  success: boolean;
  data: {
    listings: Listing[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface ListingResponse {
  success: boolean;
  data: {
    listing: Listing;
  };
}

export interface HistoricalListingsResponse {
  success: boolean;
  data: {
    listings: HistoricalListing[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface SalesHistoryResponse {
  success: boolean;
  data: {
    listings: KaspaCompletedOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface AllSalesHistoryResponse {
  success: boolean;
  data?: {
    sales: SalesRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

export interface ListingsFilters {
  page?: number;
  limit?: number;
  ticker?: string;
  token_id?: number;
  status?: Listing['status'] | Listing['status'][];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SalesFilters {
  page?: number;
  limit?: number;
  ticker?: string;
  token_id?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface HealthResponse {
  success: boolean;
  message: string;
  timestamp: string;
  environment: string;
  kaspaSyncEnabled: boolean;
}

// Dummy export to prevent empty module after transpilation
export const __type_marker = true;