import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { 
  ListingsFilters,
  SalesFilters
} from '../types/api';

// Get all listings (active by default, but can filter by status)
export const useListings = (filters: ListingsFilters = {}) => {
  // Default to active listings if no status specified
  const filtersWithDefaults = {
    ...filters,
    status: filters.status || 'active'
  };

  return useQuery({
    queryKey: ['listings', filtersWithDefaults],
    queryFn: () => api.getListings(filtersWithDefaults),
    staleTime: 90000, // 15 minutes
    refetchOnWindowFocus: true,
  });
};

// Get single listing
export const useListing = (id: number) => {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: () => api.getListing(id),
    enabled: !!id,
    staleTime: 60000, // 1 minute
  });
};

// Get historical listings (non-active status)
export const useHistoricalListings = (filters: ListingsFilters = {}) => {
  return useQuery({
    queryKey: ['historical-listings', filters],
    queryFn: () => api.getHistoricalListings(filters),
    staleTime: 60000, // 1 minute
  });
};

// Get sales history for a specific token
export const useSalesHistory = (tokenId: number, filters: ListingsFilters = {}) => {
  return useQuery({
    queryKey: ['sales-history', tokenId, filters],
    queryFn: () => api.getSalesHistory(tokenId, filters),
    enabled: !!tokenId,
    staleTime: 300000, // 5 minutes - sales history doesn't change frequently
    refetchOnWindowFocus: false, // Don't refetch on window focus for historical data
  });
};

// Get all sales history
export const useAllSalesHistory = (filters: SalesFilters = {}) => {
  return useQuery({
    queryKey: ['all-sales-history', filters],
    queryFn: () => api.getAllSalesHistory(filters),
    staleTime: 300000, // 5 minutes - sales history doesn't change frequently
    refetchOnWindowFocus: false, // Don't refetch on window focus for historical data
  });
};

// Hook for filtering and sorting
export const useListingsFilters = () => {
  const queryClient = useQueryClient();

  const invalidateListings = () => {
    queryClient.invalidateQueries({ queryKey: ['listings'] });
  };

  const prefetchListing = (id: number) => {
    queryClient.prefetchQuery({
      queryKey: ['listing', id],
      queryFn: () => api.getListing(id),
      staleTime: 60000, // 1 minute
    });
  };

  const invalidateSalesHistory = (tokenId?: number) => {
    if (tokenId) {
      queryClient.invalidateQueries({ queryKey: ['sales-history', tokenId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['sales-history'] });
      queryClient.invalidateQueries({ queryKey: ['all-sales-history'] });
    }
  };

  return {
    invalidateListings,
    prefetchListing,
    invalidateSalesHistory,
  };
};

// Helper hooks for specific listing types
export const useActiveListings = (filters: Omit<ListingsFilters, 'status'> = {}) => {
  return useListings({ ...filters, status: 'active' });
};

export const useSoldListings = (filters: Omit<ListingsFilters, 'status'> = {}) => {
  return useListings({ ...filters, status: 'sold' });
};

export const useCancelledListings = (filters: Omit<ListingsFilters, 'status'> = {}) => {
  return useListings({ ...filters, status: 'cancelled' });
};

// Custom hook for real-time data with polling
export const useListingsWithPolling = (filters: ListingsFilters = {}, enabled = true) => {
  const filtersWithDefaults = {
    ...filters,
    status: filters.status || 'active'
  };

  return useQuery({
    queryKey: ['listings', filtersWithDefaults],
    queryFn: () => api.getListings(filtersWithDefaults),
    refetchInterval: enabled ? 30000 : false, // Poll every 30 seconds when enabled
    refetchIntervalInBackground: false,
    staleTime: 10000, // 10 seconds
    enabled,
  });
};