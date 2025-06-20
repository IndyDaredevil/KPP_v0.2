import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin, retrySupabaseCall } from '../config/database.js';
import { logger } from '../utils/logger.js';

// Debug configuration - only show debug logs when explicitly enabled
const DEBUG_ENABLED = process.env.DEBUG_ENABLED === 'true';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (DEBUG_ENABLED) {
      console.log('🔍 Auth Debug - Token received:', token ? `${token.substring(0, 20)}...` : 'No token');
    }
    
    if (!token) {
      if (DEBUG_ENABLED) {
        console.log('❌ Auth Debug - No token provided');
      }
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token with Supabase
    if (DEBUG_ENABLED) {
      console.log('🔍 Auth Debug - Verifying token with Supabase...');
    }
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      if (DEBUG_ENABLED) {
        console.log('❌ Auth Debug - Token verification failed:', error?.message || 'No user found');
      }
      logger.warn('Authentication failed:', error?.message || 'No user found');
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    if (DEBUG_ENABLED) {
      console.log('✅ Auth Debug - Token verified for user:', user.id, user.email);
    }

    // Get user details from our users table using admin client to bypass RLS
    if (DEBUG_ENABLED) {
      console.log('🔍 Auth Debug - Fetching user record from database...');
      console.log('🔍 Auth Debug - Query details:', {
        userId: user.id,
        userEmail: user.email,
        queryTable: 'users',
        queryFields: 'id, email, role'
      });
    }

    const { data: userRecord, error: userError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('users')
        .select('id, email, role')
        .eq('id', user.id)
        .single();
    });

    // Normalize userRecord in case it's returned as an array
    let normalizedUserRecord = userRecord;
    if (Array.isArray(userRecord) && userRecord.length > 0) {
      if (DEBUG_ENABLED) {
        console.log('🔧 Auth Debug - Normalizing array response to single object');
      }
      normalizedUserRecord = userRecord[0];
    }

    if (DEBUG_ENABLED) {
      console.log('🔍 Auth Debug - Raw database response:', {
        data: normalizedUserRecord,
        error: userError,
        errorCode: userError?.code,
        errorMessage: userError?.message
      });
    }

    if (userError) {
      if (DEBUG_ENABLED) {
        console.log('❌ Auth Debug - User record fetch failed:', userError?.message || 'No user record');
      }
      logger.warn('User record not found:', userError?.message || 'No user record');
      
      // If user doesn't exist in our users table, create it
      if (userError.code === 'PGRST116') { // No rows returned
        if (DEBUG_ENABLED) {
          console.log('🔧 Auth Debug - Creating missing user record for authenticated user...');
        }
        
        const { data: newUserRecord, error: createError } = await retrySupabaseCall(async () => {
          return await supabaseAdmin
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              password: 'managed_by_supabase',
              role: 'user'
            })
            .select('id, email, role')
            .single();
        });

        if (createError) {
          if (DEBUG_ENABLED) {
            console.log('❌ Auth Debug - Failed to create user record:', createError.message);
          }
          logger.error('Failed to create user record:', createError);
          return res.status(500).json({
            success: false,
            message: 'Failed to create user record'
          });
        }

        if (DEBUG_ENABLED) {
          console.log('✅ Auth Debug - Created new user record:', {
            id: newUserRecord.id,
            email: newUserRecord.email,
            role: newUserRecord.role
          });
        }

        // Use the newly created user record
        const validRoles = ['user', 'admin'];
        const userRole = newUserRecord.role && validRoles.includes(newUserRecord.role) ? newUserRecord.role : 'user';

        req.user = {
          id: newUserRecord.id,
          email: newUserRecord.email,
          role: userRole
        };
      } else {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
    } else if (!normalizedUserRecord) {
      if (DEBUG_ENABLED) {
        console.log('❌ Auth Debug - User record is null/undefined despite no error');
      }
      return res.status(401).json({
        success: false,
        message: 'User record not found'
      });
    } else {
      if (DEBUG_ENABLED) {
        console.log('✅ Auth Debug - User record found:', {
          id: normalizedUserRecord.id,
          email: normalizedUserRecord.email,
          role: normalizedUserRecord.role,
          roleType: typeof normalizedUserRecord.role,
          hasId: !!normalizedUserRecord.id,
          hasEmail: !!normalizedUserRecord.email,
          hasRole: !!normalizedUserRecord.role
        });
      }

      // Check if any required fields are missing
      if (!normalizedUserRecord.id || !normalizedUserRecord.email) {
        if (DEBUG_ENABLED) {
          console.log('❌ Auth Debug - User record missing required fields');
        }
        logger.error('User record missing required fields:', normalizedUserRecord);
        return res.status(500).json({
          success: false,
          message: 'Invalid user record'
        });
      }

      // Ensure role is valid - default to 'user' if missing, null, or invalid
      const validRoles = ['user', 'admin'];
      const userRole = normalizedUserRecord.role && validRoles.includes(normalizedUserRecord.role) ? normalizedUserRecord.role : 'user';

      if (DEBUG_ENABLED) {
        console.log('🔍 Auth Debug - Role validation:', {
          originalRole: normalizedUserRecord.role,
          finalRole: userRole,
          isAdmin: userRole === 'admin'
        });
      }

      req.user = {
        id: normalizedUserRecord.id,
        email: normalizedUserRecord.email,
        role: userRole
      };
    }

    // Create a user-scoped Supabase client for this request
    // This client will be authenticated with the user's token and respect RLS
    const userSupabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    req.supabaseClient = userSupabaseClient; // Attach the authenticated client to the request
    
    if (DEBUG_ENABLED) {
      console.log('✅ Auth Debug - Authentication successful, user attached to request:', {
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role
      });
    }
    
    next();
  } catch (error) {
    if (DEBUG_ENABLED) {
      console.log('❌ Auth Debug - Authentication error:', error.message);
    }
    logger.error('Authentication error:', error);
    
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (DEBUG_ENABLED) {
      console.log('🔍 Authorization Debug - Checking authorization:', {
        requiredRoles: roles,
        userRole: req.user?.role,
        userId: req.user?.id,
        userEmail: req.user?.email
      });
    }
    
    if (!req.user) {
      if (DEBUG_ENABLED) {
        console.log('❌ Authorization Debug - No user object found in request');
      }
      return res.status(403).json({
        success: false,
        message: 'Access denied. No user information found.'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      if (DEBUG_ENABLED) {
        console.log('❌ Authorization Debug - Role check failed:', {
          userRole: req.user.role,
          requiredRoles: roles,
          hasRequiredRole: roles.includes(req.user.role)
        });
      }
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
    
    if (DEBUG_ENABLED) {
      console.log('✅ Authorization Debug - Authorization successful for role:', req.user.role);
    }
    next();
  };
};