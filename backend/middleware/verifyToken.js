import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const SESSION_IDLE_TIMEOUT_MS = Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES || 120) * 60 * 1000;

export const verifyToken = async (req, res, next) => {
    const token = req.cookies.Token;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized - no token provided",
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded || decoded.type !== 'access') {
            return res.status(401).json({
                success: false,
                message: "Unauthorized - invalid token",
            });
        }

        const user = await User.findById(decoded.userId).select('sessionVersion lastActivityAt lockoutUntil');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized - user not found' });
        }

        if (user.lockoutUntil && user.lockoutUntil > new Date()) {
            return res.status(403).json({ success: false, message: 'Account is temporarily locked' });
        }

        if (Number(decoded.sv || 0) !== Number(user.sessionVersion || 0)) {
            return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
        }

        if (user.lastActivityAt && Date.now() - new Date(user.lastActivityAt).getTime() > SESSION_IDLE_TIMEOUT_MS) {
            user.sessionVersion = (user.sessionVersion || 1) + 1;
            user.refreshTokenHash = null;
            user.refreshTokenExpiresAt = null;
            await user.save();
            return res.status(401).json({ success: false, message: 'Session timed out. Please log in again.' });
        }

        await User.findByIdAndUpdate(decoded.userId, { $set: { lastActivityAt: new Date() } });

        req.userId = decoded.userId;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Unauthorized - invalid token' });
        }
        console.log("Error in verifyToken middleware:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};
