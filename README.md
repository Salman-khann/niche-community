# CircleCore (Niche Community)

CircleCore is a community platform with invite-only onboarding, real-time chat, posts, events, and upgrades. It ships as a full-stack app with a Vite + React frontend and an Express + MongoDB backend, plus sockets, email, uploads, and payments.

**Features**
1. Invite-only onboarding with email verification and password reset flows.
2. Communities, channels, posts, events, notifications, and search.
3. Direct messages and real-time updates with Socket.IO.
4. Media uploads via Cloudinary.
5. Stripe-powered premium upgrades.
6. Google OAuth sign-in.
7. Admin seed script for initial root user.

**Tech Stack**
1. Frontend: React 19, Vite, Tailwind CSS, React Router, Zustand, Socket.IO client.
2. Backend: Node.js, Express, MongoDB (Mongoose), Socket.IO, Redis adapter, Stripe, Mailtrap, Cloudinary.

**Repository Layout**
1. `backend/` Express API, Socket.IO server, MongoDB models, and background utilities.
2. `frontend/` Vite + React client app.

**Prerequisites**
1. Node.js 18+ and npm.
2. MongoDB connection string.
3. Optional services for full features: Mailtrap, Cloudinary, Stripe, Redis, Google OAuth.

**Quick Start (Local)**
1. Install backend dependencies:
   `cd backend && npm install`
2. Install frontend dependencies:
   `cd ../frontend && npm install`
3. Create environment files (see below).
4. Start backend:
   `cd ../backend && npm run dev`
5. Start frontend:
   `cd ../frontend && npm run dev`

The frontend will run on `http://localhost:5173` and the backend on `http://localhost:3000` by default.

**Environment Variables**
Create these files locally and do not commit real secrets.

Backend: `backend/.env`
```env
NODE_ENV=development
PORT=3000

# Database
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority

# Auth
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173

# Email (Mailtrap)
MAILTRAP_TOKEN=your_mailtrap_token
MAILTRAP_ENDPOINT=https://send.api.mailtrap.io/
SENDER_EMAIL=hello@example.com
SENDER_NAME=CircleCore

# Media (Cloudinary)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Payments (Stripe)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Seed defaults (optional, used by seed script)
ROOT_ADMIN_NAME=admin
ROOT_ADMIN_EMAIL=admin@example.com
ROOT_ADMIN_PASSWORD=strong_password

# Realtime scaling (optional, for multiple socket servers)
REDIS_URL=redis://localhost:6379

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Apple OAuth
APPLE_CLIENT_ID=your_apple_services_id
APPLE_TEAM_ID=your_apple_team_id
APPLE_KEY_ID=your_apple_key_id
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# Optional server URL override for OAuth callbacks
SERVER_URL=http://localhost:3000
```

When configuring Apple and LinkedIn in their provider dashboards, register these callback URLs:
- Apple: `http://localhost:3000/api/auth/apple/callback`
- LinkedIn: `http://localhost:3000/api/auth/linkedin/callback`

Frontend: `frontend/.env`
```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
VITE_TURN_URL=turn:your-turn-server:3478
VITE_TURN_USERNAME=turn_username
VITE_TURN_CREDENTIAL=turn_credential
```

**Seeding a Root Admin**
1. Ensure the backend env vars for `ROOT_ADMIN_*` are set.
2. Run:
   `cd backend && npm run seed:root`

**Build & Deploy**
1. Build frontend: `cd frontend && npm run build`
2. For Vercel SPA routing, keep the rewrite in `frontend/vercel.json` so deep links resolve.

### Deploy Frontend on Vercel
1. In Vercel, create a new project from this repo.
2. Set the project root to `frontend`.
3. Framework preset: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add frontend environment variables (at least):
   - `VITE_API_URL=https://<your-backend-vercel-domain>`
   - `VITE_SOCKET_URL=https://<your-realtime-backend-domain>` (optional, see realtime note below)
7. Deploy.

### Deploy Backend on Vercel
1. Create a second Vercel project from the same repo.
2. Set the project root to `backend`.
3. Keep `backend/vercel.json` as committed (routes all requests to `api/index.js`).
4. Add backend environment variables from the `backend/.env` template in this README.
5. Set `CLIENT_URL` to your frontend domain (or comma-separated list of allowed frontend origins).
6. Deploy and test `GET /api/health`.

### Important Vercel Serverless Limits
1. Socket.IO realtime and long-running schedulers (leaderboard bot, reminders, notification digests) are not guaranteed on Vercel serverless functions.
2. If you need persistent realtime sockets, run the Socket.IO backend on a persistent host (for example Render/Railway/Fly) and point `VITE_SOCKET_URL` to that host.
3. REST API endpoints continue to work on Vercel through `backend/api/index.js`.

**Troubleshooting**
1. If invite links open a blank page on Vercel, verify the rewrite in `frontend/vercel.json`.
2. If emails do not send, confirm Mailtrap token and sender address.
3. If uploads fail, re-check Cloudinary credentials and upload preset configuration.
