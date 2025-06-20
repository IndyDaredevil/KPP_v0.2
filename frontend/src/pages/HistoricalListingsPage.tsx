import React, { useState, useMemo } from 'react';
import { useHistoricalListings } from '../hooks/useListings';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { formatPrice, formatDate, truncateAddress, debounce } from '../lib/utils';
import type { HistoricalListing, ListingsFilters, Listing } from '../types/api';

const HistoricalListingsPage: React.FC = () => {
  const [filters, setFilters] = useState<ListingsFilters>({
    page: 1,
    limit: 20,
    sortBy: 'deactivated_at',
    sortOrder: 'desc'
  });
  const [searchTokenId, setSearchTokenId] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<Listing['status'] | ''>('');

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

  // Update status filter
  React.useEffect(() => {
    setFilters(prev => ({
      ...prev,
      status: statusFilter || undefined,
      page: 1
    }));
  }, [statusFilter]);

  const { data: historicalData, isLoading, error, refetch } = useHistoricalListings(filters);

  const listings = historicalData?.data?.listings || [];
  const pagination = historicalData?.data?.pagination;

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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      sold: { color: 'bg-green-100 text-green-800', icon: '💰', label: 'Sold' },
      cancelled: { color: 'bg-yellow-100 text-yellow-800', icon: '❌', label: 'Cancelled' },
      expired: { color: 'bg-gray-100 text-gray-800', icon: '⏰', label: 'Expired' },
      manually_removed: { color: 'bg-red-100 text-red-800', icon: '🗑️', label: 'Manually Removed' },
      api_sync_removed: { color: 'bg-blue-100 text-blue-800', icon: '🔄', label: 'API Sync Removed' },
      price_changed: { color: 'bg-purple-100 text-purple-800', icon: '💱', label: 'Price Changed' },
      manually_updated: { color: 'bg-orange-100 text-orange-800', icon: '✏️', label: 'Manually Updated' },
      unknown: { color: 'bg-gray-100 text-gray-600', icon: '❓', label: 'Unknown' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </span>
    );
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

  const HistoricalListingRow = ({ listing }: { listing: HistoricalListing }) => (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
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
          <div className={`w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-700 rounded-lg flex items-center justify-center ${listing.image_url ? 'hidden' : ''}`}>
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
          {listing.created_at ? formatDate(listing.created_at) : '-'}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-gray-500">
          {formatDate(listing.deactivated_at || '')}
        </div>
      </td>
      <td className="py-3 px-4">
        {getStatusBadge(listing.status)}
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
    </tr>
  );

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalValue = listings.reduce((sum: number, listing: HistoricalListing) => sum + Number(listing.total_price), 0);
    const soldListings = listings.filter((l: HistoricalListing) => l.status === 'sold');
    const cancelledListings = listings.filter((l: HistoricalListing) => l.status === 'cancelled');
    const priceChangedListings = listings.filter((l: HistoricalListing) => l.status === 'price_changed');
    const manuallyUpdatedListings = listings.filter((l: HistoricalListing) => l.status === 'manually_updated');
    
    return {
      total: listings.length,
      totalValue,
      sold: soldListings.length,
      cancelled: cancelledListings.length,
      priceChanged: priceChangedListings.length,
      manuallyUpdated: manuallyUpdatedListings.length,
      averagePrice: listings.length > 0 ? totalValue / listings.length : 0
    };
  }, [listings]);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Historical Data</h3>
          <p className="text-red-600 mb-4">
            Failed to load historical listings data. Please try refreshing the page.
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Historical Listings</h1>
          <p className="text-gray-600 mt-1">
            Review past NFT listings and marketplace activity with full change history
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Listings</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">All historical records</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Value</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatPrice(stats.totalValue)}</div>
            <p className="text-xs text-gray-500 mt-1">Combined listing value</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Sold</CardTitle>
            <span className="text-2xl">✅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.sold.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Successfully sold</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Cancelled</CardTitle>
            <span className="text-2xl">❌</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.cancelled.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Cancelled by seller</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Price Changed</CardTitle>
            <span className="text-2xl">💱</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.priceChanged.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Price/detail changes</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg. Price</CardTitle>
            <span className="text-2xl">📈</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatPrice(stats.averagePrice)}</div>
            <p className="text-xs text-gray-500 mt-1">Average listing price</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
          <CardDescription>
            Filter and search through historical listings with full change history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Listing['status'] | '')}
                className="input"
              >
                <option value="">All Statuses</option>
                <option value="sold">Sold</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
                <option value="manually_removed">Manually Removed</option>
                <option value="api_sync_removed">API Sync Removed</option>
                <option value="price_changed">Price Changed</option>
                <option value="manually_updated">Manually Updated</option>
                <option value="unknown">Unknown</option>
              </select>
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
                  setStatusFilter('');
                  setFilters({
                    page: 1,
                    limit: 20,
                    sortBy: 'deactivated_at',
                    sortOrder: 'desc'
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

      {/* Historical Listings Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>
                Historical Listings ({pagination?.total?.toLocaleString() || 0})
              </CardTitle>
              <CardDescription>
                Past NFT listings with complete change history and deactivation details
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3 text-gray-600">Loading historical data...</span>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTokenId || statusFilter ? 'No Matching Records' : 'No Historical Data'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTokenId || statusFilter
                  ? 'No historical listings match your current filters. Try adjusting your search criteria.'
                  : 'No historical listings found. Historical data will appear here once listings are deactivated.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
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
                      <SortButton field="deactivated_at">Deactivated</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="status">Status</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="source">Source</SortButton>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {listings.map((listing: HistoricalListing) => (
                    <HistoricalListingRow key={listing.id} listing={listing} />
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

export default HistoricalListingsPage;