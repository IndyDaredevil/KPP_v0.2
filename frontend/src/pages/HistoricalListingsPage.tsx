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
      sold: { color: 'bg-kaspa-secondary-green/20 text-kaspa-secondary-green border-kaspa-secondary-green/30', icon: '💰', label: 'Sold' },
      cancelled: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '❌', label: 'Cancelled' },
      expired: { color: 'bg-kaspa-primary-gray/20 text-kaspa-primary-gray border-kaspa-primary-gray/30', icon: '⏰', label: 'Expired' },
      manually_removed: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '🗑️', label: 'Manually Removed' },
      api_sync_removed: { color: 'bg-kaspa-accent-teal/20 text-kaspa-accent-teal border-kaspa-accent-teal/30', icon: '🔄', label: 'API Sync Removed' },
      price_changed: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: '💱', label: 'Price Changed' },
      manually_updated: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: '✏️', label: 'Manually Updated' },
      unknown: { color: 'bg-kaspa-primary-gray/20 text-kaspa-primary-gray border-kaspa-primary-gray/30', icon: '❓', label: 'Unknown' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border font-kaspa-body ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <button
      onClick={() => handleSortChange(field)}
      className="flex items-center space-x-1 text-xs font-medium text-kaspa-primary-gray uppercase tracking-wider hover:text-kaspa-secondary-green transition-colors font-kaspa-subheader"
    >
      <span>{children}</span>
      {filters.sortBy === field && (
        <span className="text-kaspa-primary-green">
          {filters.sortOrder === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );

  const HistoricalListingRow = ({ listing }: { listing: HistoricalListing }) => (
    <tr className="border-b border-kaspa-primary-green/10 hover:bg-kaspa-primary-green/5 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center space-x-3">
          {listing.image_url ? (
            <img 
              src={listing.image_url} 
              alt={`${listing.ticker} #${listing.token_id}`}
              className="w-10 h-10 rounded-lg object-cover border border-kaspa-primary-green/20"
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
          <div className={`w-10 h-10 bg-gradient-to-br from-kaspa-primary-gray to-gray-700 rounded-lg flex items-center justify-center shadow-md ${listing.image_url ? 'hidden' : ''}`}>
            <span className="text-white font-bold text-sm font-kaspa-header">{listing.ticker.slice(0, 2)}</span>
          </div>
          <div>
            <div className="font-medium text-white font-kaspa-body">{listing.ticker}</div>
            <div className="text-sm text-kaspa-primary-gray font-kaspa-body">Token #{listing.token_id}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm font-medium text-white font-kaspa-body">
          {formatPrice(Number(listing.total_price))}
        </div>
        {listing.required_kaspa && (
          <div className="text-xs text-kaspa-primary-gray font-kaspa-body">
            {Number(listing.required_kaspa).toLocaleString()} KAS
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        {listing.rarity_rank ? (
          <span className="kaspa-badge">
            #{listing.rarity_rank}
          </span>
        ) : (
          <span className="text-kaspa-primary-gray text-sm">-</span>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-white font-kaspa-body">
          {truncateAddress(listing.seller_wallet_address)}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-kaspa-primary-gray font-kaspa-body">
          {listing.created_at ? formatDate(listing.created_at) : '-'}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-kaspa-primary-gray font-kaspa-body">
          {formatDate(listing.deactivated_at || '')}
        </div>
      </td>
      <td className="py-3 px-4">
        {getStatusBadge(listing.status)}
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-kaspa-body ${
          listing.source === 'kaspa_api' 
            ? 'bg-kaspa-secondary-green/10 text-kaspa-primary-green border border-kaspa-primary-green/20' 
            : 'bg-kaspa-secondary-green text-white'
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
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-400 mb-2 font-kaspa-header">Error Loading Historical Data</h3>
          <p className="text-red-300 mb-4 font-kaspa-body">
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
          <h1 className="text-3xl font-bold text-white font-kaspa-header">Historical Listings</h1>
          <p className="text-kaspa-primary-gray mt-1 font-kaspa-body">
            Review past NFT listings and marketplace activity with full change history
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Total Listings</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="kaspa-stat-value">{stats.total.toLocaleString()}</div>
            <p className="kaspa-stat-label">All historical records</p>
          </CardContent>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Total Value</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="kaspa-stat-value">{formatPrice(stats.totalValue)}</div>
            <p className="kaspa-stat-label">Combined listing value</p>
          </CardContent>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Sold</CardTitle>
            <span className="text-2xl">✅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-kaspa-secondary-green font-kaspa-header">{stats.sold.toLocaleString()}</div>
            <p className="kaspa-stat-label">Successfully sold</p>
          </CardContent>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Cancelled</CardTitle>
            <span className="text-2xl">❌</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400 font-kaspa-header">{stats.cancelled.toLocaleString()}</div>
            <p className="kaspa-stat-label">Cancelled by seller</p>
          </CardContent>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Price Changed</CardTitle>
            <span className="text-2xl">💱</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400 font-kaspa-header">{stats.priceChanged.toLocaleString()}</div>
            <p className="kaspa-stat-label">Price/detail changes</p>
          </CardContent>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Avg. Price</CardTitle>
            <span className="text-2xl">📈</span>
          </CardHeader>
          <CardContent>
            <div className="kaspa-stat-value">{formatPrice(stats.averagePrice)}</div>
            <p className="kaspa-stat-label">Average listing price</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card variant="kaspa">
        <CardHeader>
          <CardTitle className="kaspa-text-gradient">Filters & Search</CardTitle>
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
              <label className="text-sm font-medium text-white block mb-2 font-kaspa-body">
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
              <label className="text-sm font-medium text-white block mb-2 font-kaspa-body">
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
      <Card variant="kaspa">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="kaspa-text-gradient">
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
              <div className="spinner"></div>
              <span className="ml-3 text-kaspa-primary-gray font-kaspa-body">Loading historical data...</span>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-lg font-medium text-white mb-2 font-kaspa-header">
                {searchTokenId || statusFilter ? 'No Matching Records' : 'No Historical Data'}
              </h3>
              <p className="text-kaspa-primary-gray mb-4 font-kaspa-body">
                {searchTokenId || statusFilter
                  ? 'No historical listings match your current filters. Try adjusting your search criteria.'
                  : 'No historical listings found. Historical data will appear here once listings are deactivated.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-kaspa-primary-green/5">
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
                <tbody className="bg-kaspa-accent-medium-blue/50">
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
        <Card variant="kaspa">
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-sm text-kaspa-primary-gray font-kaspa-body">
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
                        className={`px-3 py-1 text-sm rounded-md transition-colors font-kaspa-body ${
                          pageNum === pagination.page
                            ? 'bg-kaspa-primary-green text-kaspa-accent-dark-blue'
                            : 'text-kaspa-primary-gray hover:bg-kaspa-primary-green/20 hover:text-kaspa-secondary-green'
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