import express from 'express';
import {
    login,
    logout,
    signUp,
    verifyEmail,
    forgotPassword,
    resetPassword,
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
} from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

router.get('/check-auth', verifyToken, checkAuth);

router.post('/signup', signUp);
router.post('/login', login);
router.post('/logout', logout);
router.post('/verify-email', verifyEmail);
router.post('/forgotpassword', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/google', googleAuth);
router.get('/apple/start', appleStart);
router.all('/apple/callback', appleCallback);
router.get('/linkedin/start', linkedinStart);
router.get('/linkedin/callback', linkedinCallback);
router.post('/2fa/setup', verifyToken, twoFactorSetup);
router.post('/2fa/enable', verifyToken, twoFactorEnable);
router.post('/2fa/disable', verifyToken, twoFactorDisable);
router.post('/2fa/verify-login', twoFactorVerifyLogin);

export default router;
