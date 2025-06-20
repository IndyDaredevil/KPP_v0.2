import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, ensureAuthentication } from '../lib/supabase';
import { useKaswareWallet } from './KaswareWalletProvider';
import { LoadingSpinner } from '../packages/kaspunk-ui';

// Access levels for the multi-tier system
export type AccessLevel = 'public' | 'wallet' | 'token_holder' | 'admin';
export type UserRole = 'user' | 'token_holder' | 'admin';

interface AuthContextType {
  // Supabase auth
  session: Session | null;
  user: User | null;
  loading: boolean;
  isPublicMode: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  
  // Access control
  accessLevel: AccessLevel;
  userRole: UserRole;
  hasAccess: (requiredLevel: AccessLevel) => boolean;
  
  // Wallet integration
  isWalletConnected: boolean;
  walletAddress: string | null;
  
  // Role-based access
  hasRequiredToken: boolean;
  isAdmin: boolean;
  
  // Methods
  authenticateWithWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Supabase auth state
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPublicMode, setIsPublicMode] = useState(false);
  
  // Role-based access control state
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('public');
  
  // Get wallet context
  const { 
    isConnected: isWalletConnected, 
    address: walletAddress,
    signMessage 
  } = useKaswareWallet();

  // Derived states from role
  const isAdmin = userRole === 'admin';
  const hasRequiredToken = userRole === 'token_holder' || userRole === 'admin';

  // Determine access level based on current state
  const determineAccessLevel = (): AccessLevel => {
    if (isAdmin) return 'admin';
    if (hasRequiredToken) return 'token_holder';
    if (isWalletConnected) return 'wallet';
    return 'public';
  };

  // Check if user has access to a specific level
  const hasAccess = (requiredLevel: AccessLevel): boolean => {
    const levels: AccessLevel[] = ['public', 'wallet', 'token_holder', 'admin'];
    const currentLevelIndex = levels.indexOf(accessLevel);
    const requiredLevelIndex = levels.indexOf(requiredLevel);
    
    return currentLevelIndex >= requiredLevelIndex;
  };

  // Check role by wallet address (PRIMARY authentication method)
  const checkRoleByWallet = async (address: string): Promise<UserRole> => {
    try {
      console.log('🔍 Checking role by wallet address:', address);
      
      // Call the RPC function that returns a simple text value
      const { data, error } = await supabase.rpc('get_role_by_wallet', {
        p_wallet_address: address
      });

      if (error) {
        console.warn('⚠️ Error checking role by wallet:', error);
        return 'user';
      }

      // The function now returns a simple string, not JSON
      const role = data as UserRole;
      console.log('✅ Role by wallet:', role);
      return role || 'user';
    } catch (error) {
      console.warn('⚠️ Error in checkRoleByWallet:', error);
      return 'user';
    }
  };

  // Authenticate with wallet signature (optional - for enhanced security)
  const authenticateWithWallet = async (): Promise<void> => {
    if (!isWalletConnected || !walletAddress) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('🔐 Authenticating with wallet signature...');
      
      // Create authentication message
      const timestamp = Date.now();
      const message = `Sign this message to authenticate with KasPunk Predictor.\n\nTimestamp: ${timestamp}\nAddress: ${walletAddress}`;
      
      // Sign message with wallet
      const signature = await signMessage(message);
      
      console.log('✅ Wallet authentication successful');
      
      // Check if this wallet has a role assigned
      const walletRole = await checkRoleByWallet(walletAddress);
      setUserRole(walletRole);
      
      console.log('🎯 Wallet role set:', walletRole);
      
    } catch (error) {
      console.error('❌ Wallet authentication failed:', error);
      throw error;
    }
  };

  // Update access level when dependencies change
  useEffect(() => {
    const newAccessLevel = determineAccessLevel();
    setAccessLevel(newAccessLevel);
    console.log('🔑 Access level updated:', newAccessLevel);
  }, [isWalletConnected, userRole]);

  // 🎯 PRIMARY AUTHENTICATION: Check wallet role when wallet connects
  useEffect(() => {
    if (walletAddress && isWalletConnected) {
      console.log('🔗 Wallet connected, checking role automatically...');
      
      // Automatically check role when wallet connects
      const timeoutId = setTimeout(async () => {
        try {
          const walletRole = await checkRoleByWallet(walletAddress);
          setUserRole(walletRole);
          console.log('🎯 Auto-assigned role based on wallet:', walletRole);
        } catch (error) {
          console.warn('⚠️ Failed to auto-check wallet role:', error);
          setUserRole('user');
        }
      }, 500); // Small delay to prevent rapid calls
      
      return () => clearTimeout(timeoutId);
    } else if (!isWalletConnected) {
      // Reset to default when wallet disconnects
      setUserRole('user');
      console.log('🔌 Wallet disconnected, reset to user role');
    }
  }, [walletAddress, isWalletConnected]);

  const refreshAuth = async () => {
    try {
      console.log('🔧 Refreshing authentication...');
      const authResult = await ensureAuthentication();
      
      if (authResult.success && authResult.session) {
        setSession(authResult.session);
        setUser(authResult.session.user);
        setIsPublicMode(false);
      } else if (authResult.publicMode) {
        console.log('🔧 Operating in public mode');
        setSession(null);
        setUser(null);
        setIsPublicMode(true);
      }
    } catch (error) {
      console.warn('⚠️ Auth refresh failed, enabling public mode:', error);
      setSession(null);
      setUser(null);
      setIsPublicMode(true);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setIsPublicMode(true);
      // Don't reset userRole here - it should persist based on wallet connection
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      // Even if sign out fails, clear local state
      setSession(null);
      setUser(null);
      setIsPublicMode(true);
    }
  };

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        console.log('🔧 Initializing wallet-based authentication...');
        
        // Check for existing session (optional - for enhanced features)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession) {
          console.log('✅ Found existing session');
          setSession(existingSession);
          setUser(existingSession.user);
          setIsPublicMode(false);
        } else {
          console.log('🔧 No existing session, using wallet-based auth');
          await refreshAuth();
        }
      } catch (error) {
        console.warn('⚠️ Auth initialization failed, enabling public mode:', error);
        setSession(null);
        setUser(null);
        setIsPublicMode(true);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes (optional - for enhanced features)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔧 Auth state changed:', event, !!session);
        
        if (session) {
          setSession(session);
          setUser(session.user);
          setIsPublicMode(false);
        } else {
          setSession(null);
          setUser(null);
          setIsPublicMode(true);
        }
        
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setIsPublicMode(true);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#0A2540] to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-[#70C7BA] mt-4">Initializing application...</p>
          <p className="text-[#B6B6B6] text-sm mt-2">
            Setting up wallet-based authentication...
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      // Supabase auth
      session, 
      user, 
      loading, 
      isPublicMode, 
      signOut, 
      refreshAuth,
      
      // Access control
      accessLevel,
      userRole,
      hasAccess,
      
      // Wallet integration
      isWalletConnected,
      walletAddress,
      
      // Role-based access
      hasRequiredToken,
      isAdmin,
      
      // Methods
      authenticateWithWallet
    }}>
      {children}
    </AuthContext.Provider>
  );
}