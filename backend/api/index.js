import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import mongoose from 'mongoose';

import { connectDb } from '../db/connectDb.js';
import { stripeWebhook } from '../controllers/billing.controller.js';

import authRoutes from '../routes/auth.route.js';
import inviteRoutes from '../routes/invite.route.js';
import profileRoutes from '../routes/profile.route.js';
import postRoutes from '../routes/post.route.js';
import eventRoutes from '../routes/event.route.js';
import notificationRoutes from '../routes/notification.route.js';
import moderateRoutes from '../routes/moderate.route.js';
import uploadRoutes from '../routes/upload.route.js';
import channelRoutes from '../routes/channel.route.js';
import channelMessageRoutes from '../routes/channelMessage.route.js';
import searchRoutes from '../routes/search.route.js';
import communityRoutes from '../routes/community.route.js';
import billingRoutes from '../routes/billing.route.js';
import friendRoutes from '../routes/friend.route.js';
import dmRoutes from '../routes/dm.route.js';
import serverInviteRoutes from '../routes/serverInvite.route.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();

app.use(cors({
    origin: (_origin, callback) => callback(null, true),
    credentials: true,
}));

app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
    const state = mongoose.connection.readyState;
    const connected = state === 1;
    res.status(connected ? 200 : 503).json({
        ok: connected,
        service: 'backend',
        db: {
            connected,
            readyState: state,
        },
    });
});

app.get('/api/test', (_req, res) => {
    res.status(200).json({ message: 'Hello World' });
});

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

let dbConnectPromise;
const ensureDbConnection = async () => {
    if (!dbConnectPromise) {
        dbConnectPromise = connectDb()
            .then((connected) => {
                if (!connected) {
                    throw new Error('MongoDB connection failed');
                }
                return true;
            })
            .catch((error) => {
                dbConnectPromise = null;
                throw error;
            });
    }
    return dbConnectPromise;
};

export default async function handler(req, res) {
    try {
        await ensureDbConnection();
        return app(req, res);
    } catch (error) {
        console.log('Serverless bootstrap error:', error?.message || error);
        return res.status(500).json({ success: false, message: 'Server startup failed' });
    }
}
