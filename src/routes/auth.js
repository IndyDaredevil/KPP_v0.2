import express from 'express';
import { supabase, supabaseAdmin, retrySupabaseCall } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateUserRegistration, validateUserLogin } from '../middleware/validation.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SecurePass123!
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register', validateUserRegistration, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  try {
    // First check if user already exists in our users table
    const { data: existingUser, error: checkError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('users')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();
    });

    if (checkError && checkError.code !== 'PGRST116') {
      logger.error('Error checking existing user:', checkError);
      return res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.'
      });
    }

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Try to sign up using the regular client (this works with email confirmation disabled)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined // Disable email confirmation
      }
    });

    if (signUpError) {
      logger.error('Supabase signup error:', signUpError);
      
      if (signUpError.message.includes('already registered') || signUpError.message.includes('already been registered')) {
        return res.status(409).json({
          success: false,
          message: 'User already exists with this email'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: signUpError.message
      });
    }

    if (!signUpData.user) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create user account'
      });
    }

    // Create user record in our users table using upsert to handle race conditions
    const { data: userRecord, error: userError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('users')
        .upsert({
          id: signUpData.user.id,
          email: signUpData.user.email,
          password: 'managed_by_supabase', // Placeholder since Supabase manages passwords
          role: 'user'
        }, {
          onConflict: 'email',
          ignoreDuplicates: false
        })
        .select('id, email, role, created_at')
        .single();
    });

    if (userError) {
      logger.error('Error creating user record:', userError);
      
      // For duplicate email errors, try to clean up the auth user if possible
      if (userError.code === '23505') {
        try {
          await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup auth user after database error:', cleanupError);
        }
        
        return res.status(409).json({
          success: false,
          message: 'User already exists with this email'
        });
      }
      
      // For other errors, try to clean up the auth user if possible
      try {
        await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup auth user after database error:', cleanupError);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to complete user registration'
      });
    }

    logger.info(`User registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: userRecord.id,
          email: userRecord.email,
          role: userRecord.role,
          createdAt: userRecord.created_at
        }
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
}));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validateUserLogin, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  try {
    // Use Supabase Auth to sign in user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      logger.warn('Login attempt failed:', { email, error: error.message });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!data.user || !data.session) {
      logger.warn('Login failed - no user or session returned:', { email });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Get user details from our users table using the session token
    const { data: userRecord, error: userError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('users')
        .select('id, email, role, created_at')
        .eq('id', data.user.id)
        .maybeSingle();
    });

    if (userError && userError.code !== 'PGRST116') {
      logger.error('Error fetching user record:', userError);
      return res.status(500).json({
        success: false,
        message: 'Authentication failed'
      });
    }

    // If user doesn't exist in our users table, create it
    if (!userRecord) {
      logger.info('Creating missing user record for authenticated user:', data.user.id);
      
      const { data: newUserRecord, error: createError } = await retrySupabaseCall(async () => {
        return await supabaseAdmin
          .from('users')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            password: 'managed_by_supabase',
            role: 'user'
          }, {
            onConflict: 'email',
            ignoreDuplicates: false
          })
          .select('id, email, role, created_at')
          .single();
      });

      if (createError) {
        logger.error('Failed to create user record for authenticated user:', createError);
        
        // If it's a duplicate email error, try to find the existing user by email
        if (createError.code === '23505') {
          const { data: existingUserRecord, error: findError } = await retrySupabaseCall(async () => {
            return await supabaseAdmin
              .from('users')
              .select('id, email, role, created_at')
              .eq('email', data.user.email)
              .single();
          });

          if (findError) {
            logger.error('Failed to find existing user record:', findError);
            return res.status(500).json({
              success: false,
              message: 'Authentication successful but user setup failed'
            });
          }

          logger.info(`User logged in (found existing record): ${email}`);

          return res.json({
            success: true,
            message: 'Login successful',
            data: {
              user: {
                id: existingUserRecord.id,
                email: existingUserRecord.email,
                role: existingUserRecord.role,
                createdAt: existingUserRecord.created_at
              },
              session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at
              }
            }
          });
        }
        
        return res.status(500).json({
          success: false,
          message: 'Authentication successful but user setup failed'
        });
      }

      logger.info(`User logged in (new record created): ${email}`);

      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: newUserRecord.id,
            email: newUserRecord.email,
            role: newUserRecord.role,
            createdAt: newUserRecord.created_at
          },
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at
          }
        }
      });
    }

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: userRecord.id,
          email: userRecord.email,
          role: userRecord.role,
          createdAt: userRecord.created_at
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at
        }
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
}));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (token) {
    try {
      // Use regular client to sign out
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        logger.warn('Logout error:', error);
      }
    } catch (error) {
      logger.warn('Error during logout:', error);
    }
  }

  logger.info('User logged out');

  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me', asyncHandler(async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Get user details from our users table
    const { data: userRecord, error: userError } = await retrySupabaseCall(async () => {
      return await supabaseAdmin
        .from('users')
        .select('id, email, role, created_at')
        .eq('id', user.id)
        .maybeSingle();
    });

    if (userError && userError.code !== 'PGRST116') {
      logger.error('Error fetching user record:', userError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user details'
      });
    }

    // If user doesn't exist in our users table, create it automatically
    if (!userRecord) {
      logger.info('Creating missing user record for authenticated user:', user.id);
      
      const { data: newUserRecord, error: createError } = await retrySupabaseCall(async () => {
        return await supabaseAdmin
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            password: 'managed_by_supabase',
            role: 'user'
          }, {
            onConflict: 'email',
            ignoreDuplicates: false
          })
          .select('id, email, role, created_at')
          .single();
      });

      if (createError) {
        logger.error('Failed to create user record for authenticated user:', createError);
        
        // If it's a duplicate email error, try to find the existing user by email
        if (createError.code === '23505') {
          const { data: existingUserRecord, error: findError } = await retrySupabaseCall(async () => {
            return await supabaseAdmin
              .from('users')
              .select('id, email, role, created_at')
              .eq('email', user.email)
              .single();
          });

          if (findError) {
            logger.error('Failed to find existing user record:', findError);
            return res.status(500).json({
              success: false,
              message: 'User setup failed'
            });
          }

          logger.info(`User record found for authenticated user: ${user.email}`);

          return res.json({
            success: true,
            data: {
              user: {
                id: existingUserRecord.id,
                email: existingUserRecord.email,
                role: existingUserRecord.role,
                createdAt: existingUserRecord.created_at
              }
            }
          });
        }
        
        return res.status(500).json({
          success: false,
          message: 'User setup failed'
        });
      }

      logger.info(`User record created for authenticated user: ${user.email}`);

      return res.json({
        success: true,
        data: {
          user: {
            id: newUserRecord.id,
            email: newUserRecord.email,
            role: newUserRecord.role,
            createdAt: newUserRecord.created_at
          }
        }
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: userRecord.id,
          email: userRecord.email,
          role: userRecord.role,
          createdAt: userRecord.created_at
        }
      }
    });

  } catch (error) {
    logger.error('Get user error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
}));

export default router;