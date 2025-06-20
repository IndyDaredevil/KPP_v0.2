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

  const SaleRow = ({ sale }: { sale: SalesRecord }) => (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center space-x-3">
          {sale.image_url ? (
            <img 
              src={sale.image_url} 
              alt={`KASPUNKS #${sale.token_id}`}
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
          <div className={`w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-lg flex items-center justify-center ${sale.image_url ? 'hidden' : ''}`}>
            <span className="text-white font-bold text-sm">#{sale.token_id}</span>
          </div>
          <div>
            <div className="font-medium text-gray-900">KASPUNKS</div>
            <div className="text-sm text-gray-500">Token #{sale.token_id}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm font-medium text-gray-900">
          {formatPrice(sale.sale_price)}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-gray-900">
          {formatDate(sale.sale_date)}
        </div>
        <div className="text-xs text-gray-500">
          {formatTimeAgo(sale.sale_date)}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-gray-500">
          {formatDate(sale.created_at)}
        </div>
      </td>
    </tr>
  );

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Sales Data</h3>
          <p className="text-red-600 mb-4">
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
          <h1 className="text-3xl font-bold text-gray-900">Sales History</h1>
          <p className="text-gray-600 mt-1">
            Complete sales history and marketplace analytics
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Sales</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{pagination?.total?.toLocaleString() || 0}</div>
            <p className="text-xs text-gray-500 mt-1">All-time transactions</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Volume</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatPrice(stats.totalVolume)}</div>
            <p className="text-xs text-gray-500 mt-1">Current page volume</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Average Price</CardTitle>
            <span className="text-2xl">📈</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatPrice(stats.averagePrice)}</div>
            <p className="text-xs text-gray-500 mt-1">Current page average</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Highest Sale</CardTitle>
            <span className="text-2xl">🚀</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatPrice(stats.highestSale)}</div>
            <p className="text-xs text-gray-500 mt-1">Peak sale price</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Lowest Sale</CardTitle>
            <span className="text-2xl">📉</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatPrice(stats.lowestSale)}</div>
            <p className="text-xs text-gray-500 mt-1">Floor sale price</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Recent Sales</CardTitle>
            <span className="text-2xl">🔥</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.recentSales}</div>
            <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
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
              <label className="text-sm font-medium text-gray-700 block mb-2">
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
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3 text-gray-600">Loading sales history...</span>
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📈</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTokenId ? 'No Matching Sales' : 'No Sales History'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTokenId
                  ? `No sales found for token "${searchTokenId}". Try adjusting your search criteria.`
                  : 'No sales history data is available at this time.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
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

export default SalesPage;