import winston from 'winston';

// Change default log level to debug for better visibility
const logLevel = process.env.LOG_LEVEL || 'debug';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'nft-listings-api' },
  transports: [
    // Only console logging to reduce file system usage
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add a helper function for network debugging
logger.networkDebug = (operation, details) => {
  logger.debug(`🌐 [NETWORK] ${operation}`, details);
};

// Add a helper function for API debugging
logger.apiDebug = (service, operation, details) => {
  logger.debug(`📡 [${service.toUpperCase()}] ${operation}`, details);
};