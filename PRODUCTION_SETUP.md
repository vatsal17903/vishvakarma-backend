# Production Setup - Quick Reference

## Database Credentials (Live)

```
Host: localhost:3306
Database: vishvakara
Username: Vishvakarma1
Password: Vishvakarma
```

---

## Step 1: Generate Secure Secrets

Run this command on your local machine:

```bash
cd backend
node generate-secrets.js
```

Copy the generated `JWT_SECRET` and `SESSION_SECRET`.

---

## Step 2: Create .env on Plesk Server

On your Plesk server, create file: `backend/.env`

Copy this and **fill in the missing values**:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=Vishvakarma1
DB_PASSWORD=Vishvakarma
DB_NAME=vishvakara

# Server Configuration
PORT=3001
NODE_ENV=production

# Security Secrets - Paste generated secrets here
JWT_SECRET=paste-generated-jwt-secret-here
SESSION_SECRET=paste-generated-session-secret-here

# CORS - Frontend Domain
FRONTEND_URL=https://vishvakarmaquotation.softodoor.com
```

---

## Step 3: Build Frontend

On your local machine:

```bash
cd frontend
npm run build
```

---

## Step 4: Deploy to Plesk

### Frontend (vishvakarmaquotation.softodoor.com)
- Upload `frontend/dist/*` to document root

### Backend (apivkq.softodoor.com)
- Upload `backend/*` to document root
- Create `.env` file with the content from Step 2
- Enable Node.js in Plesk:
  - Document Root: `/httpdocs/backend` (adjust path)
  - Application Startup File: `server/index.js`
  - Node.js Version: 18.x or 20.x
  - Click **NPM Install**
  - Click **Enable Node.js**

---

## Checklist

- [ ] Database password added to `.env`
- [ ] Secure secrets generated and added
- [ ] Frontend built (`npm run build`)
- [ ] Frontend files uploaded to Plesk
- [ ] Backend files uploaded to Plesk
- [ ] `.env` created on Plesk server
- [ ] Node.js enabled on backend domain
- [ ] Dependencies installed (NPM Install)
- [ ] SSL certificates installed (HTTPS)
- [ ] Test: https://vishvakarmaquotation.softodoor.com
- [ ] Test: https://apivkq.softodoor.com/api/auth/check

---

## Quick Test Commands

### Test Database Connection (on Plesk via SSH)
```bash
cd backend
node -e "import('./server/database/init.js').then(m => m.initializeDatabase())"
```

### Check Node.js App Status
- Plesk → apivkq.softodoor.com → Node.js → Check status

### View Logs
- Plesk → apivkq.softodoor.com → Node.js → Logs

---

## Domains Summary

| Item | Value |
|------|-------|
| Frontend | https://vishvakarmaquotation.softodoor.com |
| Backend | https://apivkq.softodoor.com |
| Database | vishvakara |
| DB User | Vishvakarma1 |
| Backend Port | 3001 |

---

## What You Need to Do

1. **Generate Security Secrets:**
   ```bash
   cd backend
   node generate-secrets.js
   ```
   Copy the generated `JWT_SECRET` and `SESSION_SECRET`

2. **Upload to Plesk:**
   - Copy `backend/.env.plesk` to your Plesk server
   - Rename it to `.env`
   - Replace the JWT_SECRET and SESSION_SECRET with generated values

That's it! Everything else is already configured and ready.
