# PRODUCTION CONFIGURATION REFERENCE

## QUICK START

```bash
# Backend Environment Variables (Render)
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/db
JWT_SECRET=generate_strong_32_char_secret_here
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=https://your-frontend.vercel.app
MAX_FILE_SIZE_MB=20

# Frontend Environment Variables (Vercel)
VITE_API_URL=https://your-backend.onrender.com/api
VITE_SOCKET_URL=https://your-backend.onrender.com
```

---

## BACKEND CONFIGURATION (Render)

### render.yaml (Auto-deployment)
```yaml
services:
  - type: web
    name: health-practitioner-backend
    env: node
    buildCommand: npm install
    startCommand: node server.js
    healthCheckPath: /api/health
```

### Environment Variables
| Variable | Value | Purpose |
|----------|-------|---------|
| PORT | 5000 | Server port (auto-assigned by Render) |
| NODE_ENV | production | Environment mode |
| MONGODB_URI | Connection string | Database connection |
| JWT_SECRET | Random 32+ chars | JWT signing key |
| JWT_EXPIRES_IN | 7d | Token expiration |
| CLIENT_ORIGIN | Frontend URL | CORS origin |
| MAX_FILE_SIZE_MB | 20 | Upload limit |

### API Endpoints
```
GET    /api/health                          - Health check
POST   /api/auth/register                   - User registration
POST   /api/auth/login                      - User login
GET    /api/users/me                        - Get current user
PATCH  /api/users/me                        - Update profile
GET    /api/users/role/:role                - Get users by role
POST   /api/chat/conversations              - Create conversation
GET    /api/chat/conversations              - Get all conversations
GET    /api/chat/messages/:conversationId   - Get messages
DELETE /api/chat/messages/:messageId        - Delete message
POST   /api/upload                          - Upload file
```

### WebSocket Events
```javascript
// Client → Server
socket.emit('join_conversation', conversationId)
socket.emit('send_message', { conversationId, text, attachments })
socket.emit('delete_message', { conversationId, messageId })

// Server → Client
socket.on('new_message', messageData)
socket.on('message_deleted', deletionData)
```

---

## FRONTEND CONFIGURATION (Vercel)

### vercel.json
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_API_URL": "@vite_api_url",
    "VITE_SOCKET_URL": "@vite_socket_url"
  },
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Environment Variables
| Variable | Value | Purpose |
|----------|-------|---------|
| VITE_API_URL | Backend API URL | API endpoint |
| VITE_SOCKET_URL | Backend Socket URL | Real-time connection |

### Build Configuration
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node Version**: 18+ (auto-detected)

### Features
- Auto-deploy on git push
- SPA routing support (rewrite to index.html)
- Static file caching
- HTTPS enabled automatically
- Preview deployments for PR testing

---

## MONGODB ATLAS CONFIGURATION

### Connection String Format
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

### Network Access Setup
```
IP Address: 0.0.0.0/0 (allows all IPs, less secure)
OR
Add Render IP: [Your Render IP Address]
```

### Collections
```javascript
// users - Stores user accounts
{
  _id: ObjectId,
  role: "patient" | "practitioner",
  fullName: String,
  email: String,
  password: String (hashed),
  phone: String,
  specialization: String,
  age: Number,
  gender: String,
  bio: String,
  createdAt: Date,
  updatedAt: Date
}

// conversations - Chat conversations
{
  _id: ObjectId,
  pairKey: String,
  participants: [ObjectId],
  lastMessageAt: Date,
  lastMessagePreview: String,
  lastMessageSenderId: ObjectId,
  readAtByUser: Map,
  createdAt: Date,
  updatedAt: Date
}

// messages - Chat messages
{
  _id: ObjectId,
  conversationId: ObjectId,
  senderId: ObjectId,
  text: String,
  attachments: [Object],
  deleted: Boolean,
  deletedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
```javascript
// Automatic indexes created:
users: { email: 1 } // unique
conversations: { pairKey: 1 } // unique
conversations: { participants: 1 }
messages: { conversationId: 1, createdAt: 1 }
```

---

## SECURITY CONFIGURATION

### CORS Settings
```javascript
// Allowed Origins
allowedOrigins = [
  process.env.CLIENT_ORIGIN,  // Production frontend
  "http://127.0.0.1:5173",    // Development
  "http://0.0.0.0:5173",      // Development
]
```

### JWT Configuration
```javascript
// Token Payload
{
  userId: String,
  role: "patient" | "practitioner"
}

// Signing Options
{
  expiresIn: process.env.JWT_EXPIRES_IN || "7d"
}

// Expiration
7 days (604,800 seconds)
```

### Authentication Flow
```
1. User submits credentials
2. Backend validates and hashes password with bcryptjs
3. JWT token generated
4. Token sent to frontend
5. Frontend stores in localStorage
6. Frontend includes in Authorization header for protected requests
7. Backend validates token on each request
```

### Rate Limiting
```javascript
// Configuration
windowMs: 15 * 60 * 1000  // 15 minutes
max: 300                   // 300 requests per window
```

### File Upload Limits
```javascript
// Size Limit
MAX_FILE_SIZE_MB: 20       // 20 MB per file

// File Types
Allowed: All types (validated by MIME type)
Categories: image, video, audio, document, dicom
```

---

## DEPLOYMENT URLS

### Development
```
Frontend: http://localhost:5173
Backend:  http://localhost:5000
API:      http://localhost:5000/api
WebSocket: http://localhost:5000
```

### Production
```
Frontend: https://your-app.vercel.app
Backend:  https://your-api.onrender.com
API:      https://your-api.onrender.com/api
WebSocket: wss://your-api.onrender.com (auto-upgraded)
```

---

## DEPLOYMENT TARGETS

### Render Backend Service
```
Platform: Render.com
Type: Node.js Web Service
Region: Oregon (configurable)
Plan: Free/Paid
Build: npm install
Start: node server.js
Health Check: /api/health
```

### Vercel Frontend Deployment
```
Platform: Vercel.com
Type: Vite React Application
Build: npm run build
Output: dist/
CDN: Vercel Edge Network
HTTPS: Automatic
```

---

## DEVELOPMENT VS PRODUCTION

### Backend (.env)
```
Development:
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost/dev_db

Production:
PORT=auto (set by Render)
CLIENT_ORIGIN=https://your-app.vercel.app
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
```

### Frontend (.env)
```
Development:
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000

Production:
VITE_API_URL=https://your-api.onrender.com/api
VITE_SOCKET_URL=https://your-api.onrender.com
```

---

## PERFORMANCE OPTIMIZATION

### Backend
- Express compression middleware
- Rate limiting (DDoS protection)
- MongoDB indexing on frequently queried fields
- JWT token caching
- Socket.IO connection pooling

### Frontend
- Vite code splitting
- Lazy loading routes
- Image optimization
- CSS minification
- JavaScript minification

### Database
- Connection pooling
- Query optimization
- Proper indexing
- Automated backups

---

## MONITORING & LOGGING

### Backend Logs
```
Render: Dashboard > Service > Logs
Shows real-time server output
Include: errors, connection logs, API requests
```

### Frontend Logs
```
Vercel: Dashboard > Deployments > [Deployment] > Logs
Shows build logs and deployment status
Include: build errors, warnings, output messages
```

### Application Logging
```javascript
// Structured logging pattern
console.log('User action', { userId, action, timestamp })
console.error('Error occurred', { error, context, userId })
```

---

## BACKUP & DISASTER RECOVERY

### MongoDB Backups
```
Atlas automatic backups: Every 6 hours
Manual backup: Via MongoDB Atlas dashboard
Retention: 35 days (free tier)
```

### Code Backup
```
Git repository: Full code history
GitHub: Remote backup
Deploy history: Available on Render & Vercel
```

### Environment Variables
```
Store separate from code
Documented in .env.example
Update when secrets change
Rotate JWT_SECRET periodically
```

---

## COMMON ENVIRONMENT VARIABLE VALUES

### Example Production Configuration

**Backend (Render) Environment Variables:**
```
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://pragnapoornasri_db_user:Pps2004@cluster0.unls6sa.mongodb.net/?appName=Cluster0
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=https://health-practitioner.vercel.app
MAX_FILE_SIZE_MB=20
```

**Frontend (Vercel) Environment Variables:**
```
VITE_API_URL=https://health-practitioner-api.onrender.com/api
VITE_SOCKET_URL=https://health-practitioner-api.onrender.com
```

---

## IMPORTANT NOTES

1. **JWT_SECRET**: Generate using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. **MongoDB**: Use strong passwords (20+ characters)
3. **CORS**: Always specify exact origin, never use wildcard "*" in production
4. **HTTPS**: All production connections must use HTTPS/WSS
5. **Environment Variables**: Never commit .env files to git
6. **Secrets Rotation**: Update JWT_SECRET and database password periodically
7. **Backups**: Always have MongoDB backups enabled
8. **Testing**: Test thoroughly after deployment before announcing to users

---

**Last Updated**: May 28, 2026  
**Version**: 1.0  
**Status**: Production Ready
