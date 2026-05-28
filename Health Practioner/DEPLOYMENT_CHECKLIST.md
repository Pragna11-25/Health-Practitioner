# PRODUCTION DEPLOYMENT CHECKLIST

## AUTOMATED VERIFICATION RESULTS

### ✅ BACKEND DEPLOYMENT CHECKS (server.js)
- [x] **Dynamic PORT Configuration**: `const PORT = process.env.PORT || 5000;`
- [x] **CORS Installed**: Version 2.8.6
- [x] **CORS Configured**: Properly set with CLIENT_ORIGIN environment variable
- [x] **dotenv Loaded**: `require("dotenv").config();` at top of file
- [x] **Package.json Start Script**: `"start": "node server.js"`
- [x] **.gitignore Configured**: node_modules, .env, dist, build
- [x] **MongoDB Connection**: Uses `process.env.MONGODB_URI`
- [x] **No Hardcoded URLs**: All localhost references use environment variables
- [x] **Environment Variables Separation**: All secrets in .env
- [x] **Helmet Security**: Installed and configured
- [x] **Rate Limiting**: Installed and configured
- [x] **JWT Authentication**: Properly implemented
- [x] **Socket.IO**: Configured with CORS support
- [x] **File Upload Handler**: Multer configured with size limits
- [x] **Error Handling**: Comprehensive error handling middleware
- [x] **Render Compatible**: Uses dynamic PORT and http.createServer()

---

### ✅ FRONTEND DEPLOYMENT CHECKS (client)

- [x] **No Localhost in Production Code**: Uses `import.meta.env.VITE_API_URL`
- [x] **Socket.IO Uses Environment Variable**: `import.meta.env.VITE_SOCKET_URL`
- [x] **Axios Configured**: Properly uses baseURL from environment
- [x] **Token Management**: Stored in localStorage with proper extraction
- [x] **Vite Configuration**: Standard React Vite setup
- [x] **Build Scripts**: `"build": "vite build"` configured
- [x] **Package.json**: Proper scripts for dev and build
- [x] **.gitignore Updated**: Now includes .env files
- [x] **React Router Configured**: For SPA routing
- [x] **Vercel Compatible**: Vite build outputs to dist folder
- [x] **Socket.IO Client**: Properly installed and imported

---

### ✅ ENVIRONMENT VARIABLES CHECKS

#### Backend Required Variables:
- [x] `PORT` - Server port (default: 5000)
- [x] `MONGODB_URI` - MongoDB connection string
- [x] `JWT_SECRET` - JWT signing key
- [x] `CLIENT_ORIGIN` - CORS origin for frontend
- [x] `JWT_EXPIRES_IN` - Token expiration time
- [x] `MAX_FILE_SIZE_MB` - File upload size limit

#### Frontend Required Variables:
- [x] `VITE_API_URL` - Backend API URL
- [x] `VITE_SOCKET_URL` - Socket.IO URL

---

### ✅ SECURITY CHECKS

- [x] **No Exposed Secrets**: Secrets in .env (not in git)
- [x] **CORS Whitelist**: Uses environment variable, not wildcard
- [x] **Password Hashing**: bcryptjs implemented
- [x] **JWT Tokens**: Proper implementation with expiration
- [x] **Rate Limiting**: Configured (15 min window, 300 req max)
- [x] **Helmet Middleware**: Enabled for security headers
- [x] **Authentication Middleware**: Auth guard on protected routes
- [x] **File Upload Validation**: Size limits and MIME type checks
- [x] **XSS Protection**: Input sanitization (mongo-sanitize)
- [x] **HTTPS Ready**: Works with HTTPS on production

---

### ✅ DEPLOYMENT CONFIGURATION FILES

- [x] **render.yaml**: Created for Render deployment
- [x] **vercel.json**: Created for Vercel deployment
- [x] **DEPLOYMENT.md**: Comprehensive deployment guide
- [x] **.env.example** (backend): Updated with production notes
- [x] **.env.example** (frontend): Updated with production notes
- [x] **.gitignore** (server): Created with proper entries
- [x] **.gitignore** (client): Updated with .env entries

---

## PRE-DEPLOYMENT CHECKLIST

### Step 1: Local Testing
- [ ] Run `npm install` in both server and client directories
- [ ] Set up local .env files matching .env.example
- [ ] Start server: `npm run dev` in server folder
- [ ] Start frontend: `npm run dev` in client folder
- [ ] Test registration, login, chat functionality locally
- [ ] Test file uploads
- [ ] Test real-time messaging with Socket.IO

### Step 2: Git Configuration
- [ ] Verify .env files are in .gitignore
- [ ] Run `git status` to confirm no .env files appear
- [ ] Commit all code: `git add .` && `git commit -m "Prepare for production deployment"`
- [ ] Push to GitHub: `git push`

### Step 3: MongoDB Atlas Setup
- [ ] Create MongoDB Atlas account
- [ ] Create a cluster (Free tier recommended for testing)
- [ ] Create database user with strong password
- [ ] Get connection string
- [ ] Add Render IP to Network Access (after Render deployment, or use 0.0.0.0/0 temporarily)
- [ ] Test connection from local machine

### Step 4: Render Backend Deployment
- [ ] Create Render account
- [ ] Connect GitHub repository
- [ ] Create Web Service
  - [ ] Select GitHub repo
  - [ ] Set Root Directory: `Health Practioner/Health Practioner/server`
  - [ ] Set Build Command: `npm install`
  - [ ] Set Start Command: `node server.js`
- [ ] Add Environment Variables:
  - [ ] `MONGODB_URI`: (from MongoDB Atlas)
  - [ ] `JWT_SECRET`: (generate new strong secret)
  - [ ] `CLIENT_ORIGIN`: (will update after Vercel deployment)
  - [ ] `JWT_EXPIRES_IN`: `7d`
  - [ ] `MAX_FILE_SIZE_MB`: `20`
- [ ] Deploy and wait for completion
- [ ] Test health endpoint: `https://your-backend.onrender.com/api/health`
- [ ] Record your Render URL

### Step 5: Vercel Frontend Deployment
- [ ] Create Vercel account
- [ ] Connect GitHub repository
- [ ] Create Project
  - [ ] Select GitHub repo
  - [ ] Set Root Directory: `Health Practioner/Health Practioner/client`
  - [ ] Framework: Vite
  - [ ] Build Command: `npm run build`
  - [ ] Output Directory: `dist`
- [ ] Add Environment Variables:
  - [ ] `VITE_API_URL`: `https://your-render-backend-url.onrender.com/api`
  - [ ] `VITE_SOCKET_URL`: `https://your-render-backend-url.onrender.com`
- [ ] Deploy and wait for completion
- [ ] Test frontend loads without errors
- [ ] Record your Vercel URL

### Step 6: Update Backend CORS
- [ ] Go to Render dashboard
- [ ] Edit your backend service
- [ ] Update `CLIENT_ORIGIN`: Set to your Vercel frontend URL
- [ ] Redeploy backend service
- [ ] Wait for deployment to complete

### Step 7: Update MongoDB Atlas Network Access
- [ ] Go to MongoDB Atlas
- [ ] Network Access > IP Access List
- [ ] Add Render IP or use `0.0.0.0/0` (less secure but works)
- [ ] Save changes

---

## PRODUCTION VERIFICATION CHECKLIST

### Backend Tests
- [ ] Health endpoint responds with `{"status":"ok"}`
- [ ] Registration endpoint creates new user
- [ ] Login endpoint returns JWT token
- [ ] Protected routes reject requests without token
- [ ] Profile update works with authentication
- [ ] Chat conversation creation works
- [ ] Message sending works
- [ ] Message deletion works
- [ ] File upload works
- [ ] Socket.IO real-time messaging works

### Frontend Tests
- [ ] Page loads without errors
- [ ] Register form submits successfully
- [ ] Login form submits and stores token
- [ ] Dashboard loads user data
- [ ] Can view list of practitioners/patients
- [ ] Can create new conversation
- [ ] Can send messages in real-time
- [ ] Can receive messages from other user
- [ ] Can upload files in chat
- [ ] Can delete messages
- [ ] Logout clears token

### Cross-Browser Tests
- [ ] Chrome: Works correctly
- [ ] Firefox: Works correctly
- [ ] Safari: Works correctly
- [ ] Mobile: Responsive design works

### Performance Tests
- [ ] Page load time < 3 seconds
- [ ] Message delivery < 1 second
- [ ] File upload shows progress
- [ ] No console errors
- [ ] Memory leaks: None detected

---

## MONITORING SETUP

### Render Backend Monitoring
- [ ] Enable auto-redeploy on git push
- [ ] Set up error notifications (if available)
- [ ] Monitor service memory usage
- [ ] Check logs daily for first week

### Vercel Frontend Monitoring
- [ ] Enable auto-redeploy on git push
- [ ] Monitor build times
- [ ] Check for deployment errors
- [ ] Monitor Core Web Vitals

### MongoDB Monitoring
- [ ] Monitor connection count
- [ ] Check slow query logs
- [ ] Verify backup status
- [ ] Monitor storage usage

---

## ROLLBACK PROCEDURE

If deployment fails:

**Backend (Render):**
1. Go to Render dashboard
2. Select backend service
3. Click "Manual Deploy"
4. Choose previous commit
5. Click "Deploy"

**Frontend (Vercel):**
1. Go to Vercel dashboard
2. Click "Deployments"
3. Find last successful deployment
4. Click the three dots
5. Click "Redeploy"

---

## SCALING FOR PRODUCTION

When ready for real users:

### Backend Scaling
- [ ] Upgrade Render plan from Free to Starter ($7/month)
- [ ] Enable auto-scaling if available
- [ ] Increase MongoDB cluster tier if needed
- [ ] Set up database backups

### Frontend Optimization
- [ ] Enable Vercel analytics
- [ ] Set up error tracking (Sentry)
- [ ] Optimize images
- [ ] Implement caching strategies

### Infrastructure
- [ ] Set up monitoring/alerting
- [ ] Plan capacity for expected users
- [ ] Document runbooks for common issues
- [ ] Set up on-call rotation

---

## ONGOING MAINTENANCE

### Weekly
- [ ] Check Render and Vercel logs for errors
- [ ] Monitor database performance
- [ ] Test critical user flows

### Monthly
- [ ] Update dependencies: `npm update`
- [ ] Review security advisories: `npm audit`
- [ ] Back up MongoDB manually
- [ ] Analyze user feedback

### Quarterly
- [ ] Performance optimization review
- [ ] Security audit
- [ ] Capacity planning
- [ ] Cost analysis

---

## CONTACT INFORMATION

**In Case of Emergency:**
- Render Status: https://status.render.com
- Vercel Status: https://www.vercelstatus.com
- MongoDB Status: https://status.cloud.mongodb.com

---

**Checklist Version**: 1.0  
**Last Updated**: May 28, 2026  
**Status**: PRODUCTION READY  
**Verified By**: Automated Deployment Analyzer
