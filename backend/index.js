import express from 'express';
import { app, server } from './socket.js';
import { connectDb } from './db/connectDb.js';
import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

import cookieParser from 'cookie-parser';
import cors from 'cors'
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

import authRoutes from './routes/auth.route.js';
import inviteRoutes from './routes/invite.route.js';
import profileRoutes from './routes/profile.route.js';
import postRoutes from './routes/post.route.js';
import eventRoutes from './routes/event.route.js';
import notificationRoutes from './routes/notification.route.js';
import moderateRoutes from './routes/moderate.route.js';
import uploadRoutes from './routes/upload.route.js';
import channelRoutes from './routes/channel.route.js';
import channelMessageRoutes from './routes/channelMessage.route.js';
import searchRoutes from './routes/search.route.js';
import communityRoutes from './routes/community.route.js';
import billingRoutes from './routes/billing.route.js';
import friendRoutes from './routes/friend.route.js';
import dmRoutes from './routes/dm.route.js';
import serverInviteRoutes from './routes/serverInvite.route.js';
import { stripeWebhook } from './controllers/billing.controller.js';
import { ensureRootUser } from './utils/ensureRootUser.js';

const allowedOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // allow non-browser requests
        if (allowedOrigins.length === 0) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

// Stripe webhook must receive raw body for signature verification.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/moderate', moderateRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/channel-messages', channelMessageRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/server-invites', serverInviteRoutes);

const PORT = process.env.PORT || 3000;

// Use the HTTP server (not app.listen) so Socket.io is attached
server.listen(PORT, () => {
    (async () => {
        const dbConnected = await connectDb();
        if (dbConnected) {
            try {
                await ensureRootUser();
            } catch (error) {
                console.log("⚠️  Root user seed failed:", error.message || error);
            }
        }
        console.log(`Server is running on port ${PORT}`);
    })();
});
