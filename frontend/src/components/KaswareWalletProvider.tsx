import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Types based on Kasware Wallet Extension API
interface KaswareWallet {
  requestAccounts: () => Promise<string[]>;
  getAccounts: () => Promise<string[]>;
  getNetwork: () => Promise<string>;
  getBalance: () => Promise<{ confirmed: number; unconfirmed: number; total: number }>;
  getPublicKey: () => Promise<string>;
  signMessage: (message: string, type?: 'ecdsa' | 'bip322-simple') => Promise<string>;
  signPsbt: (psbtHex: string, options?: any) => Promise<string>;
  pushPsbt: (psbtHex: string) => Promise<string>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
}

interface KaswareWalletContextType {
  // Wallet state
  isInstalled: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  publicKey: string | null;
  balance: { confirmed: number; unconfirmed: number; total: number } | null;
  network: string | null;
  
  // Connection methods
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Utility methods
  signMessage: (message: string, type?: 'ecdsa' | 'bip322-simple') => Promise<string>;
  getBalance: () => Promise<void>;
  
  // Error state
  error: string | null;
  clearError: () => void;
}

const KaswareWalletContext = createContext<KaswareWalletContextType | undefined>(undefined);

export function useKaswareWallet() {
  const context = useContext(KaswareWalletContext);
  if (!context) {
    throw new Error('useKaswareWallet must be used within a KaswareWalletProvider');
  }
  return context;
}

interface KaswareWalletProviderProps {
  children: React.ReactNode;
}

export function KaswareWalletProvider({ children }: KaswareWalletProviderProps) {
  // State management
  const [isInstalled, setIsInstalled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<{ confirmed: number; unconfirmed: number; total: number } | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userDisconnected, setUserDisconnected] = useState(false); // Track if user manually disconnected

  // Get wallet instance
  const getWallet = useCallback((): KaswareWallet | null => {
    if (typeof window !== 'undefined') {
      // Check for Kasware wallet - try multiple possible global objects
      const wallet = (window as any).kasware || (window as any).kaspa || (window as any).unisat;
      return wallet || null;
    }
    return null;
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check if wallet is installed
  const checkWalletInstallation = useCallback(() => {
    const wallet = getWallet();
    const installed = !!wallet;
    setIsInstalled(installed);
    
    if (!installed) {
      console.log('🔍 Kasware Wallet not detected. Please install the extension.');
    } else {
      console.log('✅ Kasware Wallet detected');
    }
    
    return installed;
  }, [getWallet]);

  // Connect to wallet
  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);
      setUserDisconnected(false); // Reset user disconnected flag when connecting
      
      const wallet = getWallet();
      if (!wallet) {
        throw new Error('Kasware Wallet not installed. Please install the extension first.');
      }

      console.log('🔗 Attempting to connect to Kasware Wallet...');
      
      // Request account access
      const accounts = await wallet.requestAccounts();
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please create an account in your Kasware Wallet.');
      }

      const selectedAddress = accounts[0];
      console.log('✅ Connected to Kasware Wallet:', selectedAddress);
      
      // Get additional wallet info
      const [pubKey, networkInfo] = await Promise.all([
        wallet.getPublicKey().catch(() => null),
        wallet.getNetwork().catch(() => 'mainnet')
      ]);

      // Update state
      setAddress(selectedAddress);
      setPublicKey(pubKey);
      setNetwork(networkInfo);
      setIsConnected(true);
      
      // Get initial balance
      await getBalanceInternal();
      
      // Store connection state ONLY if user didn't manually disconnect
      localStorage.setItem('kasware_wallet_connected', 'true');
      localStorage.setItem('kasware_wallet_address', selectedAddress);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to wallet';
      console.error('❌ Wallet connection failed:', errorMessage);
      setError(errorMessage);
      setIsConnected(false);
      setAddress(null);
      setPublicKey(null);
      setBalance(null);
      setNetwork(null);
    } finally {
      setIsConnecting(false);
    }
  }, [getWallet]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting from Kasware Wallet...');
    
    // Set user disconnected flag to prevent auto-reconnect
    setUserDisconnected(true);
    
    setIsConnected(false);
    setAddress(null);
    setPublicKey(null);
    setBalance(null);
    setNetwork(null);
    setError(null);
    
    // Clear stored connection state
    localStorage.removeItem('kasware_wallet_connected');
    localStorage.removeItem('kasware_wallet_address');
    
    console.log('✅ Disconnected from Kasware Wallet');
  }, []);

  // Get wallet balance
  const getBalanceInternal = useCallback(async () => {
    try {
      const wallet = getWallet();
      if (!wallet || !isConnected) return;

      const balanceInfo = await wallet.getBalance();
      
      // Ensure all balance values are valid numbers
      const safeBalance = {
        confirmed: typeof balanceInfo.confirmed === 'number' ? balanceInfo.confirmed : 0,
        unconfirmed: typeof balanceInfo.unconfirmed === 'number' ? balanceInfo.unconfirmed : 0,
        total: typeof balanceInfo.total === 'number' ? balanceInfo.total : 0
      };
      
      setBalance(safeBalance);
      console.log('💰 Balance updated:', safeBalance);
    } catch (err) {
      console.warn('⚠️ Failed to get balance:', err);
      // Set safe default balance on error
      setBalance({ confirmed: 0, unconfirmed: 0, total: 0 });
    }
  }, [getWallet, isConnected]);

  // Public method to refresh balance
  const getBalance = useCallback(async () => {
    await getBalanceInternal();
  }, [getBalanceInternal]);

  // Sign message
  const signMessage = useCallback(async (message: string, type: 'ecdsa' | 'bip322-simple' = 'ecdsa') => {
    try {
      const wallet = getWallet();
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      if (!isConnected) {
        throw new Error('Please connect your wallet first');
      }

      console.log('✍️ Signing message with Kasware Wallet...');
      const signature = await wallet.signMessage(message, type);
      console.log('✅ Message signed successfully');
      
      return signature;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign message';
      console.error('❌ Message signing failed:', errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, [getWallet, isConnected]);

  // Handle account changes
  const handleAccountsChanged = useCallback((accounts: string[]) => {
    console.log('🔄 Accounts changed:', accounts);
    
    if (accounts.length === 0) {
      // User disconnected from wallet extension
      disconnect();
    } else if (accounts[0] !== address) {
      // Account switched - only update if user hasn't manually disconnected
      if (!userDisconnected) {
        setAddress(accounts[0]);
        localStorage.setItem('kasware_wallet_address', accounts[0]);
        
        // Refresh balance for new account
        getBalanceInternal();
      }
    }
  }, [address, disconnect, getBalanceInternal, userDisconnected]);

  // Handle network changes
  const handleNetworkChanged = useCallback((newNetwork: string) => {
    console.log('🌐 Network changed:', newNetwork);
    setNetwork(newNetwork);
    
    // Refresh balance when network changes (only if connected and user hasn't disconnected)
    if (!userDisconnected) {
      getBalanceInternal();
    }
  }, [getBalanceInternal, userDisconnected]);

  // Auto-reconnect on page load (but respect user disconnection)
  const autoReconnect = useCallback(async () => {
    // Don't auto-reconnect if user manually disconnected
    if (userDisconnected) {
      console.log('🚫 Skipping auto-reconnect - user manually disconnected');
      return;
    }

    const wasConnected = localStorage.getItem('kasware_wallet_connected') === 'true';
    const storedAddress = localStorage.getItem('kasware_wallet_address');
    
    if (wasConnected && storedAddress && checkWalletInstallation()) {
      try {
        const wallet = getWallet();
        if (!wallet) return;

        // Check if we still have access to accounts
        const accounts = await wallet.getAccounts();
        
        if (accounts.includes(storedAddress)) {
          console.log('🔄 Auto-reconnecting to Kasware Wallet...');
          
          const [pubKey, networkInfo] = await Promise.all([
            wallet.getPublicKey().catch(() => null),
            wallet.getNetwork().catch(() => 'mainnet')
          ]);

          setAddress(storedAddress);
          setPublicKey(pubKey);
          setNetwork(networkInfo);
          setIsConnected(true);
          
          await getBalanceInternal();
          
          console.log('✅ Auto-reconnected to Kasware Wallet');
        } else {
          // Stored address no longer available, clear storage
          localStorage.removeItem('kasware_wallet_connected');
          localStorage.removeItem('kasware_wallet_address');
        }
      } catch (err) {
        console.warn('⚠️ Auto-reconnect failed:', err);
        // Clear stored connection state on auto-reconnect failure
        localStorage.removeItem('kasware_wallet_connected');
        localStorage.removeItem('kasware_wallet_address');
      }
    }
  }, [checkWalletInstallation, getWallet, getBalanceInternal, userDisconnected]);

  // Setup wallet event listeners
  useEffect(() => {
    const wallet = getWallet();
    if (!wallet) return;

    // Set up event listeners
    wallet.on('accountsChanged', handleAccountsChanged);
    wallet.on('networkChanged', handleNetworkChanged);

    // Cleanup function
    return () => {
      wallet.removeListener('accountsChanged', handleAccountsChanged);
      wallet.removeListener('networkChanged', handleNetworkChanged);
    };
  }, [getWallet, handleAccountsChanged, handleNetworkChanged]);

  // Initialize on mount
  useEffect(() => {
    // Check installation immediately
    checkWalletInstallation();
    
    // Try auto-reconnect after a short delay to ensure wallet is loaded
    // But only if user hasn't manually disconnected
    const timer = setTimeout(() => {
      autoReconnect();
    }, 1000);

    return () => clearTimeout(timer);
  }, [checkWalletInstallation, autoReconnect]);

  // Periodic balance updates when connected (but respect user disconnection)
  useEffect(() => {
    if (!isConnected || userDisconnected) return;

    const interval = setInterval(() => {
      getBalanceInternal();
    }, 30000); // Update balance every 30 seconds

    return () => clearInterval(interval);
  }, [isConnected, getBalanceInternal, userDisconnected]);

  const contextValue: KaswareWalletContextType = {
    // State
    isInstalled,
    isConnected,
    isConnecting,
    address,
    publicKey,
    balance,
    network,
    
    // Methods
    connect,
    disconnect,
    signMessage,
    getBalance,
    
    // Error handling
    error,
    clearError
  };

  return (
    <KaswareWalletContext.Provider value={contextValue}>
      {children}
    </KaswareWalletContext.Provider>
  );
}

// Utility function to format Kaspa amounts - FIXED to handle non-numbers
export function formatKaspaAmount(amount: number | string | null | undefined): string {
  // Convert to number and handle invalid values
  const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  
  // Check if it's a valid number
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return '0 KAS';
  }

  if (numAmount >= 1000000) {
    return `${(numAmount / 1000000).toFixed(2)}M KAS`;
  } else if (numAmount >= 1000) {
    return `${(numAmount / 1000).toFixed(2)}K KAS`;
  } else {
    return `${numAmount.toFixed(2)} KAS`;
  }
}

// Utility function to truncate Kaspa addresses
export function truncateAddress(address: string, startLength = 6, endLength = 4): string {
  if (!address || address.length <= startLength + endLength) {
    return address || '';
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}