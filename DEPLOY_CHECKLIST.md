# Deployment Checklist ✅

## Your Configuration

**Frontend Domain:** https://vishvakarmaquotation.softodoor.com
**Backend Domain:** https://apivkq.softodoor.com
**Database:** vishvakara (User: Vishvakarma1, Password: Vishvakarma)

---

## Pre-Deployment Steps (Local)

### 1. Generate Security Secrets
```bash
cd backend
node generate-secrets.js
```
**Copy the output** - you'll need it for step 5.

### 2. Build Frontend
```bash
cd frontend
npm install
npm run build
```
This creates `frontend/dist/` folder.

---

## Plesk Deployment Steps

### 3. Setup Database (Plesk)
- [ ] Go to **Databases** → Verify database exists: `vishvakara`
- [ ] Verify user exists: `Vishvakarma1`
- [ ] Test connection via phpMyAdmin

### 4. Upload Frontend Files
- [ ] Login to Plesk
- [ ] Go to domain: `vishvakarmaquotation.softodoor.com`
- [ ] Go to **Files** → **File Manager**
- [ ] Upload all files from `frontend/dist/` to `httpdocs/`

### 5. Upload Backend Files & Configure
- [ ] Go to domain: `apivkq.softodoor.com`
- [ ] Upload entire `backend/` folder to `httpdocs/`
- [ ] Copy `backend/.env.plesk` file
- [ ] Rename it to `.env`
- [ ] Edit `.env` and paste the JWT_SECRET and SESSION_SECRET from step 1
- [ ] Save the file

### 6. Enable Node.js (Backend)
- [ ] Go to `apivkq.softodoor.com` → **Node.js**
- [ ] Click **Enable Node.js**
- [ ] Configure:
  - Document Root: `/httpdocs/backend`
  - Application Startup File: `server.js`
  - Node.js Version: 18.x or 20.x
  - Application Mode: Production
- [ ] Click **NPM Install**
- [ ] Click **Enable Node.js** or **Restart App**

### 7. Enable SSL Certificates
- [ ] `vishvakarmaquotation.softodoor.com` → **SSL/TLS** → Install Let's Encrypt
- [ ] `apivkq.softodoor.com` → **SSL/TLS** → Install Let's Encrypt
- [ ] Verify both domains use HTTPS

---

## Testing

### 8. Test Backend
Open in browser:
- [ ] https://apivkq.softodoor.com/api/health
  - Should show: `{"status":"OK","message":"Vishvakarma CRM Backend is running"...}`
- [ ] https://apivkq.softodoor.com/api
  - Should show: `{"message":"Vishvakarma CRM API","version":"1.0.0"...}`

### 9. Test Frontend
- [ ] Open: https://vishvakarmaquotation.softodoor.com
- [ ] Press F12 → Open **Console** tab
- [ ] Check for errors:
  - ❌ CORS errors? Check backend `.env` FRONTEND_URL
  - ❌ 404 errors? Check Node.js is running
  - ✅ No errors? Perfect!

### 10. Test Full Application
- [ ] Login works
- [ ] Can view clients
- [ ] Can create quotations
- [ ] All features working

---

## Troubleshooting

### Backend Not Running
1. Check Plesk → Node.js → **Logs**
2. Verify `.env` file exists and has correct values
3. Click **Restart App**

### CORS Error
1. Check `backend/.env` has: `FRONTEND_URL=https://vishvakarmaquotation.softodoor.com`
2. Restart Node.js app

### Database Connection Error
1. Verify credentials in `backend/.env`
2. Test database in Plesk → Databases → phpMyAdmin

---

## Post-Deployment

- [ ] Save Plesk login credentials securely
- [ ] Backup `.env` file (store securely, not in git)
- [ ] Document any custom configuration

---

## Files to Upload

```
Plesk Server Structure:

vishvakarmaquotation.softodoor.com/
└── httpdocs/
    ├── index.html (from frontend/dist/)
    ├── assets/ (from frontend/dist/assets/)
    └── ... (all other files from frontend/dist/)

apivkq.softodoor.com/
└── httpdocs/
    └── backend/
        ├── server/
        ├── node_modules/ (installed via NPM Install)
        ├── package.json
        ├── .env (created from .env.plesk)
        └── ... (all backend files)
```

---

## Quick Commands Reference

### Generate Secrets
```bash
cd backend && node generate-secrets.js
```

### Build Frontend
```bash
cd frontend && npm run build
```

### Test Backend Locally
```bash
cd backend && npm start
# Open: http://localhost:3006/api/health
```

### Test Frontend Locally
```bash
cd frontend && npm run dev
# Open: http://localhost:5173
```

---

## Need Help?

- **Backend Logs:** Plesk → apivkq.softodoor.com → Node.js → Logs
- **Browser Console:** F12 → Console tab
- **Database:** Plesk → Databases → phpMyAdmin

---

**Remember:** After any backend code changes, click **Restart App** in Plesk Node.js section!
