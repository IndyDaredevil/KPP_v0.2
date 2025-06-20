import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { api } from '../lib/api';
import type { LoginRequest, RegisterRequest, User } from '../types/api';

// Initialize Supabase client with error handling
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Environment check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'undefined',
  nodeEnv: import.meta.env.MODE,
  allEnvVars: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'undefined',
    availableEnvVars: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
  });
  throw new Error('Missing Supabase configuration. Please check your environment variables. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.');
}

// Validate Supabase URL format
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  console.error('Invalid Supabase URL format:', supabaseUrl);
  throw new Error('Invalid Supabase URL format. Expected format: https://your-project.supabase.co');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'X-Client-Info': 'nft-listings-frontend'
    }
  }
});

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const queryClient = useQueryClient();

  // Helper function to safely get user details from backend
  const getUserDetails = async (session: any): Promise<User | null> => {
    if (!session?.access_token) {
      console.warn('No access token available for user details fetch');
      return null;
    }

    try {
      // Store the session token for future API calls
      localStorage.setItem('supabase_token', session.access_token);

      // Get user details from our backend with retry logic, passing token directly
      let retryCount = 0;
      const maxRetries = 3;
      let response;

      while (retryCount < maxRetries) {
        try {
          // Pass the token directly to avoid race condition
          response = await api.getCurrentUser(session.access_token);
          if (response.success && response.data) {
            return response.data.user;
          }
          throw new Error(response.message || 'Failed to get user details');
        } catch (error: any) {
          retryCount++;
          if (retryCount >= maxRetries) {
            console.error('Failed to get user details after retries:', error.message || error);
            return null;
          }
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }

      return null;
    } catch (error: any) {
      console.error('Error fetching user details:', error.message || error);
      return null;
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        if (session?.user) {
          const userDetails = await getUserDetails(session);
          
          if (userDetails) {
            setAuthState({
              user: userDetails,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            console.warn('Failed to get user details, but session exists');
            // Clear stored token if we can't get user details
            localStorage.removeItem('supabase_token');
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } else {
          // Clear stored token
          localStorage.removeItem('supabase_token');
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      }
    );

    // Check for existing session on mount
    const checkSession = async () => {
      try {
        console.log('Checking existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          localStorage.removeItem('supabase_token');
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return;
        }

        if (session?.user) {
          const userDetails = await getUserDetails(session);
          
          if (userDetails) {
            setAuthState({
              user: userDetails,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            console.warn('Failed to get user details during session check');
            localStorage.removeItem('supabase_token');
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } else {
          localStorage.removeItem('supabase_token');
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } catch (error: any) {
        console.error('Error checking session:', error.message || error);
        localStorage.removeItem('supabase_token');
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  // Login mutation - use Supabase directly instead of backend API
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      console.log('Attempting login with Supabase...');
      
      try {
        // Use Supabase Auth directly with timeout
        const { data, error } = await Promise.race([
          supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Login request timed out')), 10000)
          )
        ]) as any;

        if (error) {
          console.error('Supabase auth error:', error);
          throw new Error(error.message);
        }

        if (!data.user || !data.session) {
          throw new Error('Login failed - no user or session returned');
        }

        console.log('Login successful, getting user details...');

        const userDetails = await getUserDetails(data.session);
        
        if (!userDetails) {
          throw new Error('Failed to fetch user details after login');
        }

        return {
          success: true,
          data: {
            user: userDetails,
            session: data.session
          }
        };
      } catch (error: any) {
        console.error('Login error:', error);
        
        // Provide more specific error messages
        if (error.message === 'Failed to fetch') {
          throw new Error('Unable to connect to authentication service. Please check your internet connection and try again.');
        } else if (error.message === 'Login request timed out') {
          throw new Error('Login request timed out. Please try again.');
        } else if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        }
        
        throw error;
      }
    },
    onSuccess: (response) => {
      if (response.success) {
        console.log('Login mutation successful');
        setAuthState({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
        queryClient.invalidateQueries();
      }
    },
    onError: (error) => {
      console.error('Login failed:', error);
      localStorage.removeItem('supabase_token');
    },
  });

  // Register mutation - use Supabase directly
  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterRequest) => {
      console.log('Attempting registration with Supabase...');
      
      try {
        // Use Supabase Auth directly with timeout
        const { data, error } = await Promise.race([
          supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
              emailRedirectTo: undefined // Disable email confirmation
            }
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Registration request timed out')), 10000)
          )
        ]) as any;

        if (error) {
          console.error('Supabase registration error:', error);
          throw new Error(error.message);
        }

        if (!data.user) {
          throw new Error('Registration failed - no user returned');
        }

        return {
          success: true,
          message: 'Registration successful',
          data: { user: data.user }
        };
      } catch (error: any) {
        console.error('Registration error:', error);
        
        // Provide more specific error messages
        if (error.message === 'Failed to fetch') {
          throw new Error('Unable to connect to authentication service. Please check your internet connection and try again.');
        } else if (error.message === 'Registration request timed out') {
          throw new Error('Registration request timed out. Please try again.');
        }
        
        throw error;
      }
    },
    onSuccess: (response) => {
      if (response.success) {
        console.log('Registration successful:', response.message);
      }
    },
    onError: (error) => {
      console.error('Registration failed:', error);
    },
  });

  // Logout function
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('supabase_token');
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      queryClient.clear();
    } catch (error) {
      console.error('Logout failed:', error);
      // Force logout locally even if server call fails
      localStorage.removeItem('supabase_token');
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      queryClient.clear();
    }
  };

  return {
    ...authState,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
  };
};

// Health check hook (keeping original functionality)
export const useHealthCheck = () => {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 30000, // Check every 30 seconds
    retry: 3,
  });
};