import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bosychqljwqzdiefypxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvc3ljaHFsandxemRpZWZ5cHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5OTk4ODEsImV4cCI6MjA2NDU3NTg4MX0.IaG47L0N6_y0l8uaZX-YlVpxiUXZ23YoQlQQcowna94';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// Public query helper without authentication requirements
export async function publicQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  try {
    console.log('🔍 Executing public query...');
    
    // Execute the query directly without authentication checks
    const result = await queryFn();
    
    if (result.error) {
      console.error('❌ Public query failed:', result.error);
    } else {
      console.log('✅ Public query successful');
    }
    
    return result;
  } catch (err) {
    console.error('❌ Public query execution error:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Query failed'
    };
  }
}

// Enhanced query helper with authentication fallback
export async function authenticatedQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  try {
    console.log('🔍 Executing authenticated query...');
    
    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.warn('⚠️ Session error, falling back to public query:', sessionError);
      return await publicQuery(queryFn);
    }
    
    if (!session) {
      console.warn('⚠️ No active session found, falling back to public query');
      return await publicQuery(queryFn);
    }
    
    console.log('✅ User authenticated, executing query...');
    
    // Execute the query with authentication
    const result = await queryFn();
    
    if (result.error) {
      console.error('❌ Authenticated query failed:', result.error);
      
      // Check for authentication-related errors and fallback to public query
      const errorMessage = result.error.message || '';
      
      if (errorMessage.includes('JWT') || 
          errorMessage.includes('token') || 
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('authentication') ||
          errorMessage.includes('RLS') || 
          errorMessage.includes('policy') || 
          errorMessage.includes('permission')) {
        console.warn('🔄 Authentication/permission error, falling back to public query');
        return await publicQuery(queryFn);
      }
    } else {
      console.log('✅ Authenticated query successful');
    }
    
    return result;
  } catch (err) {
    console.error('❌ Query execution error, falling back to public query:', err);
    return await publicQuery(queryFn);
  }
}

// Helper function to sign in anonymously or with a demo account
export async function ensureAuthentication() {
  console.log('🔧 Attempting authentication...');
  
  try {
    // Check current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      console.log('✅ User already authenticated');
      return { success: true, session };
    }
    
    console.log('🔧 No session found, trying authentication methods...');
    
    // Try to sign in with a demo account
    const demoEmail = 'demo@kaspunkpredictor.com';
    const demoPassword = 'demo123456';
    
    console.log('🔧 Attempting demo account sign-in...');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword
      });
      
      if (!error && data.session) {
        console.log('✅ Demo account authentication successful');
        return { success: true, session: data.session };
      }
      
      console.warn('⚠️ Demo account sign-in failed:', error?.message);
    } catch (signInError) {
      console.warn('⚠️ Demo account sign-in error:', signInError);
    }
    
    // Try anonymous sign-in
    console.log('🔧 Attempting anonymous sign-in...');
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      
      if (!error && data.session) {
        console.log('✅ Anonymous authentication successful');
        return { success: true, session: data.session };
      }
      
      console.warn('⚠️ Anonymous sign-in failed:', error?.message);
    } catch (anonError) {
      console.warn('⚠️ Anonymous auth error:', anonError);
    }
    
    // All authentication methods failed, but continue with public access
    console.warn('⚠️ All authentication methods failed, continuing with public access');
    return { 
      success: false, 
      error: 'Authentication unavailable - using public access mode',
      publicMode: true
    };
    
  } catch (error) {
    console.warn('⚠️ Authentication error, continuing with public access:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Authentication failed',
      publicMode: true
    };
  }
}

// Helper function to test database connectivity with authentication
export async function testAuthenticatedConnection() {
  console.log('🔧 Testing database connection...');
  
  try {
    // Try authenticated connection first
    const authResult = await ensureAuthentication();
    
    if (authResult.success) {
      // Test authenticated query
      const { data, error } = await authenticatedQuery(() =>
        supabase.from('tokens').select('token_id').limit(1)
      );
      
      if (!error) {
        console.log('✅ Authenticated database connection successful');
        return { connected: true, authenticated: true, data };
      }
    }
    
    // Fallback to public query test
    console.log('🔄 Testing public database connection...');
    const { data, error } = await publicQuery(() =>
      supabase.from('tokens').select('token_id').limit(1)
    );
    
    if (!error) {
      console.log('✅ Public database connection successful');
      return { connected: true, authenticated: false, data };
    }
    
    console.error('❌ Database connection test failed:', error);
    return { connected: false, error };
    
  } catch (err) {
    console.error('❌ Connection test failed:', err);
    return { 
      connected: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}