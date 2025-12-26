# Backend Structure Analysis & Issues

## Current Structure

```
backend/
├── .env                        # Development environment (local)
├── .env.plesk                  # Production ready file for Plesk
├── .env.production             # Production template
├── .env.production.example     # Production example
├── START.md                    # Project documentation
├── generate-secrets.js         # Security secrets generator
├── package.json                # Node.js dependencies
├── package-lock.json           # Locked dependencies
├── node_modules/               # Installed packages
└── server/
    ├── .DS_Store              ⚠️ ISSUE: Should be in .gitignore
    ├── index.js               # Main entry point
    ├── check_schema.js        # Database schema checker
    ├── create_db_script.js    # Database creation script
    ├── run_migration.js       # Database migration script
    ├── database/
    │   ├── crm.db            ❌ ISSUE: SQLite file (code uses MySQL!)
    │   └── init.js           # MySQL database initialization
    └── routes/
        ├── auth.js           # Authentication routes
        ├── bills.js          # Bills management
        ├── clients.js        # Client management
        ├── company.js        # Company settings
        ├── packages.js       # Package management
        ├── pdf.js            # PDF generation
        ├── pdf_helpers.js    # PDF utility functions
        ├── quotations.js     # Quotation management
        ├── receipts.js       # Receipt management
        ├── reports.js        # Reports generation
        └── sqft-defaults.js  # Square foot defaults
```

---

## Issues Found

### 🔴 Critical Issues

1. **SQLite Database File**
   - File: `backend/server/database/crm.db`
   - Issue: This is a SQLite database file, but the application uses MySQL (mysql2)
   - Impact: Confusion, unnecessary file, wasted space
   - Action: **DELETE THIS FILE**

### 🟡 Minor Issues

2. **.DS_Store File**
   - File: `backend/server/.DS_Store`
   - Issue: macOS system file committed to repository
   - Impact: Clutters repository
   - Action: Add to .gitignore and remove from git

3. **Missing Backend .gitignore**
   - Issue: No backend-specific .gitignore file
   - Impact: May accidentally commit unwanted files
   - Action: Create backend/.gitignore

4. **Multiple .env Files**
   - Files: .env, .env.plesk, .env.production, .env.production.example
   - Issue: Not really an issue, but needs documentation
   - Impact: Potential confusion about which to use
   - Action: Already documented in deployment guides

---

## Database Configuration

### Current Setup: MySQL
- **Package Used:** `mysql2` (version 3.16.0)
- **Database Type:** MySQL/MariaDB
- **Connection:** Connection pooling via mysql2/promise
- **Schema Management:** Automatic table creation in init.js

### Why crm.db Exists
- Likely a leftover from previous SQLite implementation
- The code was migrated from SQLite to MySQL
- File should be removed

---

## Recommended Actions

### Immediate Fixes

1. **Delete SQLite Database:**
   ```bash
   rm backend/server/database/crm.db
   ```

2. **Create Backend .gitignore:**
   ```
   node_modules/
   .env
   .env.local
   .env.development.local
   .env.production.local
   .DS_Store
   *.log
   npm-debug.log*
   ```

3. **Remove .DS_Store from Git:**
   ```bash
   git rm backend/server/.DS_Store
   ```

4. **Update Root .gitignore:**
   ```
   # Already done - includes .DS_Store
   ```

---

## Correct Structure (After Fixes)

```
backend/
├── .env                        ✅ Development config
├── .env.plesk                  ✅ Plesk deployment ready
├── .env.production             ✅ Production template
├── .env.production.example     ✅ Production example
├── .gitignore                  ✅ Backend-specific ignores
├── START.md                    ✅ Documentation
├── generate-secrets.js         ✅ Security tool
├── package.json                ✅ Dependencies
├── package-lock.json           ✅ Locked versions
└── server/
    ├── index.js                ✅ Entry point
    ├── check_schema.js         ✅ Schema checker
    ├── create_db_script.js     ✅ DB creation
    ├── run_migration.js        ✅ Migrations
    ├── database/
    │   └── init.js             ✅ MySQL initialization
    └── routes/
        ├── auth.js             ✅ Routes
        ├── bills.js            ✅ Routes
        ├── clients.js          ✅ Routes
        ├── company.js          ✅ Routes
        ├── packages.js         ✅ Routes
        ├── pdf.js              ✅ Routes
        ├── pdf_helpers.js      ✅ Utilities
        ├── quotations.js       ✅ Routes
        ├── receipts.js         ✅ Routes
        ├── reports.js          ✅ Routes
        └── sqft-defaults.js    ✅ Routes
```

---

## Environment Files Explained

| File | Purpose | Git Status | When to Use |
|------|---------|------------|-------------|
| `.env` | Local development | Ignored | Development on your machine |
| `.env.plesk` | Plesk server | Ignored | Upload to Plesk as `.env` |
| `.env.production` | Production template | Ignored | Template for production |
| `.env.production.example` | Example template | Committed | Reference for others |

---

## Database Schema

The application uses MySQL with the following tables:
- `users` - User accounts
- `companies` - Company profiles
- `clients` - Client information
- `packages` - Service packages
- `package_items` - Package line items
- `quotations` - Price quotations
- `quotation_items` - Quotation line items
- `quotation_column_config` - Custom column configuration
- `receipts` - Payment receipts
- `bills` - Billing information

---

## Deployment Structure for Plesk

When uploading to Plesk, the structure should be:

```
apivkq.softodoor.com/
└── httpdocs/
    └── backend/
        ├── .env              (from .env.plesk)
        ├── package.json
        ├── package-lock.json
        ├── generate-secrets.js
        └── server/
            ├── index.js
            ├── database/
            │   └── init.js
            └── routes/
                └── ... (all route files)
```

**Do NOT upload:**
- `.env.plesk` (rename to `.env`)
- `.env.production`
- `.env.production.example`
- `node_modules/` (install via Plesk)
- `.DS_Store` files
- `crm.db` file

---

## Summary

✅ **Overall Structure: GOOD**
- Well-organized routes
- Proper separation of concerns
- Good use of environment variables

❌ **Issues to Fix:**
1. Remove SQLite database file (crm.db)
2. Remove .DS_Store from git
3. Add backend/.gitignore

🎯 **Next Steps:**
Run the correction script provided to fix all issues automatically.
