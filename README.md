# NFT Listings API

A secure and scalable REST API for managing NFT listings with Kaspa blockchain integration. This API provides comprehensive CRUD operations, authentication, and automatic synchronization with external NFT marketplaces.

## Features

- **🔐 Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **📊 Database Integration**: Supabase with Row Level Security (RLS) policies
- **🚀 Auto-Sync**: Automatic synchronization with Kaspa API for live NFT listings
- **📝 API Documentation**: Complete OpenAPI/Swagger documentation
- **🛡️ Security Measures**: Rate limiting, input validation, CORS, and security headers
- **📋 Comprehensive Logging**: Winston-based logging with rotation
- **🔄 Background Jobs**: Scheduled tasks for data synchronization

## Quick Start

### Prerequisites

- Node.js 18+ 
- Supabase account and project
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your Supabase credentials and other configuration:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   JWT_SECRET=your_jwt_secret_key_here
   ```

3. **Set up the database:**
   - The migration file will create all necessary tables with proper indexes and RLS policies
   - Connect to Supabase and run the migration in `supabase/migrations/create_tables.sql`

4. **Start the development server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000` with documentation at `http://localhost:3000/api-docs`.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Listings Management
- `GET /api/listings` - Get all active listings (with pagination and filtering)
- `GET /api/listings/:id` - Get specific listing by ID
- `POST /api/listings` - Create new listing
- `PUT /api/listings/:id` - Update existing listing
- `DELETE /api/listings/:id` - Move listing to historical (soft delete)
- `GET /api/listings/historical` - Get historical listings

### Health Check
- `GET /health` - API health status

## Authentication

All API endpoints (except auth and health) require a valid JWT token:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/listings
```

## Database Schema

### Users Table
- User authentication and role management
- Secure password hashing with bcrypt
- Role-based access control (user/admin)

### Active Listings Table
- Current NFT listings from manual input and Kaspa API
- Complete listing metadata (price, rarity, wallet address)
- Automatic timestamps and user tracking

### Historical Listings Table
- Archive of deactivated listings
- Reason tracking (sold, cancelled, expired, etc.)
- Full audit trail preservation

## Kaspa Integration

The API automatically syncs with Kaspa's NFT marketplace:

- **Scheduled Sync**: Every 5 minutes via cron job
- **Smart Updates**: Only adds new listings and removes sold/cancelled ones
- **Historical Tracking**: Automatically moves deactivated listings to historical table
- **Rate Limiting**: Respects API rate limits with proper delays

### Supported Collections
- KASPUNKS (configurable in `src/services/kaspaService.js`)

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Comprehensive validation using Joi and express-validator
- **SQL Injection Protection**: Parameterized queries via Supabase
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet.js for security headers
- **Row Level Security**: Database-level access control

## Development

### Project Structure
```
src/
├── config/          # Database and configuration
├── middleware/      # Authentication, validation, error handling  
├── routes/          # API route definitions
├── services/        # Business logic and external API integration
├── utils/           # Utilities (logging, swagger)
└── server.js        # Main application entry point
```

### Adding New NFT Collections

1. Add ticker to the `tickers` array in `src/services/kaspaService.js`
2. The sync process will automatically handle the new collection
3. Update API documentation if needed

### Running Tests

```bash
npm test
```

### Production Deployment

1. Set `NODE_ENV=production`
2. Configure production Supabase instance
3. Set up proper logging infrastructure
4. Configure reverse proxy (nginx/cloudflare)
5. Set up SSL certificates
6. Configure monitoring and alerting

## Monitoring & Logging

- **Winston Logging**: Structured JSON logs with rotation
- **Request Logging**: Morgan middleware for HTTP request logging
- **Error Tracking**: Comprehensive error logging with stack traces
- **Health Checks**: Built-in health endpoint for monitoring

## API Documentation

Complete API documentation is available at `/api-docs` when the server is running. The documentation includes:

- All endpoint specifications
- Request/response schemas
- Authentication requirements
- Example requests and responses
- Error codes and messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## License

This project is licensed under the MIT License.