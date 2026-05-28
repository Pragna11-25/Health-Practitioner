# Patient-Practitioner Hub

Production-ready teleconsultation foundation built with React, Node.js, MongoDB, JWT, and Socket.IO.

## Implemented Modules
- Separate registration/login for patients and practitioners
- JWT-based authentication and protected role-aware dashboards
- Profile management for both roles
- Secure one-to-one real-time messaging
- File sharing in chat (image, medical document, DICOM-supported extensions)
- Mobile-first responsive UI for phone/tablet/desktop
- Security middleware (Helmet, rate limiting, NoSQL/XSS sanitization)

## Tech Stack
- Frontend: React (Vite), React Router, Axios, Socket.IO Client
- Backend: Node.js, Express, Socket.IO, Multer
- Database: MongoDB (Atlas-ready via `MONGODB_URI`)
- Auth: JWT

## Run Locally

### 1) Backend
```bash
cd server
copy .env.example .env
# fill MONGODB_URI and JWT_SECRET
npm run dev
```

### 2) Frontend
```bash
cd client
copy .env.example .env
npm run dev
```

## API Endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/me`
- `PATCH /api/users/me`
- `GET /api/users/role/:role`
- `POST /api/chat/conversations`
- `GET /api/chat/conversations`
- `GET /api/chat/messages/:conversationId`
- `POST /api/upload`

## Future Scope Ready
Current architecture is designed to support voice/video consultation and richer telemedicine workflows in later iterations.
