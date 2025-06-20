import { useAuth } from '../components/AuthProvider';
import { useKaswareWallet } from '../components/KaswareWalletProvider';
import { useToast } from '../components/Toast';

export type AccessLevel = 'public' | 'wallet' | 'token_holder' | 'admin';

interface UseAccessControlReturn {
  // Access checks
  hasPublicAccess: boolean;
  hasWalletAccess: boolean;
  hasTokenHolderAccess: boolean;
  hasAdminAccess: boolean;
  
  // Current state
  currentAccessLevel: AccessLevel;
  isWalletConnected: boolean;
  walletAddress: string | null;
  
  // Actions
  requireAccess: (level: AccessLevel, action?: string) => boolean;
  connectWalletForAccess: () => Promise<void>;
  authenticateWithWallet: () => Promise<void>;
  
  // UI helpers
  getAccessLevelDisplay: () => string;
  getAccessLevelColor: () => string;
  getRequiredActionMessage: (level: AccessLevel) => string;
}

export function useAccessControl(): UseAccessControlReturn {
  const { 
    accessLevel, 
    hasAccess, 
    isWalletConnected, 
    walletAddress, 
    hasRequiredToken, 
    isAdmin,
    authenticateWithWallet: authWithWallet
  } = useAuth();
  
  const { connect: connectWallet, isConnecting } = useKaswareWallet();
  const { showToast } = useToast();

  // Access level checks
  const hasPublicAccess = hasAccess('public');
  const hasWalletAccess = hasAccess('wallet');
  const hasTokenHolderAccess = hasAccess('token_holder');
  const hasAdminAccess = hasAccess('admin');

  // Require specific access level
  const requireAccess = (level: AccessLevel, action?: string): boolean => {
    const hasRequiredAccess = hasAccess(level);
    
    if (!hasRequiredAccess) {
      const actionText = action || 'perform this action';
      const message = getRequiredActionMessage(level);
      
      showToast({
        type: 'error',
        title: 'Access Required',
        message: `${message} to ${actionText}.`
      });
      
      return false;
    }
    
    return true;
  };

  // Connect wallet for access
  const connectWalletForAccess = async (): Promise<void> => {
    try {
      if (isConnecting) {
        showToast({
          type: 'info',
          title: 'Connecting...',
          message: 'Wallet connection in progress.'
        });
        return;
      }

      await connectWallet();
      
      showToast({
        type: 'success',
        title: 'Wallet Connected',
        message: 'You now have wallet-level access.'
      });
      
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Connection Failed',
        message: error instanceof Error ? error.message : 'Failed to connect wallet.'
      });
      throw error;
    }
  };

  // Authenticate with wallet signature
  const authenticateWithWallet = async (): Promise<void> => {
    try {
      if (!isWalletConnected) {
        await connectWalletForAccess();
      }
      
      await authWithWallet();
      
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
      throw error;
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

  // Get message for required action
  const getRequiredActionMessage = (level: AccessLevel): string => {
    switch (level) {
      case 'admin':
        return 'Admin access required. Please connect with an admin wallet';
      case 'token_holder':
        return 'Token holder access required. Please connect a wallet with KasPunk tokens';
      case 'wallet':
        return 'Wallet connection required. Please connect your Kasware wallet';
      case 'public':
      default:
        return 'This feature is publicly available';
    }
  };

  return {
    // Access checks
    hasPublicAccess,
    hasWalletAccess,
    hasTokenHolderAccess,
    hasAdminAccess,
    
    // Current state
    currentAccessLevel: accessLevel,
    isWalletConnected,
    walletAddress,
    
    // Actions
    requireAccess,
    connectWalletForAccess,
    authenticateWithWallet,
    
    // UI helpers
    getAccessLevelDisplay,
    getAccessLevelColor,
    getRequiredActionMessage
  };
}