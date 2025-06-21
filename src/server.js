import 'dotenv/config'
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cron from 'node-cron';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import listingsRoutes, { getAllSalesHistoryHandler } from './routes/listings.js';
import syncRoutes from './routes/syncRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { setupSwagger } from './utils/swagger.js';
import { logger } from './utils/logger.js';
import { testConnection } from './config/database.js';
import { syncKaspaListings } from './services/syncOrchestrator.js';
import { syncKaspunkOwners } from './services/kaspaDbSync.js';
import { authenticate } from './middleware/auth.js';
import { validatePagination } from './middleware/validation.js';

// Force rebuild
console.log('Application starting...'); //log message for Railway

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load package.json safely
let packageJson = { version: '1.0.0', name: 'NFT Listings API' };
try {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageData = fs.readFileSync(packagePath, 'utf8');
  packageJson = JSON.parse(packageData);
} catch (error) {
  logger.warn('Could not load package.json, using defaults');
}

const app = express();

// Configure CORS explicitly for Railway deployment
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
    'http://localhost:5174',
    'https://localhost:5173',
    'https://kpp2-prod.up.railway.app',
    /^https:\/\/.*\.netlify\.app$/,
    /^https:\/\/.*\.vercel\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'NFT Listings API',
    version: packageJson.version,
    description: 'API for managing NFT listings and marketplace data',
    documentation: '/api-docs',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      listings: '/api/listings',
      salesHistory: '/api/sales-history',
      sync: '/api/sync'
    }
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      database: dbConnected ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development',
      kaspaSyncEnabled: process.env.KASPA_SYNC_ENABLED === 'true',
      backendUpdatesDisabled: process.env.DISABLE_BACKEND_UPDATES_ON_LOCALHOST === 'true',
      mode: 'webcontainer'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      database: 'error',
      error: error.message,
      mode: 'webcontainer'
    });
  }
});

// Setup Swagger documentation
setupSwagger(app);

// Add redirect for common API docs URL mistakes
app.get('/%20api-docs', (req, res) => {
  res.redirect('/api-docs');
});

app.get('/api-docs/', (req, res) => {
  res.redirect('/api-docs');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/sync', syncRoutes);

// Add direct route for /api/sales-history to fix the routing issue
app.get('/api/sales-history', authenticate, validatePagination, getAllSalesHistoryHandler);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Setup periodic sync
const setupPeriodicSync = () => {
  // Check if sync is enabled
  if (process.env.KASPA_SYNC_ENABLED !== 'true') {
    logger.info('Kaspa periodic sync is disabled via KASPA_SYNC_ENABLED environment variable');
    return;
  }

  // Check if backend updates should be disabled on localhost
  const isLocalhost = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const disableUpdatesOnLocalhost = process.env.DISABLE_BACKEND_UPDATES_ON_LOCALHOST === 'true';
  
  if (isLocalhost && disableUpdatesOnLocalhost) {
    logger.info('Periodic syncs are disabled for local development via DISABLE_BACKEND_UPDATES_ON_LOCALHOST environment variable');
    return;
  }

  logger.info('Setting up periodic Kaspa sync...');
  
  // Schedule listings sync to run every 15 minutes
  // Cron format: minute hour day month day-of-week
  // '*/15 * * * *' means every 15 minutes
  const listingsSyncJob = cron.schedule('*/15 * * * *', async () => {
    logger.info('🔄 Starting scheduled Kaspa listings sync...');
    
    try {
      const results = await syncKaspaListings();
      
      logger.info('✅ Scheduled listings sync completed successfully:', {
        added: results.added,
        updated: results.updated,
        removed: results.removed,
        errors: results.errors,
        noChange: results.noChange,
        finalDatabaseCount: results.finalDatabaseCount,
        duration: results.durationSeconds
      });
      
      if (results.errors > 0) {
        logger.warn(`⚠️ ${results.errors} errors occurred during scheduled listings sync`);
      }
      
    } catch (error) {
      logger.error('💥 Scheduled listings sync failed:', error);
    }
  }, {
    scheduled: false, // Don't start immediately
    timezone: 'UTC'
  });

  // Schedule Kaspunk owners sync to run every 6 hours
  // '0 */6 * * *' means at minute 0 of every 6th hour
  const ownersAndStatsSyncJob = cron.schedule('0 */6 * * *', async () => {
    logger.info('🧑‍🤝‍🧑 Starting scheduled Kaspunk owners and stats sync...');
    
    try {
      const results = await syncKaspunkOwners();
      
      logger.info('✅ Scheduled Kaspunk owners sync completed successfully:', {
        totalHolders: results.totalHolders,
        processedHolders: results.processedHolders,
        addedHolders: results.addedHolders,
        updatedHolders: results.updatedHolders,
        errors: results.errors,
        duration: results.durationSeconds
      });
      
      if (results.errors > 0) {
        logger.warn(`⚠️ ${results.errors} errors occurred during scheduled owners sync`);
      }
      
    } catch (error) {
      logger.error('💥 Scheduled Kaspunk owners sync failed:', error);
    }
  }, {
    scheduled: false, // Don't start immediately
    timezone: 'UTC'
  });

  // Start the cron jobs
  listingsSyncJob.start();
  ownersAndStatsSyncJob.start();
  
  logger.info('✅ Periodic syncs scheduled:');
  logger.info('  - Listings sync: every 15 minutes');
  logger.info('  - Kaspunk owners sync: every 6 hours');
  
  // Run initial syncs after a short delay (30 seconds after server start)
  // IMPORTANT: Only run initial syncs if not disabled for localhost
  if (!(isLocalhost && disableUpdatesOnLocalhost)) {
    setTimeout(async () => {
      logger.info('🚀 Running initial Kaspa listings sync...');
      
      try {
        const results = await syncKaspaListings();
        
        logger.info('✅ Initial listings sync completed successfully:', {
          added: results.added,
          updated: results.updated,
          removed: results.removed,
          errors: results.errors,
          noChange: results.noChange,
          finalDatabaseCount: results.finalDatabaseCount,
          duration: results.durationSeconds
        });
        
      } catch (error) {
        logger.error('💥 Initial listings sync failed:', error);
      }

      // Run initial Kaspunk owners sync after listings sync (with a small delay)
      setTimeout(async () => {
        logger.info('🧑‍🤝‍🧑 Running initial Kaspunk owners sync...');
        
        try {
          const results = await syncKaspunkOwners();
          
          logger.info('✅ Initial Kaspunk owners sync completed successfully:', {
            totalHolders: results.totalHolders,
            processedHolders: results.processedHolders,
            addedHolders: results.addedHolders,
            updatedHolders: results.updatedHolders,
            errors: results.errors,
            duration: results.durationSeconds
          });
          
        } catch (error) {
          logger.error('💥 Initial Kaspunk owners sync failed:', error);
        }
      }, 15000); // 15 seconds after listings sync
      
    }, 30000); // 30 seconds after server start
  } else {
    logger.info('⏭️ Skipping initial syncs due to DISABLE_BACKEND_UPDATES_ON_LOCALHOST setting');
  }

  return { listingsSyncJob, ownersAndStatsSyncJob };
};

// Start server with relaxed database connection requirements for WebContainer
const startServer = async () => {
  try {
    logger.info('Starting server in WebContainer mode...');
    
    // Validate environment variables first
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      logger.error('Please check your .env file and ensure all Supabase credentials are properly configured.');
      process.exit(1);
    }
    
    logger.info('Environment variables validated successfully');
    
    // Test database connection but don't fail if it doesn't work (WebContainer limitation)
    logger.info('Testing database connection (non-blocking in WebContainer)...');
    
    try {
      const dbConnected = await testConnection();
      
      if (dbConnected) {
        logger.info('✅ Database connection successful');
      } else {
        logger.warn('⚠️ Database connection failed, but continuing startup (WebContainer mode)');
        logger.warn('💡 The API will still function, but some features may be limited until connection is established');
      }
    } catch (error) {
      logger.warn('⚠️ Database connection test failed, but continuing startup (WebContainer mode):', {
        message: error.message
      });
      logger.warn('💡 This is common in WebContainer environments. The API will still start.');
    }
    
    // Use Railway's PORT or default to 8080 (changed from 3000)
    const PORT = process.env.PORT || 8080;
    
    logger.info(`Attempting to bind to port ${PORT}...`);
    
    // Start the server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✅ Server successfully started on port ${PORT}`);
      logger.info(`🌐 Server accessible at: http://0.0.0.0:${PORT}`);
      logger.info(`📚 API Documentation available at: http://0.0.0.0:${PORT}/api-docs`);
      logger.info(`🔄 Sync Operations available at: http://0.0.0.0:${PORT}/api/sync`);
      logger.info('🚀 Server startup completed successfully (WebContainer mode)');
      
      // Setup periodic sync after server is running (only if database connection works)
      setTimeout(async () => {
        try {
          const dbConnected = await testConnection();
          if (dbConnected) {
            setupPeriodicSync();
          } else {
            logger.info('⏭️ Skipping periodic sync setup due to database connection issues');
          }
        } catch (error) {
          logger.info('⏭️ Skipping periodic sync setup due to database connection issues');
        }
      }, 5000); // Wait 5 seconds before trying sync setup
    });

    // Handle server startup errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use`);
        logger.error('💡 This usually means another instance is running or the port is occupied');
        process.exit(1);
      } else if (error.code === 'EACCES') {
        logger.error(`❌ Permission denied to bind to port ${PORT}`);
        logger.error('💡 Try using a port number above 1024 or run with appropriate permissions');
        process.exit(1);
      } else {
        logger.error('❌ Server startup failed:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    logger.error('Failed to start server:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    process.exit(1);
  }
};

// Graceful shutdown handling
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

export default app;