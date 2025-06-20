import React, { useState, useEffect } from 'react';
import { supabase, publicQuery } from '../lib/supabase';
import { LoadingSpinner } from '../packages/kaspunk-ui';
import { useKaswareWallet } from './KaswareWalletProvider';
import { useAuth } from './AuthProvider';
import { Wallet, Shield, Crown, Coins } from 'lucide-react';

interface MarketplaceMetrics {
  totalSales: number;
  totalVolume: number;
  avgSalePrice: number;
  activeListings: number;
  floorPrice: number;
  totalTokens: number;
  lastUpdated: string;
}

export function MaintenancePage() {
  const [metrics, setMetrics] = useState<MarketplaceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const { 
    isInstalled, 
    isConnected, 
    isConnecting, 
    address, 
    connect, 
    disconnect 
  } = useKaswareWallet();
  
  const { isAdmin, userRole, authenticateWithWallet } = useAuth();

  useEffect(() => {
    const fetchMarketplaceMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 Fetching real marketplace metrics for maintenance page...');

        // Fetch multiple metrics in parallel
        const [salesResult, listingsResult, tokensResult] = await Promise.all([
          // Get sales statistics
          publicQuery(() =>
            supabase
              .from('sales_history')
              .select('sale_price, sale_date')
              .order('sale_date', { ascending: false })
              .limit(1000)
          ),
          
          // Get active listings
          publicQuery(() =>
            supabase
              .from('active_listings')
              .select('price')
              .not('price', 'is', null)
              .order('price', { ascending: true })
          ),
          
          // Get total tokens
          publicQuery(() =>
            supabase
              .from('tokens')
              .select('token_id', { count: 'exact', head: true })
          )
        ]);

        // Process sales data
        const salesData = salesResult.data || [];
        const totalSales = salesData.length;
        const totalVolume = salesData.reduce((sum, sale) => sum + (sale.sale_price || 0), 0);
        const avgSalePrice = totalSales > 0 ? totalVolume / totalSales : 0;

        // Process listings data
        const listingsData = listingsResult.data || [];
        const activeListings = listingsData.length;
        const floorPrice = listingsData.length > 0 ? listingsData[0].price : 0;

        // Process tokens data
        const totalTokens = tokensResult.count || 0;

        const marketplaceMetrics: MarketplaceMetrics = {
          totalSales,
          totalVolume,
          avgSalePrice,
          activeListings,
          floorPrice,
          totalTokens,
          lastUpdated: new Date().toISOString()
        };

        setMetrics(marketplaceMetrics);
        console.log('✅ Marketplace metrics loaded:', marketplaceMetrics);

      } catch (err) {
        console.error('❌ Error fetching marketplace metrics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load marketplace data');
        
        // Fallback to reasonable default values
        setMetrics({
          totalSales: 0,
          totalVolume: 0,
          avgSalePrice: 0,
          activeListings: 0,
          floorPrice: 0,
          totalTokens: 10000, // Known total
          lastUpdated: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMarketplaceMetrics();
  }, []);

  const handleAdminConnect = async () => {
    try {
      setAdminError(null);
      await connect();
      // After wallet connection, authenticate to check role
      await authenticateWithWallet();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Failed to connect wallet');
    }
  };

  const handleAdminDisconnect = () => {
    disconnect();
    setShowAdminPanel(false);
    setAdminError(null);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const formatKAS = (amount: number): string => {
    return `${formatNumber(amount)} KAS`;
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#0A2540] to-gray-900 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#0A2540] rounded-xl shadow-xl w-full max-w-5xl text-center border border-[#1A3550] overflow-hidden relative">
        
        {/* 🎯 DESKTOP VERSION - Restructured Layout */}
        <div className="hidden md:block p-6">
          {/* Compact Header */}
          <div className="flex items-center justify-center space-x-4 mb-4">
            <img src="/Kaspa-Icon-Dark-Green-on-Black.png" alt="Kaspa Logo" className="w-12 h-12" />
            <div>
              <div className="flex items-baseline">
                <span className="text-2xl font-normal text-white">KasPunk</span>
                <span className="text-2xl font-normal text-[#7FE6D5] ml-2">Predictor</span>
              </div>
              <p className="text-[#B6B6B6] text-sm">AI-Powered NFT Valuation Platform</p>
              <a 
                href="https://x.com/KasPunkPredict" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-[#1DA1F2] hover:text-[#1A91DA] transition-colors duration-200 text-xs mt-1"
              >
                <span>𝕏</span>
                <span>@KasPunkPredict</span>
              </a>
            </div>
          </div>
          
          {/* Compact Maintenance Message */}
          <div className="bg-[#1A3550] rounded-lg p-4 mb-4">
            <h2 className="text-xl font-bold text-[#70C7BA] mb-2">🛠️ Undergoing Upgrades</h2>
            <p className="text-white text-base mb-2">
              Our platform is currently undergoing significant upgrades to bring you new features and improved performance.
            </p>
            <p className="text-[#B6B6B6] text-sm">
              We appreciate your understanding and can't wait for you to experience the enhancements!
            </p>
          </div>

          {/* 🎯 NEW LAYOUT: Shorter Header + 9 Equal Squares */}
          <div className="bg-[#1A3550] rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <h3 className="text-lg font-bold text-[#70C7BA]">📊 Live Marketplace Data</h3>
              {loading && <LoadingSpinner size="sm" />}
            </div>
            
            {error && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 mb-3">
                <p className="text-yellow-400 text-xs">⚠️ Using cached data: {error}</p>
              </div>
            )}
            
            {/* 🎯 SHORTER TOP HEADER: Only 1000 KasPunks Available */}
            <div className="mb-4">
              <div className="bg-gradient-to-br from-[#7FE6D5] to-[#49EACB] p-3 rounded-lg text-center relative overflow-hidden shadow-lg shadow-[#7FE6D5]/20 border-2 border-[#7FE6D5]">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
                <div className="absolute top-1 right-1 text-yellow-300 animate-bounce text-xs">✨</div>
                <div className="absolute bottom-1 left-1 text-yellow-300 animate-bounce delay-300 text-xs">💎</div>
                
                <div className="relative z-10">
                  <div className="text-xl font-black text-gray-900 drop-shadow-sm">
                    Only 1000 KasPunks Available
                  </div>
                  <div className="text-sm font-bold text-gray-800 bg-white/20 rounded-full px-2 py-1 inline-block mt-1">
                    🔥 RARE COLLECTION
                  </div>
                </div>
              </div>
            </div>

            {/* 🎯 9 EQUAL-SIZED INFORMATION SQUARES (3x3 Grid) */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {/* Row 1 */}
              <div className="bg-[#0A2540] p-4 rounded-lg text-center">
                <div className="text-lg font-bold text-[#49EACB]">
                  {loading ? '...' : formatNumber(metrics?.totalSales || 0)}
                </div>
                <div className="text-xs text-[#B6B6B6]">Total Sales</div>
              </div>
              
              <div className="bg-[#0A2540] p-4 rounded-lg text-center">
                <div className="text-lg font-bold text-[#49EACB]">
                  {loading ? '...' : formatKAS(metrics?.totalVolume || 0)}
                </div>
                <div className="text-xs text-[#B6B6B6]">Total Volume</div>
              </div>
              
              <div className="bg-[#0A2540] p-4 rounded-lg text-center">
                <div className="text-lg font-bold text-[#49EACB]">
                  {loading ? '...' : formatKAS(metrics?.avgSalePrice || 0)}
                </div>
                <div className="text-xs text-[#B6B6B6]">Avg. Sale Price</div>
              </div>

              {/* Row 2 */}
              <div className="bg-[#0A2540] p-4 rounded-lg text-center">
                <div className="text-lg font-bold text-[#49EACB]">
                  {loading ? '...' : formatNumber(metrics?.activeListings || 0)}
                </div>
                <div className="text-xs text-[#B6B6B6]">Active Listings</div>
              </div>
              
              <div className="bg-[#0A2540] p-4 rounded-lg text-center">
                <div className="text-lg font-bold text-[#49EACB]">
                  {loading ? '...' : formatKAS(metrics?.floorPrice || 0)}
                </div>
                <div className="text-xs text-[#B6B6B6]">Floor Price</div>
              </div>

              {/* 🎯 NEW SQUARE: AI Analytics */}
              <div className="bg-[#0A2540] p-4 rounded-lg text-center border border-[#1A3550]">
                <div className="text-lg mb-1">🤖</div>
                <div className="text-xs font-semibold text-[#70C7BA] mb-0.5">AI Analytics</div>
                <div className="text-xs text-[#B6B6B6]">Smart Insights</div>
              </div>

              {/* Row 3 - Platform Features */}
              <div className="bg-[#0A2540] p-4 rounded-lg text-center border border-[#1A3550]">
                <div className="text-lg mb-1">🎯</div>
                <div className="text-xs font-semibold text-[#70C7BA] mb-0.5">Smart Predictions</div>
                <div className="text-xs text-[#B6B6B6]">AI-driven</div>
              </div>
              
              <div className="bg-[#0A2540] p-4 rounded-lg text-center border border-[#1A3550]">
                <div className="text-lg mb-1">📈</div>
                <div className="text-xs font-semibold text-[#70C7BA] mb-0.5">Market Analysis</div>
                <div className="text-xs text-[#B6B6B6]">Real-time</div>
              </div>
              
              <div className="bg-[#0A2540] p-4 rounded-lg text-center border border-[#1A3550]">
                <div className="text-lg mb-1">💎</div>
                <div className="text-xs font-semibold text-[#70C7BA] mb-0.5">Rarity Insights</div>
                <div className="text-xs text-[#B6B6B6]">Deep analysis</div>
              </div>
            </div>

            {/* Marketing Images with iPad (NO "REAL TOKEN" badge) */}
            <div className="grid grid-cols-2 gap-4 relative">
              {/* NFT Digital Art with iPad - NO BADGE */}
              <div className="relative group overflow-hidden rounded-lg shadow-lg h-36">
                <img 
                  src="https://images.pexels.com/photos/7567443/pexels-photo-7567443.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=1" 
                  alt="NFT Digital Art Collection"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                
                {/* iPad with Token #799 - NO "REAL TOKEN" badge */}
                <div className="absolute top-2 right-2 w-20 h-32 bg-gray-900 rounded-lg border border-gray-700 shadow-xl overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-300">
                  <div className="w-full h-full bg-black rounded-md p-0.5">
                    <div className="w-full h-full bg-[#0A2540] rounded-sm overflow-hidden relative">
                      {/* iPad Screen with Token #799 */}
                      <div className="w-full h-5/6 overflow-hidden bg-[#0A2540] p-1">
                        <div className="w-full h-full rounded-sm overflow-hidden border border-[#1A3550]">
                          <img 
                            src="/image.png" 
                            alt="KasPunk #799"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      
                      {/* iPad Bottom Bar with Token Info */}
                      <div className="h-1/6 p-1 flex flex-col items-center justify-center bg-[#0A2540] border-t border-[#1A3550]">
                        <div className="text-center">
                          <div className="text-[#70C7BA] text-[10px] font-bold">#799</div>
                          <div className="text-[#49EACB] text-[8px]">Rank: 50</div>
                          <div className="text-[#B6B6B6] text-[6px]">125K KAS</div>
                        </div>
                        <div className="w-1 h-1 bg-[#70C7BA] rounded-full animate-pulse mt-1"></div>
                      </div>
                      
                      {/* iPad Home Indicator */}
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-0.5 bg-gray-600 rounded-full"></div>
                    </div>
                  </div>
                </div>
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-2 left-2 text-white">
                  <h4 className="font-bold text-sm">🎨 Digital Art NFTs</h4>
                  <p className="text-xs opacity-90">Featuring KasPunk #799 on iPad</p>
                </div>
              </div>

              {/* AI Analytics */}
              <div className="relative group overflow-hidden rounded-lg shadow-lg h-36">
                <img 
                  src="https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=1" 
                  alt="AI Analytics Dashboard"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-2 left-2 text-white">
                  <h4 className="font-bold text-sm">🤖 AI Analytics</h4>
                  <p className="text-xs opacity-90">Smart Predictions & Insights</p>
                </div>
                <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">
                  AI POWERED
                </div>
                
                {/* Enhanced Analytics Overlay */}
                <div className="absolute top-2 right-2 bg-black/70 rounded-lg p-2 text-white">
                  <div className="text-[10px] font-bold text-green-400">95% ACCURACY</div>
                  <div className="text-[8px] text-gray-300">Live Analysis</div>
                </div>
              </div>

              {/* Admin Access Panel - Positioned below graphics on the right */}
              <div className="absolute -bottom-20 right-0 w-48">
                {!isConnected ? (
                  <div className="bg-[#0A2540]/80 backdrop-blur-sm rounded-lg p-2 border border-[#1A3550]">
                    <div className="flex items-center space-x-1 mb-1">
                      <Shield size={12} className="text-[#70C7BA]" />
                      <span className="text-[#70C7BA] text-xs font-medium">Admin Access</span>
                    </div>
                    
                    {!isInstalled ? (
                      <div className="text-center">
                        <p className="text-[#B6B6B6] text-xs mb-1">Kasware required</p>
                        <button
                          onClick={() => window.open('https://kasware.xyz/', '_blank')}
                          className="px-2 py-1 bg-[#70C7BA] text-gray-900 rounded text-xs font-medium hover:bg-[#5FB3A6] transition-colors duration-200"
                        >
                          Install
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <button
                          onClick={handleAdminConnect}
                          disabled={isConnecting}
                          className="flex items-center space-x-1 px-2 py-1 bg-[#70C7BA] text-gray-900 rounded text-xs font-medium hover:bg-[#5FB3A6] transition-colors duration-200 disabled:opacity-50"
                        >
                          <Wallet size={10} />
                          <span>{isConnecting ? 'Connecting...' : 'Connect'}</span>
                        </button>
                      </div>
                    )}
                    
                    {adminError && (
                      <div className="mt-1 p-1 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
                        {adminError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#0A2540]/80 backdrop-blur-sm rounded-lg p-2 border border-[#1A3550]">
                    <div className="flex items-center space-x-1 mb-1">
                      {isAdmin ? (
                        <>
                          <Crown size={12} className="text-yellow-400" />
                          <span className="text-yellow-400 text-xs font-medium">Admin</span>
                        </>
                      ) : userRole === 'token_holder' ? (
                        <>
                          <Coins size={12} className="text-purple-400" />
                          <span className="text-purple-400 text-xs font-medium">Token Holder</span>
                        </>
                      ) : (
                        <>
                          <Shield size={12} className="text-red-400" />
                          <span className="text-red-400 text-xs font-medium">Unauthorized</span>
                        </>
                      )}
                    </div>
                    
                    <div className="text-[#B6B6B6] text-xs mb-1">
                      {truncateAddress(address || '')}
                    </div>
                    
                    {isAdmin ? (
                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            window.location.href = '/?admin=true';
                          }}
                          className="w-full px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors duration-200"
                        >
                          Enter Admin
                        </button>
                        <button
                          onClick={handleAdminDisconnect}
                          className="w-full px-2 py-1 bg-[#1A3550] text-[#70C7BA] rounded text-xs font-medium hover:bg-[#2A4560] transition-colors duration-200"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="p-1 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
                          Not authorized
                        </div>
                        <button
                          onClick={handleAdminDisconnect}
                          className="w-full px-2 py-1 bg-[#1A3550] text-[#70C7BA] rounded text-xs font-medium hover:bg-[#2A4560] transition-colors duration-200"
                        >
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Status & Footer */}
            <div className="flex items-center justify-center space-x-2 text-[#70C7BA] mt-4 mb-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#70C7BA]"></div>
              <span className="text-xs">System maintenance in progress...</span>
            </div>
            
            {metrics && !loading && (
              <p className="text-[#B6B6B6] text-xs">
                📅 Updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* 📱 MOBILE VERSION - Updated Layout */}
        <div className="block md:hidden p-4">
          {/* Mobile Header */}
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img src="/Kaspa-Icon-Dark-Green-on-Black.png" alt="Kaspa Logo" className="w-10 h-10" />
            <div>
              <div className="flex items-baseline">
                <span className="text-xl font-normal text-white">KasPunk</span>
                <span className="text-xl font-normal text-[#7FE6D5] ml-1">Predictor</span>
              </div>
              <p className="text-[#B6B6B6] text-xs">AI-Powered NFT Platform</p>
              <a 
                href="https://x.com/KasPunkPredict" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-[#1DA1F2] hover:text-[#1A91DA] transition-colors duration-200 text-xs mt-1"
              >
                <span>𝕏</span>
                <span>@KasPunkPredict</span>
              </a>
            </div>
          </div>
          
          {/* Mobile Maintenance Message */}
          <div className="bg-[#1A3550] rounded-lg p-4 mb-4">
            <h2 className="text-lg font-bold text-[#70C7BA] mb-2">🛠️ Upgrading</h2>
            <p className="text-white text-sm mb-2">
              We're upgrading our platform with new features and improved performance.
            </p>
            <p className="text-[#B6B6B6] text-xs mb-2">
              Thanks for your patience! Visit us again shortly.
            </p>
          </div>

          {/* Mobile Live Data */}
          <div className="bg-[#1A3550] rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <h3 className="text-base font-bold text-[#70C7BA]">📊 Live Data</h3>
              {loading && <LoadingSpinner size="sm" />}
            </div>
            
            {/* Mobile: Shorter Header */}
            <div className="mb-4">
              <div className="bg-gradient-to-br from-[#7FE6D5] to-[#49EACB] p-3 rounded-lg text-center relative overflow-hidden shadow-lg shadow-[#7FE6D5]/20 border-2 border-[#7FE6D5]">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
                <div className="absolute top-1 right-1 text-yellow-300 animate-bounce">✨</div>
                <div className="absolute bottom-1 left-1 text-yellow-300 animate-bounce delay-300">💎</div>
                
                <div className="relative z-10">
                  <div className="text-lg font-black text-gray-900 drop-shadow-sm">
                    Only 1000 KasPunks Available
                  </div>
                  <div className="text-xs font-semibold text-gray-800 bg-white/20 rounded-full px-2 py-1 inline-block mt-1">
                    🔥 RARE COLLECTION
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile: 3x3 Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-[#0A2540] p-2 rounded-lg text-center">
                <div className="text-sm font-bold text-[#49EACB]">
                  {loading ? '...' : formatNumber(metrics?.totalSales || 0)}
                </div>
                <div className="text-xs text-[#B6B6B6]">Sales</div>
              </div>
              
              <div className="bg-[#0A2540] p-2 rounded-lg text-center">
                <div className="text-sm font-bold text-[#49EACB]">
                  {loading ? '...' : formatKAS(metrics?.totalVolume || 0)}
                </div>
                <div className="text-xs text-[#B6B6B6]">Volume</div>
              </div>
              
              <div className="bg-[#0A2540] p-2 rounded-lg text-center">
                <div className="text-sm font-bold text-[#49EACB]">
                  {loading ? '...' : formatNumber(metrics?.activeListings || 0)}
                </div>
                <div className="text-xs text-[#B6B6B6]">Listings</div>
              </div>

              <div className="bg-[#0A2540] p-2 rounded-lg text-center">
                <div className="text-sm font-bold text-[#49EACB]">
                  {loading ? '...' : formatKAS(metrics?.floorPrice || 0)}
                </div>
                <div className="text-xs text-[#B6B6B6]">Floor</div>
              </div>

              <div className="bg-[#0A2540] p-2 rounded-lg text-center border border-[#1A3550]">
                <div className="text-sm mb-1">🤖</div>
                <div className="text-xs text-[#70C7BA]">AI</div>
              </div>

              <div className="bg-[#0A2540] p-2 rounded-lg text-center border border-[#1A3550]">
                <div className="text-sm mb-1">🎯</div>
                <div className="text-xs text-[#70C7BA]">Smart</div>
              </div>

              <div className="bg-[#0A2540] p-2 rounded-lg text-center border border-[#1A3550]">
                <div className="text-sm mb-1">📈</div>
                <div className="text-xs text-[#70C7BA]">Market</div>
              </div>

              <div className="bg-[#0A2540] p-2 rounded-lg text-center border border-[#1A3550]">
                <div className="text-sm mb-1">💎</div>
                <div className="text-xs text-[#70C7BA]">Rarity</div>
              </div>

              <div className="bg-[#0A2540] p-2 rounded-lg text-center border border-[#1A3550]">
                <div className="text-sm mb-1">⚡</div>
                <div className="text-xs text-[#70C7BA]">Fast</div>
              </div>
            </div>

            {/* Mobile: Single Marketing Image (NO badge) */}
            <div className="relative group overflow-hidden rounded-lg shadow-lg h-32 mb-3">
              <img 
                src="https://images.pexels.com/photos/7567443/pexels-photo-7567443.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=1" 
                alt="NFT Digital Art Collection"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              
              {/* Mobile iPad with Token #799 - NO badge */}
              <div className="absolute top-2 right-2 w-12 h-24 bg-gray-900 rounded-lg border border-gray-700 shadow-lg overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-300">
                <div className="w-full h-full bg-black rounded-md p-0.5">
                  <div className="w-full h-full bg-[#0A2540] rounded-sm overflow-hidden relative">
                    <div className="w-full h-5/6 overflow-hidden bg-[#0A2540] p-0.5">
                      <div className="w-full h-full rounded-sm overflow-hidden border border-[#1A3550]">
                        <img 
                          src="/image.png" 
                          alt="KasPunk #799"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="h-1/6 p-0.5 flex flex-col items-center justify-center bg-[#0A2540] border-t border-[#1A3550]">
                      <div className="text-[#70C7BA] text-[6px] font-bold">#799</div>
                      <div className="text-[#49EACB] text-[5px]">Rank: 50</div>
                    </div>
                    <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-2 h-0.5 bg-gray-600 rounded-full"></div>
                  </div>
                </div>
              </div>
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-2 left-2 text-white">
                <h4 className="font-bold text-sm">🎨 Digital Art NFTs</h4>
                <p className="text-xs opacity-90">Featuring KasPunk #799 on iPad</p>
              </div>
            </div>

            {/* Mobile Admin Access */}
            <div className="mb-3">
              {!isConnected ? (
                <div className="bg-[#0A2540]/80 backdrop-blur-sm rounded-lg p-2 border border-[#1A3550]">
                  <div className="flex items-center space-x-1 mb-1">
                    <Shield size={12} className="text-[#70C7BA]" />
                    <span className="text-[#70C7BA] text-xs font-medium">Admin Access</span>
                  </div>
                  
                  {!isInstalled ? (
                    <div className="text-center">
                      <p className="text-[#B6B6B6] text-xs mb-1">Kasware required</p>
                      <button
                        onClick={() => window.open('https://kasware.xyz/', '_blank')}
                        className="px-2 py-1 bg-[#70C7BA] text-gray-900 rounded text-xs font-medium hover:bg-[#5FB3A6] transition-colors duration-200"
                      >
                        Install
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <button
                        onClick={handleAdminConnect}
                        disabled={isConnecting}
                        className="flex items-center space-x-1 px-2 py-1 bg-[#70C7BA] text-gray-900 rounded text-xs font-medium hover:bg-[#5FB3A6] transition-colors duration-200 disabled:opacity-50 mx-auto"
                      >
                        <Wallet size={10} />
                        <span>{isConnecting ? 'Connecting...' : 'Connect'}</span>
                      </button>
                    </div>
                  )}
                  
                  {adminError && (
                    <div className="mt-1 p-1 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
                      {adminError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#0A2540]/80 backdrop-blur-sm rounded-lg p-2 border border-[#1A3550]">
                  <div className="flex items-center space-x-1 mb-1">
                    {isAdmin ? (
                      <>
                        <Crown size={12} className="text-yellow-400" />
                        <span className="text-yellow-400 text-xs font-medium">Admin Connected</span>
                      </>
                    ) : userRole === 'token_holder' ? (
                      <>
                        <Coins size={12} className="text-purple-400" />
                        <span className="text-purple-400 text-xs font-medium">Token Holder</span>
                      </>
                    ) : (
                      <>
                        <Shield size={12} className="text-red-400" />
                        <span className="text-red-400 text-xs font-medium">Unauthorized</span>
                      </>
                    )}
                  </div>
                  
                  <div className="text-[#B6B6B6] text-xs mb-1 text-center">
                    {truncateAddress(address || '')}
                  </div>
                  
                  {isAdmin ? (
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          window.location.href = '/?admin=true';
                        }}
                        className="w-full px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors duration-200"
                      >
                        Enter Admin Mode
                      </button>
                      <button
                        onClick={handleAdminDisconnect}
                        className="w-full px-2 py-1 bg-[#1A3550] text-[#70C7BA] rounded text-xs font-medium hover:bg-[#2A4560] transition-colors duration-200"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="p-1 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center">
                        Not authorized
                      </div>
                      <button
                        onClick={handleAdminDisconnect}
                        className="w-full px-2 py-1 bg-[#1A3550] text-[#70C7BA] rounded text-xs font-medium hover:bg-[#2A4560] transition-colors duration-200"
                      >
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Status */}
            <div className="flex items-center justify-center space-x-2 text-[#70C7BA] mb-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#70C7BA]"></div>
              <span className="text-xs">Maintenance in progress...</span>
            </div>
            
            {metrics && !loading && (
              <p className="text-[#B6B6B6] text-xs text-center">
                📅 Updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}