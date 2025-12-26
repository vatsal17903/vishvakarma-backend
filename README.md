# Vishvakarma CRM - Backend

Node.js/Express backend for Vishvakarma CRM system.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MySQL 8.0+
- **Authentication:** bcrypt + express-session
- **PDF Generation:** PDFKit

## Structure

```
backend/
├── server/
│   ├── index.js           # Main entry point
│   ├── database/
│   │   └── init.js        # Database initialization
│   └── routes/            # API route handlers
│       ├── auth.js
│       ├── clients.js
│       ├── company.js
│       ├── packages.js
│       ├── quotations.js
│       ├── receipts.js
│       ├── bills.js
│       ├── reports.js
│       ├── pdf.js
│       └── sqft-defaults.js
├── .env                   # Environment configuration
├── package.json           # Dependencies
└── generate-secrets.js    # Security secrets generator
```

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.production.example` to `.env` and update:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=vishvakara
PORT=3006
NODE_ENV=development
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret
FRONTEND_URL=http://localhost:5173
```

### 3. Setup MySQL Database
```sql
CREATE DATABASE vishvakara;
```

The application will automatically create tables on first run.

### 4. Start Server
```bash
npm start
```

Server will run on http://localhost:3006

## API Endpoints

### Health Check
- `GET /api/health` - Server health status
- `GET /api` - API information

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/check` - Check auth status
- `POST /api/auth/change-password` - Change password

### Company
- `GET /api/company` - Get all companies
- `GET /api/company/current` - Get current company
- `PUT /api/company/:id` - Update company
- `POST /api/company/:id/logo` - Upload logo

### Clients
- `GET /api/clients` - Get all clients
- `GET /api/clients/:id` - Get client by ID
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Packages
- `GET /api/packages` - Get all packages
- `GET /api/packages/:id` - Get package with items
- `POST /api/packages` - Create package
- `PUT /api/packages/:id` - Update package
- `DELETE /api/packages/:id` - Delete package

### Quotations
- `GET /api/quotations` - Get all quotations
- `GET /api/quotations/:id` - Get quotation details
- `POST /api/quotations` - Create quotation
- `PUT /api/quotations/:id` - Update quotation
- `DELETE /api/quotations/:id` - Delete quotation

### Receipts
- `GET /api/receipts` - Get all receipts
- `GET /api/receipts/:id` - Get receipt by ID
- `GET /api/receipts/quotation/:id` - Get receipts for quotation
- `POST /api/receipts` - Create receipt
- `PUT /api/receipts/:id` - Update receipt
- `DELETE /api/receipts/:id` - Delete receipt

### Bills
- `GET /api/bills` - Get all bills
- `GET /api/bills/:id` - Get bill by ID
- `POST /api/bills` - Create bill
- `PUT /api/bills/:id` - Update bill
- `DELETE /api/bills/:id` - Delete bill

### Reports
- `GET /api/reports/quotations` - Quotation reports
- `GET /api/reports/receipts` - Receipt reports
- `GET /api/reports/clients` - Client reports

### PDF Generation
- `POST /api/pdf/quotation/:id` - Generate quotation PDF
- `POST /api/pdf/receipt/:id` - Generate receipt PDF
- `POST /api/pdf/bill/:id` - Generate bill PDF

## Database Schema

### Tables
- `users` - System users
- `companies` - Company profiles
- `clients` - Client information
- `packages` - Service packages
- `package_items` - Package line items
- `quotations` - Price quotations
- `quotation_items` - Quotation line items
- `quotation_column_config` - Custom columns
- `receipts` - Payment receipts
- `bills` - Billing records

## Development

### Default Credentials
- **Username:** admin
- **Password:** admin123

(Created automatically on first run)

### Running in Development
```bash
npm run dev
```

### Database Utilities
```bash
# Check schema
node server/check_schema.js

# Run migrations
node server/run_migration.js

# Create DB script
node server/create_db_script.js
```

## Production Deployment

See `../PLESK_DEPLOYMENT.md` for complete deployment guide.

### Quick Steps:
1. Generate secrets: `node generate-secrets.js`
2. Upload files to Plesk
3. Create `.env` with production values
4. Enable Node.js in Plesk
5. Install dependencies via Plesk

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | `password` |
| `DB_NAME` | Database name | `vishvakara` |
| `PORT` | Server port | `3006` |
| `NODE_ENV` | Environment | `development` or `production` |
| `JWT_SECRET` | JWT signing key | Random string |
| `SESSION_SECRET` | Session secret | Random string |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |

## CORS Configuration

The backend automatically configures CORS based on `FRONTEND_URL`:
- Development: `http://localhost:5173`
- Production: `https://vishvakarmaquotation.softodoor.com`

## Session Management

- Uses express-session with cookie-based sessions
- 24-hour session lifetime
- Secure cookies in production
- SameSite policy for cross-domain support

## Security

- Passwords hashed with bcrypt
- Session secrets configurable
- CORS protection
- SQL injection protection via parameterized queries

## License

ISC
