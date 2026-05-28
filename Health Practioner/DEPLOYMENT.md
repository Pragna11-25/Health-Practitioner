# DEPLOYMENT GUIDE - Health Practitioner Platform

## Overview
This guide provides step-by-step instructions for deploying the Health Practitioner MERN application to:
- **Backend**: Render.com (Node.js/Express)
- **Frontend**: Vercel.com (React/Vite)
- **Database**: MongoDB Atlas (Cloud)

---

## PART 1: BACKEND DEPLOYMENT ON RENDER

### Prerequisites
1. Create a Render account at https://render.com
2. MongoDB Atlas account with a database cluster
3. Git repository pushed to GitHub

### Step 1: Prepare MongoDB Atlas

1. Go to https://cloud.mongodb.com
2. Create a cluster (Free tier available)
3. Create a database user with strong password
4. In Network Access, add: `0.0.0.0/0` (allows Render to connect)
5. Get the connection string: `mongodb+srv://username:password@cluster.mongodb.net/database`

### Step 2: Deploy to Render

1. Go to https://render.com/dashboard
2. Click "New +" → "Web Service"
3. Select GitHub repository (authorize if needed)
4. Configure:
   - **Name**: health-practitioner-api
   - **Root Directory**: `Health Practioner/Health Practioner/server`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free (or paid for production)

5. Add Environment Variables (in Render dashboard):
   ```
   PORT=5000
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
   JWT_SECRET=[generate strong 32+ char random string]
   JWT_EXPIRES_IN=7d
   CLIENT_ORIGIN=https://your-vercel-frontend-url.vercel.app
   MAX_FILE_SIZE_MB=20
   ```

6. Click "Deploy"
7. Wait for deployment to complete
8. Get your Render URL: `https://your-app-name.onrender.com`

### Step 3: Test Backend

```bash
# Test health endpoint
curl https://your-app-name.onrender.com/api/health

# Expected response:
# {"status":"ok"}
```

---

## PART 2: FRONTEND DEPLOYMENT ON VERCEL

### Prerequisites
1. Create a Vercel account at https://vercel.com
2. Have your GitHub repo ready

### Step 1: Deploy to Vercel

1. Go to https://vercel.com/new
2. Select "Import Git Repository"
3. Select your Health Practitioner repository
4. Configure:
   - **Project Name**: health-practitioner
   - **Framework Preset**: Vite
   - **Root Directory**: `Health Practioner/Health Practioner/client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. Add Environment Variables:
   ```
   VITE_API_URL=https://your-render-backend-url.onrender.com/api
   VITE_SOCKET_URL=https://your-render-backend-url.onrender.com
   ```

6. Click "Deploy"
7. Wait for deployment to complete
8. Get your Vercel URL: `https://health-practitioner.vercel.app`

### Step 2: Update Backend CORS

After deploying frontend, update backend environment variable:
```
CLIENT_ORIGIN=https://health-practitioner.vercel.app
```

Redeploy backend on Render for changes to take effect.

---

## PART 3: ENVIRONMENT VARIABLES REFERENCE

### Backend (.env on Render)
```
# Server
PORT=5000
NODE_ENV=production

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db

# Security
JWT_SECRET=your_strong_random_secret_key_here
JWT_EXPIRES_IN=7d

# CORS
CLIENT_ORIGIN=https://your-frontend-url.vercel.app

# Uploads
MAX_FILE_SIZE_MB=20
```

### Frontend (.env on Vercel)
```
# API Configuration
VITE_API_URL=https://your-render-backend-url.onrender.com/api
VITE_SOCKET_URL=https://your-render-backend-url.onrender.com
```

---

## PART 4: PRODUCTION CHECKLIST

### Security
- [ ] JWT_SECRET is strong (32+ random characters)
- [ ] Environment variables are NOT in git (in .gitignore)
- [ ] HTTPS is enabled on both Render and Vercel (automatic)
- [ ] CORS origin is set to your actual frontend URL
- [ ] MongoDB IP whitelist includes Render IP

### Backend (Render)
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] Authentication endpoints work
- [ ] Socket.IO connections establish
- [ ] File uploads work
- [ ] MongoDB connection is successful

### Frontend (Vercel)
- [ ] Build completes without errors
- [ ] Frontend loads without CORS errors
- [ ] Can register and login
- [ ] Can access conversation list
- [ ] Socket.IO messages work in real-time
- [ ] File uploads work

### Database (MongoDB Atlas)
- [ ] Cluster is running
- [ ] Database user has correct permissions
- [ ] Network access allows Render IP
- [ ] Backups are enabled (recommended)

---

## PART 5: MONITORING & LOGS

### View Backend Logs (Render)
1. Go to Render dashboard
2. Select your service
3. Click "Logs" tab
4. View real-time server logs

### View Frontend Logs (Vercel)
1. Go to Vercel dashboard
2. Select your project
3. Click "Deployments" tab
4. Click the latest deployment
5. View build and runtime logs

### Monitor Database (MongoDB Atlas)
1. Go to MongoDB Atlas
2. Click "Monitoring" tab
3. View connection metrics
4. Check for slow queries

---

## PART 6: TROUBLESHOOTING

### "Connection refused" on frontend
- ✅ Verify VITE_API_URL is correct Render URL
- ✅ Check CORS settings on backend
- ✅ Verify CLIENT_ORIGIN matches frontend URL
- ✅ Restart Render service

### "Cannot connect to MongoDB"
- ✅ Verify MONGODB_URI is correct
- ✅ Check MongoDB Atlas network access includes Render IP
- ✅ Verify database user credentials
- ✅ Ensure cluster is active

### "Socket.IO connection fails"
- ✅ Verify VITE_SOCKET_URL is correct
- ✅ Check that Socket.IO is configured in backend
- ✅ Verify cors origin allows frontend domain
- ✅ Check browser console for connection errors

### "File upload fails"
- ✅ Verify MAX_FILE_SIZE_MB is set correctly
- ✅ Check server logs for upload errors
- ✅ Ensure /uploads directory exists on Render

### "JWT token invalid"
- ✅ Verify JWT_SECRET is same on all deployments
- ✅ Check token expiration time
- ✅ Clear browser localStorage and try again

---

## PART 7: CONTINUOUS DEPLOYMENT

### Auto-Deploy on Git Push
1. **Vercel**: Auto-deploys on push to main/master
2. **Render**: Auto-deploys on push to main/master

No additional configuration needed!

### Manual Redeploy

**Render:**
1. Go to dashboard
2. Select service
3. Click "Manual Deploy" → "Deploy latest commit"

**Vercel:**
1. Go to dashboard
2. Click "Redeploy" on deployment

---

## PART 8: SCALING & OPTIMIZATION

### For Production Use
1. **Render**: Upgrade from Free to Paid plan
2. **MongoDB**: Consider higher tier cluster
3. **Vercel**: Enable Edge Middleware for API optimization
4. **CDN**: Enable automatic image optimization

### Performance Tips
- [ ] Enable compression in Express (already done)
- [ ] Use rate limiting (already done)
- [ ] Implement proper indexing in MongoDB
- [ ] Cache static assets on Vercel
- [ ] Monitor performance metrics

---

## QUICK REFERENCE URLS

| Service | URL |
|---------|-----|
| Render Dashboard | https://dashboard.render.com |
| Vercel Dashboard | https://vercel.com/dashboard |
| MongoDB Atlas | https://cloud.mongodb.com |
| Your Backend | https://your-app-name.onrender.com |
| Your Frontend | https://health-practitioner.vercel.app |

---

## Support & Next Steps

1. **Test thoroughly** before announcing to users
2. **Monitor logs** for first 24 hours
3. **Set up monitoring** alerts if available
4. **Plan backup strategy** for MongoDB
5. **Document any issues** for future reference

---

**Last Updated**: May 28, 2026
**Status**: Production Ready
