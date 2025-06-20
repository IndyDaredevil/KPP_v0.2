import React, { useState } from 'react';
import { Wallet, LogOut, Shield, Crown, Coins } from 'lucide-react';
import { useKaswareWallet, formatKaspaAmount, truncateAddress } from './KaswareWalletProvider';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';

interface WalletButtonProps {
  variant?: 'default' | 'compact' | 'full';
  showBalance?: boolean;
  showAccessLevel?: boolean;
}

export function WalletButton({ 
  variant = 'default', 
  showBalance = true, 
  showAccessLevel = true 
}: WalletButtonProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const { 
    isInstalled, 
    isConnected, 
    isConnecting, 
    address, 
    balance, 
    connect, 
    disconnect,
    error: walletError 
  } = useKaswareWallet();
  
  const { 
    userRole, 
    isAdmin, 
    hasRequiredToken, 
    accessLevel,
    authenticateWithWallet 
  } = useAuth();
  
  const { showToast } = useToast();

  const handleConnect = async () => {
    try {
      await connect();
      showToast({
        type: 'success',
        title: 'Wallet Connected',
        message: 'Access level determined automatically by wallet address.'
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Connection Failed',
        message: error instanceof Error ? error.message : 'Failed to connect wallet.'
      });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setIsDropdownOpen(false);
    showToast({
      type: 'info',
      title: 'Wallet Disconnected',
      message: 'You now have public access only.'
    });
  };

  const handleAuthenticate = async () => {
    try {
      await authenticateWithWallet();
      setIsDropdownOpen(false);
      showToast({
        type: 'success',
        title: 'Authentication Successful',
        message: 'Wallet signature verified.'
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Authentication Failed',
        message: error instanceof Error ? error.message : 'Failed to authenticate with wallet.'
      });
    }
  };

  // Get display text for current access level
  const getAccessLevelDisplay = (): string => {
    switch (accessLevel) {
      case 'admin':
        return '👑 Admin Access';
      case 'token_holder':
        return '🎭 Token Holder';
      case 'wallet':
        return '🔗 Wallet Connected';
      case 'public':
      default:
        return '🌐 Public Access';
    }
  };

  // Get color for current access level
  const getAccessLevelColor = (): string => {
    switch (accessLevel) {
      case 'admin':
        return 'text-yellow-400';
      case 'token_holder':
        return 'text-purple-400';
      case 'wallet':
        return 'text-blue-400';
      case 'public':
      default:
        return 'text-gray-400';
    }
  };

  // Wallet not installed
  if (!isInstalled) {
    return (
      <div className="relative">
        <button
          onClick={() => window.open('https://kasware.xyz/', '_blank')}
          className="flex items-center space-x-2 px-4 py-2 bg-[#70C7BA] text-gray-900 rounded-lg font-medium hover:bg-[#5FB3A6] transition-colors duration-200"
        >
          <Wallet size={16} />
          <span>Install Kasware</span>
        </button>
      </div>
    );
  }

  // Wallet not connected
  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="flex items-center space-x-2 px-4 py-2 bg-[#70C7BA] text-gray-900 rounded-lg font-medium hover:bg-[#5FB3A6] transition-colors duration-200 disabled:opacity-50"
        >
          <Wallet size={16} />
          <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
        </button>
        
        {walletError && (
          <div className="absolute top-full left-0 mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs max-w-xs">
            {walletError}
          </div>
        )}
      </div>
    );
  }

  // Compact variant - shows "Disconnect" when connected
  if (variant === 'compact') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors duration-200"
        >
          <LogOut size={14} />
          <span className="text-sm">Disconnect</span>
          {isAdmin && <Crown size={12} className="text-yellow-300" />}
          {hasRequiredToken && !isAdmin && <Coins size={12} className="text-purple-300" />}
        </button>
        
        {isDropdownOpen && (
          <WalletDropdown 
            onClose={() => setIsDropdownOpen(false)}
            onDisconnect={handleDisconnect}
            onAuthenticate={handleAuthenticate}
          />
        )}
      </div>
    );
  }

  // Full variant - shows detailed info with disconnect option
  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-3 px-4 py-3 bg-[#1A3550] text-white rounded-lg hover:bg-[#2A4560] transition-colors duration-200 min-w-[200px]"
      >
        <div className="flex items-center space-x-2">
          <Wallet size={16} className="text-[#70C7BA]" />
          <div className="text-left">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">{truncateAddress(address || '')}</span>
              {isAdmin && <Crown size={14} className="text-yellow-400" />}
              {hasRequiredToken && !isAdmin && <Coins size={14} className="text-purple-400" />}
            </div>
            
            {showBalance && balance && (
              <div className="text-xs text-[#B6B6B6]">
                {formatKaspaAmount(balance.total)}
              </div>
            )}
            
            {showAccessLevel && (
              <div className={`text-xs ${getAccessLevelColor()}`}>
                {getAccessLevelDisplay()}
              </div>
            )}
          </div>
        </div>
      </button>
      
      {isDropdownOpen && (
        <WalletDropdown 
          onClose={() => setIsDropdownOpen(false)}
          onDisconnect={handleDisconnect}
          onAuthenticate={handleAuthenticate}
        />
      )}
    </div>
  );
}

interface WalletDropdownProps {
  onClose: () => void;
  onDisconnect: () => void;
  onAuthenticate: () => void;
}

function WalletDropdown({ onClose, onDisconnect, onAuthenticate }: WalletDropdownProps) {
  const { address, balance, network } = useKaswareWallet();
  const { userRole, isAdmin, hasRequiredToken, accessLevel } = useAuth();

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.wallet-dropdown')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className="wallet-dropdown absolute top-full right-0 mt-2 w-80 bg-[#0A2540] border border-[#1A3550] rounded-lg shadow-xl z-50">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Wallet Details</h3>
          <button
            onClick={onClose}
            className="text-[#B6B6B6] hover:text-[#70C7BA] transition-colors duration-200"
          >
            ×
          </button>
        </div>
        
        {/* Address */}
        <div className="mb-4">
          <label className="block text-xs text-[#B6B6B6] mb-1">Address</label>
          <div className="bg-[#1A3550] rounded-lg p-3">
            <code className="text-[#70C7BA] text-sm break-all">{address}</code>
          </div>
        </div>
        
        {/* Balance */}
        {balance && (
          <div className="mb-4">
            <label className="block text-xs text-[#B6B6B6] mb-1">Balance</label>
            <div className="bg-[#1A3550] rounded-lg p-3">
              <div className="text-white font-medium">{formatKaspaAmount(balance.total)}</div>
              <div className="text-xs text-[#B6B6B6] mt-1">
                Confirmed: {formatKaspaAmount(balance.confirmed)} • 
                Unconfirmed: {formatKaspaAmount(balance.unconfirmed)}
              </div>
            </div>
          </div>
        )}
        
        {/* Network */}
        {network && (
          <div className="mb-4">
            <label className="block text-xs text-[#B6B6B6] mb-1">Network</label>
            <div className="bg-[#1A3550] rounded-lg p-3">
              <span className="text-white capitalize">{network}</span>
            </div>
          </div>
        )}
        
        {/* Access Level & Role */}
        <div className="mb-4">
          <label className="block text-xs text-[#B6B6B6] mb-1">Access Level</label>
          <div className="bg-[#1A3550] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isAdmin && (
                  <>
                    <Crown size={16} className="text-yellow-400" />
                    <span className="text-yellow-400 font-medium">Admin Access</span>
                  </>
                )}
                {hasRequiredToken && !isAdmin && (
                  <>
                    <Coins size={16} className="text-purple-400" />
                    <span className="text-purple-400 font-medium">Token Holder</span>
                  </>
                )}
                {!hasRequiredToken && !isAdmin && (
                  <>
                    <Wallet size={16} className="text-blue-400" />
                    <span className="text-blue-400 font-medium">Wallet Connected</span>
                  </>
                )}
              </div>
              <span className="text-xs text-[#B6B6B6] bg-[#0A2540] px-2 py-1 rounded">
                {userRole}
              </span>
            </div>
            <div className="text-xs text-[#B6B6B6] mt-2">
              🔗 Role automatically determined by wallet address
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={onAuthenticate}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-[#70C7BA] text-gray-900 rounded-lg font-medium hover:bg-[#5FB3A6] transition-colors duration-200"
          >
            <Shield size={16} />
            <span>Sign Authentication</span>
          </button>
          
          <button
            onClick={onDisconnect}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors duration-200"
          >
            <LogOut size={16} />
            <span>Disconnect</span>
          </button>
        </div>
      </div>
    </div>
  );
}