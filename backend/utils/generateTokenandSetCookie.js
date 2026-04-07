import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user.model.js';

const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 15 * 60);
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 30 * 24 * 60 * 60);

const getTokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

const isLocalOrigin = () => {
    const client = String(process.env.CLIENT_URL || '').toLowerCase();
    const server = String(process.env.SERVER_URL || '').toLowerCase();
    return client.includes('localhost') || client.includes('127.0.0.1')
        || server.includes('localhost') || server.includes('127.0.0.1');
};

const shouldUseSecureCookies = () => process.env.NODE_ENV === 'production' && !isLocalOrigin();

export const generateTokenandSetCookie = async (res, userOrId) => {
    const user = typeof userOrId === 'object'
        ? userOrId
        : await User.findById(userOrId).select('_id sessionVersion');

    if (!user?._id) {
        throw new Error('Cannot issue auth token for missing user');
    }

    const accessToken = jwt.sign(
        { userId: user._id, type: 'access', sv: user.sessionVersion || 1 },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
    );

    const refreshToken = jwt.sign(
        { userId: user._id, type: 'refresh', sv: user.sessionVersion || 1 },
        process.env.JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_TTL_SECONDS }
    );

    const useSecureCookies = shouldUseSecureCookies();

    res.cookie('Token', accessToken, {
        httpOnly: true,
        secure: useSecureCookies,
        sameSite: useSecureCookies ? 'none' : 'lax',
        maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });

    res.cookie('RefreshToken', refreshToken, {
        httpOnly: true,
        secure: useSecureCookies,
        sameSite: useSecureCookies ? 'none' : 'lax',
        path: '/api/auth',
        maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });

    await User.findByIdAndUpdate(user._id, {
        $set: {
            refreshTokenHash: getTokenHash(refreshToken),
            refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
            lastActivityAt: new Date(),
        },
    });

    return { accessToken, refreshToken };
};

export const clearAuthCookies = (res) => {
    const useSecureCookies = shouldUseSecureCookies();
    const cookieOptions = {
        httpOnly: true,
        secure: useSecureCookies,
        sameSite: useSecureCookies ? 'none' : 'lax',
    };

    res.clearCookie('Token', cookieOptions);
    res.clearCookie('RefreshToken', { ...cookieOptions, path: '/api/auth' });
};

export const hashRefreshToken = getTokenHash;
