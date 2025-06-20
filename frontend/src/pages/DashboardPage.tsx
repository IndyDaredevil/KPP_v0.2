import React from 'react';
import { Link } from 'react-router-dom';
import { useListings, useHistoricalListings } from '../hooks/useListings';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { formatPrice, formatDate, truncateAddress } from '../lib/utils';
import type { Listing } from '../types/api';

const DashboardPage: React.FC = () => {
  const { data: listingsData, isLoading: listingsLoading, error: listingsError } = useListings({ limit: 5, status: 'active' });
  const { data: historicalData, isLoading: historicalLoading } = useHistoricalListings({ limit: 1 });

  const listings = listingsData?.data?.listings || [];
  const totalActiveListings = listingsData?.data?.pagination?.total || 0;
  const totalHistoricalListings = historicalData?.data?.pagination?.total || 0;

  // Calculate summary statistics
  const totalValue = listings.reduce((sum, listing) => sum + Number(listing.total_price), 0);
  const averagePrice = listings.length > 0 ? totalValue / listings.length : 0;
  const lowestPrice = listings.length > 0 ? Math.min(...listings.map(l => Number(l.total_price))) : 0;
  const highestPrice = listings.length > 0 ? Math.max(...listings.map(l => Number(l.total_price))) : 0;

  const StatCard = ({ 
    title, 
    value, 
    description, 
    trend, 
    icon 
  }: { 
    title: string; 
    value: string | number; 
    description: string; 
    trend?: 'up' | 'down' | 'neutral';
    icon: string;
  }) => (
    <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200 kaspa-pulse">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-kaspa-primary-gray font-kaspa-body">{title}</CardTitle>
        <span className="text-2xl">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="kaspa-stat-value">{value}</div>
        <p className={`text-xs flex items-center mt-1 font-kaspa-body ${
          trend === 'up' ? 'text-kaspa-secondary-green' : 
          trend === 'down' ? 'text-red-600' : 
          'text-kaspa-primary-gray'
        }`}>
          {trend === 'up' && '↗️ '}
          {trend === 'down' && '↘️ '}
          {description}
        </p>
      </CardContent>
    </Card>
  );

  const ListingRow = ({ listing }: { listing: Listing }) => (
    <tr className="border-b border-kaspa-primary-green/10 hover:bg-kaspa-secondary-green/5 transition-colors">
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
          <div className={`w-10 h-10 kaspa-gradient rounded-lg flex items-center justify-center shadow-md ${listing.image_url ? 'hidden' : ''}`}>
            <span className="text-white font-bold text-sm font-kaspa-header">{listing.ticker.slice(0, 2)}</span>
          </div>
          <div>
            <div className="font-medium text-kaspa-primary-dark font-kaspa-body">{listing.ticker}</div>
            <div className="text-sm text-kaspa-primary-gray font-kaspa-body">Token #{listing.token_id}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm font-medium text-kaspa-primary-dark font-kaspa-body">
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
        <div className="text-sm text-kaspa-primary-dark font-kaspa-body">
          {truncateAddress(listing.seller_wallet_address)}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-kaspa-primary-gray font-kaspa-body">
          {formatDate(listing.created_at || '')}
        </div>
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

  if (listingsError) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 mb-2 font-kaspa-header">Error Loading Dashboard</h3>
          <p className="text-red-600 font-kaspa-body">
            Failed to load dashboard data. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-kaspa-primary-dark font-kaspa-header">
            Dashboard
          </h1>
          <p className="text-kaspa-primary-gray mt-1 font-kaspa-body">
            Overview of NFT listings and marketplace activity
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Listings"
          value={listingsLoading ? '...' : totalActiveListings.toLocaleString()}
          description="Currently listed NFTs"
          trend="neutral"
          icon="📋"
        />
        <StatCard
          title="Total Sales"
          value={historicalLoading ? '...' : totalHistoricalListings.toLocaleString()}
          description="Completed transactions"
          trend="up"
          icon="💰"
        />
        <StatCard
          title="Average Price"
          value={listingsLoading ? '...' : formatPrice(averagePrice)}
          description="Across active listings"
          trend="neutral"
          icon="📊"
        />
        <StatCard
          title="Price Range"
          value={listingsLoading ? '...' : `${formatPrice(lowestPrice)} - ${formatPrice(highestPrice)}`}
          description="Min to max listing price"
          trend="neutral"
          icon="📈"
        />
      </div>

      {/* Recent Listings */}
      <Card variant="kaspa">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="kaspa-text-gradient">Recent Active Listings</CardTitle>
              <CardDescription>
                Latest NFT listings in the marketplace
              </CardDescription>
            </div>
            <Link to="/listings">
              <button className="btn btn-outline btn-sm">
                View All
              </button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {listingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner"></div>
              <span className="ml-3 text-kaspa-primary-gray font-kaspa-body">Loading listings...</span>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-lg font-medium text-kaspa-primary-dark mb-2 font-kaspa-header">No Active Listings</h3>
              <p className="text-kaspa-primary-gray mb-4 font-kaspa-body">
                No active NFT listings found in the marketplace
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-kaspa-secondary-green/5">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-kaspa-primary-gray uppercase tracking-wider font-kaspa-subheader">
                      NFT
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-kaspa-primary-gray uppercase tracking-wider font-kaspa-subheader">
                      Price
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-kaspa-primary-gray uppercase tracking-wider font-kaspa-subheader">
                      Rarity
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-kaspa-primary-gray uppercase tracking-wider font-kaspa-subheader">
                      Seller
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-kaspa-primary-gray uppercase tracking-wider font-kaspa-subheader">
                      Listed
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-kaspa-primary-gray uppercase tracking-wider font-kaspa-subheader">
                      Source
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200 cursor-pointer kaspa-glow">
          <Link to="/listings" className="block">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>📋</span>
                <span>View Listings</span>
              </CardTitle>
              <CardDescription>
                Browse all active NFT listings in the marketplace
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200 cursor-pointer kaspa-glow">
          <Link to="/sales" className="block">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>💰</span>
                <span>Sales History</span>
              </CardTitle>
              <CardDescription>
                View complete sales history and marketplace analytics
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200 cursor-pointer kaspa-glow">
          <Link to="/historical" className="block">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>📊</span>
                <span>Historical Data</span>
              </CardTitle>
              <CardDescription>
                Review past listings and marketplace changes
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card variant="kaspa" className="hover:shadow-lg transition-all duration-200 cursor-pointer kaspa-glow">
          <Link to="/api-test" className="block">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>🔧</span>
                <span>API Test</span>
              </CardTitle>
              <CardDescription>
                Test API connectivity and debug integration issues
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;