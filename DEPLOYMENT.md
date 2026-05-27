# Deployment Guide

## How Database Connection Works

The application automatically detects the environment and uses the appropriate database configuration:

### 🏠 Local Development
- Uses individual `DB_*` environment variables from `.env`
- Connects to your local PostgreSQL (pgAdmin)
- **No DATABASE_URL needed**

### ☁️ Production (Render)
- Uses `DATABASE_URL` environment variable
- Automatically provided by Render PostgreSQL
- **Individual DB_* variables are ignored when DATABASE_URL is present**

---

## Local Development Setup

1. **Install PostgreSQL** and pgAdmin

2. **Create database** in pgAdmin:
   ```sql
   CREATE DATABASE sarms_db;
   ```

3. **Configure `.env`** (already set up):
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=sarms_db
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

4. **Start the server**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

The database tables will be created automatically on first run! ✨

---

## Render Deployment

### 1. Create PostgreSQL Database

1. Go to Render Dashboard
2. Click **New +** → **PostgreSQL**
3. Configure:
   - Name: `sarms-db`
   - Database: `sarms_db`
   - Region: Choose closest to your location
4. Click **Create Database**
5. Copy the **Internal Database URL**

### 2. Create Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `sarms-backend`
   - **Root Directory**: `SARMS/backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 3. Set Environment Variables

In your web service, go to **Environment** and add:

```env
DATABASE_URL=<paste-internal-database-url-from-step-1>
JWT_SECRET=<generate-random-32-char-string>
JWT_EXPIRES_IN=7d
CLIENT_URL=*
NODE_ENV=production
```

**Important**: Only set `DATABASE_URL` in Render. Don't set individual `DB_*` variables.

### 4. Deploy

Click **Manual Deploy** → **Deploy latest commit**

The database schema will be created automatically on first deployment! 🚀

---

## Environment Variable Priority

```
DATABASE_URL (if set)
    ↓
Uses connection string with SSL
    
DATABASE_URL (not set)
    ↓
Uses individual DB_* variables
    ↓
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
```

---

## Troubleshooting

### Local: "Connection refused"
- ✅ Check PostgreSQL is running
- ✅ Verify credentials in `.env`
- ✅ Ensure `sarms_db` database exists

### Render: "Failed to initialize database schema"
- ✅ Check `DATABASE_URL` is set in environment variables
- ✅ Verify PostgreSQL database is running
- ✅ Check Render logs for detailed error messages

### Both: "relation does not exist"
- ✅ The app creates tables automatically
- ✅ Check database connection is successful
- ✅ Review server logs for schema creation messages

---

## Security Notes

- ⚠️ Never commit `.env` file to Git
- ⚠️ Use strong `JWT_SECRET` in production (32+ characters)
- ⚠️ Render PostgreSQL uses SSL by default (secure)
- ⚠️ Local development doesn't require SSL

---

## Quick Reference

| Environment | Uses | Configuration |
|-------------|------|---------------|
| **Local** | Individual vars | `.env` file with `DB_*` variables |
| **Render** | DATABASE_URL | Render dashboard environment variables |
| **Both** | Auto-detect | No code changes needed! |
