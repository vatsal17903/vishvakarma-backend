# Plesk Deployment Guide - Vishvakarma CRM

## Your Domains
- **Frontend**: https://vishvakarmaquotation.softodoor.com
- **Backend**: https://apivkq.softodoor.com

---

## Step 1: Build Frontend

On your local machine:

```bash
cd frontend
npm install
npm run build
```

This creates a `frontend/dist` folder.

---

## Step 2: Deploy Frontend to Plesk

### Option A: Via Plesk File Manager
1. Login to Plesk
2. Go to **Files** → **File Manager**
3. Navigate to domain: `vishvakarmaquotation.softodoor.com`
4. Upload all files from `frontend/dist/` to the document root (usually `httpdocs/`)

### Option B: Via FTP
1. Connect via FTP to your Plesk server
2. Navigate to `vishvakarmaquotation.softodoor.com/httpdocs/`
3. Upload all files from `frontend/dist/`

---

## Step 3: Deploy Backend to Plesk

### A. Upload Backend Files

1. Upload entire `backend/` folder to `apivkq.softodoor.com`
2. Go to the domain's document root (usually `httpdocs/`)

### B. Create .env File in Backend

In Plesk File Manager or via SSH, create `backend/.env`:

```env
# Database Configuration (Get from Plesk → Databases)
DB_HOST=localhost
DB_USER=your_plesk_database_user
DB_PASSWORD=your_plesk_database_password
DB_NAME=your_plesk_database_name

# Server Configuration
PORT=3001
NODE_ENV=production

# Security - CHANGE THESE TO STRONG RANDOM STRINGS!
JWT_SECRET=your-strong-random-jwt-secret-here-12345
SESSION_SECRET=your-strong-random-session-secret-here-67890

# CORS - Frontend Domain
FRONTEND_URL=https://vishvakarmaquotation.softodoor.com
```

**Important:** Generate strong random strings for JWT_SECRET and SESSION_SECRET!

---

## Step 4: Setup MySQL Database

1. In Plesk, go to **Databases** → **Add Database**
2. Create a new database (e.g., `vishvakarma_crm`)
3. Create a database user with password
4. Grant all privileges to the user
5. **Copy the credentials to your backend `.env` file**

---

## Step 5: Configure Node.js for Backend

1. In Plesk, go to `apivkq.softodoor.com` → **Node.js**
2. Click **Enable Node.js**
3. Configure:
   - **Document Root**: `/httpdocs/backend` (or wherever you uploaded backend)
   - **Application Mode**: Production
   - **Application Startup File**: `server/index.js`
   - **Node.js Version**: 18.x or 20.x (latest LTS)

4. **Optional Environment Variables** (or use .env file):
   ```
   NODE_ENV=production
   PORT=3001
   ```

5. Click **NPM Install** to install dependencies

6. Click **Enable Node.js** or **Restart App**

---

## Step 6: Configure SSL (HTTPS)

Both domains need SSL certificates:

1. In Plesk, go to each domain → **SSL/TLS Certificates**
2. Click **Install a free basic certificate provided by Let's Encrypt**
3. Enable:
   - ✅ Secure the domain
   - ✅ Secure the www subdomain (if applicable)
4. Click **Install**

Repeat for both domains.

---

## Step 7: Test Your Deployment

### Test Backend API
Open in browser or use curl:
```
https://apivkq.softodoor.com/api/auth/check
```

Should return a response (not 404).

### Test Frontend
1. Open: https://vishvakarmaquotation.softodoor.com
2. Open browser **Developer Tools** (F12) → **Console**
3. Check for errors:
   - ❌ CORS errors? → Check backend `.env` FRONTEND_URL
   - ❌ 404 on API calls? → Check VITE_API_URL in frontend
   - ✅ No errors? You're good!

---

## Troubleshooting

### CORS Error in Browser Console

**Error**: `Access to fetch at 'https://apivkq.softodoor.com/api/...' from origin 'https://vishvakarmaquotation.softodoor.com' has been blocked by CORS policy`

**Fix**:
1. Check `backend/.env` has: `FRONTEND_URL=https://vishvakarmaquotation.softodoor.com`
2. Restart Node.js app in Plesk

### Database Connection Error

**Error**: `ER_ACCESS_DENIED_ERROR` or similar

**Fix**:
1. Verify database credentials in `backend/.env`
2. Check database exists in Plesk → Databases
3. Verify user has privileges

### Backend Not Starting

1. Check Plesk → Node.js → **Logs**
2. Common issues:
   - Missing dependencies: Click **NPM Install**
   - Wrong startup file: Should be `server/index.js`
   - Port conflict: Use PORT=3001 or different

### Frontend Showing Blank Page

1. Check browser console for errors
2. Verify `dist/` files were uploaded correctly
3. Check if `index.html` is in the document root

---

## Post-Deployment Checklist

- [ ] Frontend accessible at https://vishvakarmaquotation.softodoor.com
- [ ] Backend API responding at https://apivkq.softodoor.com/api/...
- [ ] SSL certificates installed on both domains (HTTPS working)
- [ ] Database created and connected
- [ ] No CORS errors in browser console
- [ ] Login/authentication working
- [ ] Can create/read/update/delete data

---

## Updating After Changes

### Frontend Changes
```bash
cd frontend
npm run build
# Upload new dist/ files to Plesk
```

### Backend Changes
1. Upload modified files to Plesk
2. If `.env` changed: Update on server
3. If `package.json` changed: Run **NPM Install** in Plesk
4. Click **Restart App** in Plesk Node.js section

---

## Quick Reference

| Item | Value |
|------|-------|
| Frontend URL | https://vishvakarmaquotation.softodoor.com |
| Backend URL | https://apivkq.softodoor.com |
| Frontend .env | `VITE_API_URL=https://apivkq.softodoor.com` |
| Backend .env | `FRONTEND_URL=https://vishvakarmaquotation.softodoor.com` |
| Backend Port | 3001 |
| Node Startup File | `server/index.js` |

---

## Need Help?

- Check Plesk logs: Domain → Node.js → **Logs**
- Check browser console: F12 → Console tab
- Verify .env files are correct on the server
