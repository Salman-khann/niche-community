import express from 'express';
import {
    login,
    logout,
    refreshToken,
    signUp,
    verifyEmail,
    forgotPassword,
    resetPassword,
    changePassword,
    checkAuth,
    googleAuth,
    appleStart,
    appleCallback,
    linkedinStart,
    linkedinCallback,
    twoFactorSetup,
    twoFactorEnable,
    twoFactorDisable,
    twoFactorVerifyLogin,
    logoutAllDevices,
    regenerateRecoveryCodes,
} from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { authRateLimit } from '../middleware/authRateLimit.js';

const router = express.Router();

router.get('/check-auth', verifyToken, checkAuth);

router.post('/signup', authRateLimit, signUp);
router.post('/login', authRateLimit, login);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.post('/verify-email', verifyEmail);
router.post('/forgotpassword', authRateLimit, forgotPassword);
router.post('/reset-password/:token', authRateLimit, resetPassword);
router.post('/change-password', verifyToken, changePassword);
router.post('/google', authRateLimit, googleAuth);
router.get('/apple/start', appleStart);
router.all('/apple/callback', appleCallback);
router.get('/linkedin/start', linkedinStart);
router.get('/linkedin/callback', linkedinCallback);
router.post('/2fa/setup', verifyToken, twoFactorSetup);
router.post('/2fa/enable', verifyToken, twoFactorEnable);
router.post('/2fa/disable', verifyToken, twoFactorDisable);
router.post('/2fa/verify-login', authRateLimit, twoFactorVerifyLogin);
router.post('/2fa/recovery-codes', verifyToken, regenerateRecoveryCodes);
router.post('/logout-all', verifyToken, logoutAllDevices);

export default router;
