import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NFT Listings API',
      version: '1.0.0',
      description: 'A secure and scalable REST API for managing NFT listings with Kaspa integration',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://your-api-domain.com' 
          : `http://localhost:${process.env.PORT || 3000}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        Listing: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            kaspa_order_id: {
              type: 'string',
              example: '67bc5b09a4146fc476886651'
            },
            ticker: {
              type: 'string',
              example: 'KASPUNKS'
            },
            token_id: {
              type: 'string',
              example: '1'
            },
            total_price: {
              type: 'number',
              example: 50000
            },
            seller_wallet_address: {
              type: 'string',
              example: 'kaspa:qrk2n5fu5mhjy9ca6p8uuqe9jl6u3fldrm0sj8g7rtvgfjze7ehzgugs0684s'
            },
            rarity_rank: {
              type: 'integer',
              example: 356
            },
            required_kaspa: {
              type: 'number',
              example: 50629
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        KaspaCompletedOrder: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '67ac1571b9e42feeebf53667'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-02-12T03:28:49.442Z'
            },
            isOwner: {
              type: 'boolean',
              example: false
            },
            ticker: {
              type: 'string',
              example: 'KASPUNKS'
            },
            tokenId: {
              type: 'string',
              example: '452'
            },
            totalPrice: {
              type: 'number',
              example: 125000
            },
            sellerWalletAddress: {
              type: 'string',
              example: 'kaspa:qzmpkgq3ktrv4u72zkf9t9ve6gqq8wqwann32kj47czpup08jrw267u4unpe6'
            },
            rarityRank: {
              type: 'integer',
              example: 49
            },
            requiredKaspa: {
              type: 'number',
              example: 126566.5
            },
            fullfillmentTimestamp: {
              type: 'number',
              example: 1740259022454,
              description: 'Unix timestamp in milliseconds when the order was fulfilled'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            email: {
              type: 'string',
              format: 'email'
            },
            role: {
              type: 'string',
              enum: ['user', 'admin']
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js'] // Path to the API files
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      
      /* Custom header */
      .swagger-ui::before {
        content: '';
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 80px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      
      .swagger-ui::after {
        content: '🎨 NFT Listings API';
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 80px;
        line-height: 80px;
        text-align: center;
        font-size: 24px;
        font-weight: bold;
        color: white;
        z-index: 1001;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        letter-spacing: 1px;
      }
      
      /* Adjust main content to account for fixed header */
      .swagger-ui .wrapper {
        padding-top: 100px;
      }
      
      /* Style the info section */
      .swagger-ui .info {
        margin-top: 20px;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid #667eea;
      }
      
      .swagger-ui .info .title {
        color: #333;
        font-size: 28px;
        margin-bottom: 10px;
      }
      
      .swagger-ui .info .description {
        color: #666;
        font-size: 16px;
        line-height: 1.6;
      }
      
      /* Style operation sections */
      .swagger-ui .opblock {
        border-radius: 8px;
        margin-bottom: 15px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .swagger-ui .opblock.opblock-get .opblock-summary {
        background: rgba(97, 175, 254, 0.1);
        border-color: #61affe;
      }
      
      .swagger-ui .opblock.opblock-post .opblock-summary {
        background: rgba(73, 204, 144, 0.1);
        border-color: #49cc90;
      }
      
      .swagger-ui .opblock.opblock-put .opblock-summary {
        background: rgba(252, 161, 48, 0.1);
        border-color: #fca130;
      }
      
      .swagger-ui .opblock.opblock-delete .opblock-summary {
        background: rgba(249, 62, 62, 0.1);
        border-color: #f93e3e;
      }
      
      /* Style the authorize button */
      .swagger-ui .auth-wrapper .authorize {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        border-radius: 6px;
        color: white;
        font-weight: bold;
        padding: 8px 16px;
        transition: all 0.3s ease;
      }
      
      .swagger-ui .auth-wrapper .authorize:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      }
      
      /* Custom scrollbar */
      .swagger-ui ::-webkit-scrollbar {
        width: 8px;
      }
      
      .swagger-ui ::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }
      
      .swagger-ui ::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 4px;
      }
      
      .swagger-ui ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
      }
      
      /* Responsive design */
      @media (max-width: 768px) {
        .swagger-ui::after {
          font-size: 18px;
          height: 60px;
          line-height: 60px;
        }
        
        .swagger-ui::before {
          height: 60px;
        }
        
        .swagger-ui .wrapper {
          padding-top: 80px;
        }
      }
    `,
    customSiteTitle: 'NFT Listings API Documentation'
  }));
  
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};