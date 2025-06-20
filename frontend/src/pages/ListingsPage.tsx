import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useListings } from '../hooks/useListings';
import { useCountdown } from '../hooks/useCountdown';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { formatPrice, formatDate, formatTime, formatTimeAgo, truncateAddress, debounce } from '../lib/utils';
import type { Listing, ListingsFilters } from '../types/api';

const ListingsPage: React.FC = () => {
  const [filters, setFilters] = useState<ListingsFilters>({
    page: 1,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'desc',
    status: 'active' // Only show active listings
  });
  const [searchTokenId, setSearchTokenId] = useState<number | ''>('');
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [syncInProgressCounter, setSyncInProgressCounter] = useState(0);

  // Debounced search to avoid too many API calls
  const debouncedSearch = useMemo(
    () => debounce((tokenId: number | '') => {
      setFilters(prev => ({
        ...prev,
        token_id: tokenId || undefined,
        page: 1
      }));
    }, 500),
    []
  );

  React.useEffect(() => {
    debouncedSearch(searchTokenId);
  }, [searchTokenId, debouncedSearch]);

  const { data: listingsData, isLoading, error, refetch, dataUpdatedAt } = useListings(filters);

  // Update last updated timestamp when data changes
  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdated(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  // Countdown timer for next refresh (15 minutes to match the staleTime)
  const { timeLeft, reset: resetTimer, start: startTimer, pause: pauseTimer } = useCountdown({
    initialTime: 900,
    onComplete: () => {
      // Timer completed, trigger refetch and reset
      refetch().then(() => {
        resetTimer();
        startTimer();
      });
    }
  });

  // Reset and start timer when data is refetched
  useEffect(() => {
    if (dataUpdatedAt) {
      resetTimer();
      startTimer();
    }
  }, [dataUpdatedAt, resetTimer, startTimer]);

  // Handle loading state for timer
  useEffect(() => {
    if (isLoading) {
      pauseTimer();
    } else if (!isLoading && timeLeft > 0) {
      startTimer();
    }
  }, [isLoading, pauseTimer, startTimer, timeLeft]);

  // Sync in progress counter
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isLoading) {
      // Start counting when sync begins
      setSyncInProgressCounter(0);
      interval = setInterval(() => {
        setSyncInProgressCounter(prev => prev + 1);
      }, 1000);
    } else {
      // Reset counter when sync completes
      setSyncInProgressCounter(0);
      if (interval) {
        clearInterval(interval);
      }
    }

    // Cleanup interval on unmount or when isLoading changes
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLoading]);

  const listings = listingsData?.data?.listings || [];
  const pagination = listingsData?.data?.pagination;

  const handleSortChange = (sortBy: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters(prev => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const handleSelectListing = (listingId: string) => {
    setSelectedListings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(listingId)) {
        newSet.delete(listingId);
      } else {
        newSet.add(listingId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedListings.size === listings.length) {
      setSelectedListings(new Set());
    } else {
      setSelectedListings(new Set(listings.map(l => l.id)));
    }
  };

  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <button
      onClick={() => handleSortChange(field)}
      className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
    >
      <span>{children}</span>
      {filters.sortBy === field && (
        <span className="text-primary-600">
          {filters.sortOrder === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );

  const ListingRow = ({ listing }: { listing: Listing }) => (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
      selectedListings.has(listing.id) ? 'bg-blue-50' : ''
    }`}>
      <td className="py-3 px-4">
        <input
          type="checkbox"
          checked={selectedListings.has(listing.id)}
          onChange={() => handleSelectListing(listing.id)}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center space-x-3">
          {listing.image_url ? (
            <img 
              src={listing.image_url} 
              alt={`${listing.ticker} #${listing.token_id}`}
              className="w-10 h-10 rounded-lg object-cover"
              onError={(e) => {
                // Fallback to placeholder if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const placeholder = target.nextElementSibling as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div className={`w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center ${listing.image_url ? 'hidden' : ''}`}>
            <span className="text-white font-bold text-sm">{listing.ticker.slice(0, 2)}</span>
          </div>
          <div>
            <div className="font-medium text-gray-900">{listing.ticker}</div>
            <div className="text-sm text-gray-500">Token #{listing.token_id}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm font-medium text-gray-900">
          {formatPrice(Number(listing.total_price))}
        </div>
        {listing.required_kaspa && (
          <div className="text-xs text-gray-500">
            {Number(listing.required_kaspa).toLocaleString()} KAS
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        {listing.rarity_rank ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            #{listing.rarity_rank}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-gray-900">
          {truncateAddress(listing.seller_wallet_address)}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-gray-500">
          {formatDate(listing.created_at || '')}
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          listing.source === 'kaspa_api' 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-green-100 text-green-800'
        }`}>
          {listing.source === 'kaspa_api' ? 'API' : 'Manual'}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center space-x-2">
          <Link to={`/listings/${listing.token_id}/sales-history`}>
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-purple-600 hover:text-purple-700 hover:border-purple-300"
            >
              Sales History
            </Button>
          </Link>
        </div>
      </td>
    </tr>
  );

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Listings</h3>
          <p className="text-red-600 mb-4">
            Failed to load listings data. Please try refreshing the page.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Active Listings</h1>
          <p className="text-gray-600 mt-1">
            Browse and monitor all active NFT listings
          </p>
          
          {/* Live Timer and Last Updated */}
          <div className="flex items-center space-x-6 mt-3 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500' : 'bg-green-500'} ${isLoading ? 'animate-pulse' : ''}`}></div>
              <span>
                {isLoading ? (
                  `In progress (${syncInProgressCounter}s)`
                ) : (
                  <>Next update in: <span className="font-mono font-medium">{formatTime(timeLeft)}</span></>
                )}
              </span>
            </div>
            {lastUpdated && (
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Last updated: {formatTimeAgo(lastUpdated)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
          <CardDescription>
            Filter and search through the listings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Input
                label="Search by Token ID"
                placeholder="e.g., 123"
                type="number"
                value={searchTokenId === '' ? '' : searchTokenId}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTokenId(value === '' ? '' : parseInt(value) || '');
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Items per page
              </label>
              <select
                value={filters.limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="input"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTokenId('');
                  setFilters({
                    page: 1,
                    limit: 20,
                    sortBy: 'created_at',
                    sortOrder: 'desc',
                    status: 'active'
                  });
                }}
              >
                Clear Filters
              </Button>
            </div>
            <div className="flex items-end justify-end">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listings Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>
                Listings ({pagination?.total?.toLocaleString() || 0})
              </CardTitle>
              <CardDescription>
                {selectedListings.size > 0 && (
                  <span className="text-primary-600">
                    {selectedListings.size} selected
                  </span>
                )}
              </CardDescription>
            </div>
            {selectedListings.size > 0 && (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedListings(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3 text-gray-600">Loading listings...</span>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTokenId ? 'No Matching Listings' : 'No Active Listings'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTokenId 
                  ? `No listings found for token "${searchTokenId}". Try adjusting your search.`
                  : 'No active NFT listings found in the marketplace'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectedListings.size === listings.length && listings.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="ticker">NFT</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="total_price">Price</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="rarity_rank">Rarity</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="seller_wallet_address">Seller</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="created_at">Listed</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="source">Source</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {listings.map((listing) => (
                    <ListingRow key={listing.id} listing={listing} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isLoading}
                >
                  Previous
                </Button>
                
                {/* Page numbers */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, pagination.page - 2) + i;
                    if (pageNum > pagination.totalPages) return null;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isLoading}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          pageNum === pagination.page
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ListingsPage;