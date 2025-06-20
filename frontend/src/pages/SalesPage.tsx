import React, { useState, useMemo } from 'react';
import { useAllSalesHistory } from '../hooks/useListings';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { formatPrice, formatDate, formatTimeAgo, debounce } from '../lib/utils';
import type { SalesRecord, SalesFilters } from '../types/api';

const SalesPage: React.FC = () => {
  const [filters, setFilters] = useState<SalesFilters>({
    page: 1,
    limit: 25,
    sortBy: 'sale_date',
    sortOrder: 'desc'
  });
  const [searchTokenId, setSearchTokenId] = useState<number | ''>('');

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

  const { data: salesData, isLoading, error, refetch } = useAllSalesHistory(filters);

  const sales = salesData?.data?.sales || [];
  const pagination = salesData?.data?.pagination;

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (sales.length === 0) {
      return {
        totalSales: 0,
        totalVolume: 0,
        averagePrice: 0,
        highestSale: 0,
        lowestSale: 0,
        recentSales: 0
      };
    }

    const prices = sales.map(sale => sale.sale_price);
    const totalVolume = prices.reduce((sum, price) => sum + price, 0);
    const averagePrice = totalVolume / sales.length;
    const highestSale = Math.max(...prices);
    const lowestSale = Math.min(...prices);
    
    // Count recent sales (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSales = sales.filter(sale => 
      new Date(sale.sale_date) >= sevenDaysAgo
    ).length;

    return {
      totalSales: sales.length,
      totalVolume,
      averagePrice,
      highestSale,
      lowestSale,
      recentSales
    };
  }, [sales]);

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

  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <button
      onClick={() => handleSortChange(field)}
      className="flex items-center space-x-1 text-xs font-medium text-kaspa-primary-gray uppercase tracking-wider hover:text-kaspa-primary-green transition-colors font-kaspa-subheader"
    >
      <span>{children}</span>
      {filters.sortBy === field && (
        <span className="text-kaspa-primary-green">
          {filters.sortOrder === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );

  const SaleRow = ({ sale }: { sale: SalesRecord }) => (
    <tr className="border-b border-kaspa-primary-green/10 hover:bg-kaspa-secondary-green/5 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center space-x-3">
          {sale.image_url ? (
            <img 
              src={sale.image_url} 
              alt={`KASPUNKS #${sale.token_id}`}
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
          <div className={`w-10 h-10 kaspa-gradient rounded-lg flex items-center justify-center shadow-md ${sale.image_url ? 'hidden' : ''}`}>
            <span className="text-white font-bold text-sm font-kaspa-header">#{sale.token_id}</span>
          </div>
          <div>
            <div className="font-medium text-white font-kaspa-body">KASPUNKS</div>
            <div className="text-sm text-kaspa-primary-gray font-kaspa-body">Token #{sale.token_id}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm font-medium text-white font-kaspa-body">
          {formatPrice(sale.sale_price)}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-white font-kaspa-body">
          {formatDate(sale.sale_date)}
        </div>
        <div className="text-xs text-kaspa-primary-gray font-kaspa-body">
          {formatTimeAgo(sale.sale_date)}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-kaspa-primary-gray font-kaspa-body">
          {formatDate(sale.created_at)}
        </div>
      </td>
    </tr>
  );

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 mb-2 font-kaspa-header">Error Loading Sales Data</h3>
          <p className="text-red-600 mb-4 font-kaspa-body">
            Failed to load sales history data. Please try refreshing the page.
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
          <h1 className="text-3xl font-bold kaspa-text-gradient font-kaspa-header">
            Sales History
          </h1>
          <p className="text-kaspa-primary-gray mt-1 font-kaspa-body">
            Complete sales history and marketplace analytics
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Total Sales</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="kaspa-stat-value">{pagination?.total?.toLocaleString() || 0}</div>
            <p className="kaspa-stat-label">All-time transactions</p>
          </CardContent>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Total Volume</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="kaspa-stat-value">{formatPrice(stats.totalVolume)}</div>
            <p className="kaspa-stat-label">Current page volume</p>
          </CardContent>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Average Price</CardTitle>
            <span className="text-2xl">📈</span>
          </CardHeader>
          <CardContent>
            <div className="kaspa-stat-value">{formatPrice(stats.averagePrice)}</div>
            <p className="kaspa-stat-label">Current page average</p>
          </CardContent>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Highest Sale</CardTitle>
            <span className="text-2xl">🚀</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-kaspa-secondary-green font-kaspa-header">{formatPrice(stats.highestSale)}</div>
            <p className="kaspa-stat-label">Peak sale price</p>
          </CardContent>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Lowest Sale</CardTitle>
            <span className="text-2xl">📉</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-kaspa-accent-teal font-kaspa-header">{formatPrice(stats.lowestSale)}</div>
            <p className="kaspa-stat-label">Floor sale price</p>
          </CardContent>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">Recent Sales</CardTitle>
            <span className="text-2xl">🔥</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 font-kaspa-header">{stats.recentSales}</div>
            <p className="kaspa-stat-label">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card variant="kaspa">
        <CardHeader>
          <CardTitle className="kaspa-text-gradient">Filters & Search</CardTitle>
          <CardDescription>
            Filter and search through sales history
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
              <label className="text-sm font-medium text-kaspa-primary-gray block mb-2 font-kaspa-body">
                Items per page
              </label>
              <select
                value={filters.limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="input"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
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
                    limit: 25,
                    sortBy: 'sale_date',
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

      {/* Sales History Table */}
      <Card variant="kaspa">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="kaspa-text-gradient">
                Sales History ({pagination?.total?.toLocaleString() || 0})
              </CardTitle>
              <CardDescription>
                Complete transaction history from the marketplace
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner"></div>
              <span className="ml-3 text-kaspa-primary-gray font-kaspa-body">Loading sales history...</span>
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📈</div>
              <h3 className="text-lg font-medium text-white mb-2 font-kaspa-header">
                {searchTokenId ? 'No Matching Sales' : 'No Sales History'}
              </h3>
              <p className="text-kaspa-primary-gray mb-4 font-kaspa-body">
                {searchTokenId
                  ? `No sales found for token "${searchTokenId}". Try adjusting your search criteria.`
                  : 'No sales history data is available at this time.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-kaspa-secondary-green/5">
                  <tr>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="token_id">NFT</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="sale_price">Sale Price</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="sale_date">Sale Date</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="created_at">Recorded</SortButton>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {sales.map((sale) => (
                    <SaleRow key={sale.id} sale={sale} />
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
                            ? 'bg-kaspa-primary-green text-white'
                            : 'text-kaspa-primary-gray hover:bg-kaspa-secondary-green/10'
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

export default SalesPage;