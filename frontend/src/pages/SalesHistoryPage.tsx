import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSalesHistory } from '../hooks/useListings';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { formatPrice, formatDate, formatTimeAgo, truncateAddress } from '../lib/utils';
import type { ListingsFilters, KaspaCompletedOrder } from '../types/api';

const SalesHistoryPage: React.FC = () => {
  const { tokenId } = useParams<{ tokenId: string }>();
  const navigate = useNavigate();
  
  const [filters, setFilters] = useState<ListingsFilters>({
    page: 1,
    limit: 25,
    sortBy: 'fullfillmentTimestamp',
    sortOrder: 'desc'
  });

  // Convert tokenId to number for the hook
  const numericTokenId = tokenId ? parseInt(tokenId) : 0;
  const { data: salesData, isLoading, error, refetch } = useSalesHistory(numericTokenId, filters);

  const sales = salesData?.data?.listings || [];
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
        lastSaleDate: null
      };
    }

    const prices = sales.map((sale: KaspaCompletedOrder) => sale.totalPrice);
    const totalVolume = prices.reduce((sum: number, price: number) => sum + price, 0);
    const averagePrice = totalVolume / sales.length;
    const highestSale = Math.max(...prices);
    const lowestSale = Math.min(...prices);
    
    // Find the most recent sale
    const sortedByDate = [...sales].sort((a, b) => 
      new Date(b.fullfillmentTimestamp).getTime() - new Date(a.fullfillmentTimestamp).getTime()
    );
    const lastSaleDate = sortedByDate[0]?.fullfillmentTimestamp;

    return {
      totalSales: sales.length,
      totalVolume,
      averagePrice,
      highestSale,
      lowestSale,
      lastSaleDate
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

  const SaleRow = ({ sale }: { sale: KaspaCompletedOrder }) => (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <div className="text-sm font-medium text-gray-900">
          {formatPrice(sale.totalPrice)}
        </div>
        <div className="text-xs text-gray-500">
          {sale.requiredKaspa?.toLocaleString()} KAS
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-gray-900">
          {formatDate(new Date(sale.fullfillmentTimestamp))}
        </div>
        <div className="text-xs text-gray-500">
          {formatTimeAgo(new Date(sale.fullfillmentTimestamp))}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-gray-900">
          {truncateAddress(sale.sellerWalletAddress)}
        </div>
      </td>
      <td className="py-3 px-4">
        {sale.rarityRank ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            #{sale.rarityRank}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-gray-500">
          {formatDate(sale.createdAt)}
        </div>
      </td>
    </tr>
  );

  if (!tokenId) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 mb-2">Invalid Token ID</h3>
          <p className="text-red-600 mb-4">
            No token ID provided in the URL.
          </p>
          <Link to="/listings">
            <Button variant="outline">Back to Listings</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Sales History</h3>
          <p className="text-red-600 mb-4">
            Failed to load sales history for token #{tokenId}. Please try refreshing the page.
          </p>
          <div className="flex space-x-3">
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
            <Link to="/listings">
              <Button variant="outline">Back to Listings</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </Button>
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">#{tokenId}</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Sales History</h1>
          <p className="text-gray-600 mt-1">
            Complete sales history for KASPUNKS token #{tokenId}
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
            <div className="text-2xl font-bold text-gray-900">{stats.totalSales}</div>
            <p className="text-xs text-gray-500 mt-1">Complete transactions</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Volume</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatPrice(stats.totalVolume)}</div>
            <p className="text-xs text-gray-500 mt-1">All-time volume</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Average Price</CardTitle>
            <span className="text-2xl">📈</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatPrice(stats.averagePrice)}</div>
            <p className="text-xs text-gray-500 mt-1">Mean sale price</p>
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
            <CardTitle className="text-sm font-medium text-gray-600">Last Sale</CardTitle>
            <span className="text-2xl">🕒</span>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-gray-900">
              {stats.lastSaleDate ? formatTimeAgo(new Date(stats.lastSaleDate)) : 'Never'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Most recent sale</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Display Options</CardTitle>
          <CardDescription>
            Customize how sales history is displayed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  setFilters({
                    page: 1,
                    limit: 25,
                    sortBy: 'fullfillmentTimestamp',
                    sortOrder: 'desc'
                  });
                }}
              >
                Reset Filters
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
                Complete transaction history for this token
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Sales History</h3>
              <p className="text-gray-500 mb-4">
                This token has not been sold yet or sales data is not available.
              </p>
              <Link to="/listings">
                <Button>Back to Listings</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="totalPrice">Sale Price</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="fullfillmentTimestamp">Sale Date</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="sellerWalletAddress">Seller</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="rarityRank">Rarity</SortButton>
                    </th>
                    <th className="py-3 px-4 text-left">
                      <SortButton field="createdAt">Listed Date</SortButton>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {sales.map((sale: KaspaCompletedOrder, index: number) => (
                    <SaleRow key={`${sale.id}-${index}`} sale={sale} />
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

export default SalesHistoryPage;