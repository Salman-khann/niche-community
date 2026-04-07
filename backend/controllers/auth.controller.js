import User from "../models/user.model.js";
import Community from "../models/community.model.js";
import Profile from "../models/profile.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, jwtVerify } from "jose";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { generateTokenandSetCookie } from "../utils/generateTokenandSetCookie.js";

import {
    sendVerificationEmail,
    sendWelcomeEmail,
    sendResetPasswordEmail,
    sendResetSuccessEmail,
} from "../mailtrap/emails.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const TWO_FACTOR_ISSUER = process.env.TWO_FACTOR_ISSUER || "CircleCore";
const MIN_SIGNUP_HUMAN_DELAY_MS = 3000;

const FRONTEND_URL = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
const BACKEND_URL = (process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, "");

const buildFrontendUrl = (pathname, params = {}) => {
    const url = new URL(pathname, FRONTEND_URL);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && `${value}` !== "") {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
};

const buildBackendUrl = (pathname, params = {}) => {
    const url = new URL(pathname, BACKEND_URL);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && `${value}` !== "") {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
};

const APPLE_REDIRECT_URI = (process.env.APPLE_REDIRECT_URI || buildBackendUrl("/api/auth/apple/callback")).trim();
const LINKEDIN_REDIRECT_URI = (process.env.LINKEDIN_REDIRECT_URI || buildBackendUrl("/api/auth/linkedin/callback")).trim();

const buildOAuthState = (provider, flow, inviteCode) => jwt.sign(
    {
        provider,
        flow: flow || "login",
        inviteCode: inviteCode || "",
        nonce: crypto.randomBytes(12).toString("hex"),
    },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
);

const buildTwoFactorTempToken = (userId) => jwt.sign(
    { userId, purpose: "two_factor_login" },
    process.env.JWT_SECRET,
    { expiresIn: "5m" }
);

const verifyTwoFactorTempToken = (token) => {
    if (!token) throw new Error("Two-factor login token is required");
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload?.purpose !== "two_factor_login") {
        throw new Error("Invalid two-factor login token");
    }
    return payload;
};

const verifyTotpCode = (secret, token) => {
    const value = (token || "").replace(/\s+/g, "").trim();
    if (!secret || !value) return false;
    return speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token: value,
        window: 1,
    });
};

const buildTwoFactorSecret = async (email, userName = "Member") => {
    const secret = speakeasy.generateSecret({
        name: `${TWO_FACTOR_ISSUER} (${email || userName})`,
        issuer: TWO_FACTOR_ISSUER,
        length: 20,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url, {
        margin: 1,
        width: 240,
        color: {
            dark: "#ffffff",
            light: "#111827",
        },
    });

    return {
        base32: secret.base32,
        otpauthUrl: secret.otpauth_url,
        qrCodeDataUrl,
    };
};

const ensureHumanSignup = (body = {}) => {
    const honeypot = `${body.website || body.company || body.url || ""}`.trim();
    if (honeypot) {
        throw new Error("Bot detection failed");
    }

    const startedAt = Number(body.formStartedAt || 0);
    if (startedAt > 0) {
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_SIGNUP_HUMAN_DELAY_MS) {
            throw new Error("Please take a moment before submitting the form");
        }
    }
};

const parseOAuthState = (state) => {
    if (!state) throw new Error("Missing OAuth state");
    const payload = jwt.verify(state, process.env.JWT_SECRET);
    return {
        provider: payload.provider,
        flow: payload.flow || "login",
        inviteCode: payload.inviteCode || "",
    };
};

const getInviteCommunity = async (inviteCode) => {
    const code = (inviteCode || "").trim();
    if (!code) {
        return { code: "", community: null, inviteEntry: null };
    }

    const community = await Community.findOne({
        "inviteCodes.code": code,
        "inviteCodes.isUsed": false,
    });
    if (!community) {
        return { code, community: null, inviteEntry: null };
    }

    const inviteEntry = community.inviteCodes.find(
        (inv) => inv.code === code && !inv.isUsed
    );
    if (!inviteEntry) {
        return { code, community: null, inviteEntry: null };
    }

    if (inviteEntry.expiresAt && new Date(inviteEntry.expiresAt) < new Date()) {
        return { code, community: null, inviteEntry: null };
    }

    return { code, community, inviteEntry };
};

const redirectOAuthError = (res, message, flow = "login") => {
    return res.redirect(302, buildFrontendUrl("/invite", {
        oauth_error: message,
        oauth_flow: flow,
    }));
};

const ensureProfile = async ({ userId, name = "", avatar = "" }) => {
    const profile = await Profile.findOneAndUpdate(
        { userId },
        {
            $setOnInsert: {
                userId,
                displayName: name || "",
                avatar: avatar || "",
            },
        },
        { new: true, upsert: true }
    );

    if (name && !profile.displayName) {
        profile.displayName = name;
    }
    if (avatar && !profile.avatar) {
        profile.avatar = avatar;
    }
    await profile.save();
    return profile;
};

const createOAuthLogin = async ({
    providerField,
    providerId,
    email,
    name,
    picture,
    inviteCode,
    isEmailVerified = true,
}) => {
    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedName = (name || "").trim();
    const trimmedInviteCode = (inviteCode || "").trim();

    let user = null;
    if (providerId) {
        user = await User.findOne({ [providerField]: providerId });
    }
    if (!user && trimmedEmail) {
        user = await User.findOne({ email: trimmedEmail });
    }

    let community = null;
    let inviteEntry = null;

    if (!user) {
        if (!trimmedInviteCode) {
            throw new Error("Invite code is required for new accounts");
        }

        ({ community, inviteEntry } = await getInviteCommunity(trimmedInviteCode));
        if (!community || !inviteEntry) {
            throw new Error("Invalid or already used invite code");
        }

        const randomPassword = crypto.randomBytes(32).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = new User({
            email: trimmedEmail,
            name: trimmedName || trimmedEmail.split("@")[0] || "Member",
            password: hashedPassword,
            [providerField]: providerId || null,
            isInviteVerified: true,
            isVerified: isEmailVerified,
        });
        await user.save();

        inviteEntry.isUsed = true;
        inviteEntry.usedBy = user._id;
        community.members.push(user._id);
        await community.save();

        user.memberships.push({ communityId: community._id, role: "member" });
        await user.save();
    } else {
        if (providerId && !user[providerField]) {
            user[providerField] = providerId;
        }
        if (trimmedName && (!user.name || user.name === user.email?.split("@")[0])) {
            user.name = trimmedName;
        }
        if (isEmailVerified) {
            user.isVerified = true;
        }
        await user.save();
    }

    await ensureProfile({
        userId: user._id,
        name: trimmedName || user.name,
        avatar: picture || "",
    });

    return user;
};

const completeOAuthLogin = async ({
    res,
    providerField,
    providerId,
    email,
    name,
    picture,
    inviteCode,
    isEmailVerified = true,
}) => {
    const user = await createOAuthLogin({
        providerField,
        providerId,
        email,
        name,
        picture,
        inviteCode,
        isEmailVerified,
    });

    generateTokenandSetCookie(res, user._id);
    user.lastLogin = new Date();
    await user.save();

    const profile = await Profile.findOne({ userId: user._id }).lean();
    const destination = profile?.isOnboarded ? "/feed" : "/onboarding";

    return res.redirect(302, buildFrontendUrl(destination));
};

const withTier = async (userDocOrLean) => {
    const userId = userDocOrLean?._id;
    if (!userId) return userDocOrLean;
    const profile = await Profile.findOne({ userId }).select("tier").lean();
    return {
        ...userDocOrLean,
        tier: profile?.tier || "free",
    };
};

// ── Google OAuth ───────────────────────────────────────────────────────────
export const googleAuth = async (req, res) => {
    const { credential, inviteCode } = req.body;

    try {
        if (!credential) {
            return res.status(400).json({ success: false, message: "Google credential is required" });
        }

        // Verify the Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;

        if (!email) {
            return res.status(400).json({ success: false, message: "Could not retrieve email from Google" });
        }

        // Check if user already exists
        let user = await User.findOne({ email });

        if (user) {
            // ── Existing user → log them in ─────────────────────────────────
            generateTokenandSetCookie(res, user._id);
            user.lastLogin = new Date();
            if (!user.googleId) user.googleId = googleId;
            await user.save();

            const populatedUser = await User.findById(user._id)
                .populate("memberships.communityId", "name slug icon")
                .lean();

            return res.status(200).json({
                success: true,
                message: "Logged in with Google",
                user: { ...(await withTier(populatedUser)), password: undefined },
            });
        }

        // ── New user → require invite code ──────────────────────────────────
        if (!inviteCode) {
            return res.status(400).json({
                success: false,
                message: "Invite code is required for new accounts",
            });
        }

        // Validate invite code
        const community = await Community.findOne({
            "inviteCodes.code": inviteCode.trim(),
            "inviteCodes.isUsed": false,
        });
        if (!community) {
            return res.status(400).json({
                success: false,
                message: "Invalid or already used invite code",
            });
        }

        const inviteEntry = community.inviteCodes.find(
            (inv) => inv.code === inviteCode.trim() && !inv.isUsed
        );
        if (!inviteEntry) {
            return res.status(400).json({
                success: false,
                message: "Invalid or already used invite code",
            });
        }
        if (inviteEntry.expiresAt && new Date(inviteEntry.expiresAt) < new Date()) {
            return res.status(400).json({
                success: false,
                message: "This invite code has expired",
            });
        }

        // Create user (no password needed, email auto-verified via Google)
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = new User({
            email,
            name: name || email.split("@")[0],
            password: hashedPassword,
            googleId,
            isInviteVerified: true,
            isVerified: true,  // Google already verified the email
        });
        await user.save();

        // Mark invite code as used
        inviteEntry.isUsed = true;
        inviteEntry.usedBy = user._id;
        community.members.push(user._id);
        await community.save();

        // Add membership
        user.memberships.push({ communityId: community._id, role: "member" });
        await user.save();

        // Create profile with Google avatar
        await Profile.create({
            userId: user._id,
            avatar: picture || "",
        });

        generateTokenandSetCookie(res, user._id);

        const populatedUser = await User.findById(user._id)
            .populate("memberships.communityId", "name slug icon")
            .lean();

        res.status(201).json({
            success: true,
            message: "Account created with Google",
            user: { ...(await withTier(populatedUser)), password: undefined },
        });
    } catch (error) {
        console.log("Error in googleAuth:", error);
        res.status(500).json({ success: false, message: error.message || "Google authentication failed" });
    }
};

// ── Apple OAuth Start ─────────────────────────────────────────────────────
export const appleStart = async (req, res) => {
    try {
        const inviteCode = req.query.inviteCode || "";
        const flow = req.query.flow || (inviteCode ? "signup" : "login");

        if (!process.env.APPLE_CLIENT_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY) {
            return res.status(500).json({
                success: false,
                message: "Apple OAuth is not configured on the server",
            });
        }

        const state = buildOAuthState("apple", flow, inviteCode);
        const authUrl = new URL("https://appleid.apple.com/auth/authorize");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("response_mode", "form_post");
        authUrl.searchParams.set("client_id", process.env.APPLE_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", APPLE_REDIRECT_URI);
        authUrl.searchParams.set("scope", "name email");
        authUrl.searchParams.set("state", state);

        return res.redirect(authUrl.toString());
    } catch (error) {
        console.log("Error in appleStart:", error);
        return res.status(500).json({ success: false, message: error.message || "Apple OAuth failed to start" });
    }
};

const createAppleClientSecret = () => {
    const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!privateKey) {
        throw new Error("APPLE_PRIVATE_KEY is required");
    }

    return jwt.sign(
        {},
        privateKey,
        {
            algorithm: "ES256",
            expiresIn: "5m",
            issuer: process.env.APPLE_TEAM_ID,
            subject: process.env.APPLE_CLIENT_ID,
            audience: "https://appleid.apple.com",
            keyid: process.env.APPLE_KEY_ID,
        }
    );
};

const exchangeAppleCode = async (code, redirectUri) => {
    const params = new URLSearchParams({
        client_id: process.env.APPLE_CLIENT_ID,
        client_secret: createAppleClientSecret(),
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
    });

    const response = await fetch("https://appleid.apple.com/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error_description || data.error || "Apple token exchange failed");
    }
    return data;
};

const verifyAppleIdToken = async (idToken) => {
    const { payload } = await jwtVerify(idToken, appleJwks, {
        issuer: "https://appleid.apple.com",
        audience: process.env.APPLE_CLIENT_ID,
    });
    return payload;
};

export const appleCallback = async (req, res) => {
    try {
        const code = req.body?.code || req.query?.code;
        const state = req.body?.state || req.query?.state;
        const userBlob = req.body?.user;

        if (!code || !state) {
            return redirectOAuthError(res, "apple_oauth_missing_code", "login");
        }

        const oauthState = parseOAuthState(state);
        const tokenData = await exchangeAppleCode(code, APPLE_REDIRECT_URI);
        const payload = await verifyAppleIdToken(tokenData.id_token);

        const appleUser = typeof userBlob === "string"
            ? JSON.parse(userBlob)
            : userBlob;

        const firstName = appleUser?.name?.firstName || "";
        const lastName = appleUser?.name?.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim();
        const email = (payload.email || appleUser?.email || "").trim().toLowerCase();

        if (!email) {
            return redirectOAuthError(res, "apple_email_unavailable", oauthState.flow);
        }

        await completeOAuthLogin({
            res,
            providerField: "appleId",
            providerId: payload.sub,
            email,
            name: fullName || email.split("@")[0],
            picture: "",
            inviteCode: oauthState.inviteCode,
            flow: oauthState.flow,
            isEmailVerified: String(payload.email_verified || "true") === "true",
        });
    } catch (error) {
        console.log("Error in appleCallback:", error);
        return redirectOAuthError(res, error.message || "Apple authentication failed", "login");
    }
};

// ── LinkedIn OAuth Start ───────────────────────────────────────────────────
export const linkedinStart = async (req, res) => {
    try {
        const inviteCode = req.query.inviteCode || "";
        const flow = req.query.flow || (inviteCode ? "signup" : "login");

        if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "LinkedIn OAuth is not configured on the server",
            });
        }

        const state = buildOAuthState("linkedin", flow, inviteCode);
        const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", LINKEDIN_REDIRECT_URI);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("scope", "r_liteprofile r_emailaddress");

        return res.redirect(authUrl.toString());
    } catch (error) {
        console.log("Error in linkedinStart:", error);
        return res.status(500).json({ success: false, message: error.message || "LinkedIn OAuth failed to start" });
    }
};

const exchangeLinkedInCode = async (code, redirectUri) => {
    const params = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    });

    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error_description || data.error || "LinkedIn token exchange failed");
    }
    return data.access_token;
};

const fetchLinkedInProfile = async (accessToken) => {
    const headers = { Authorization: `Bearer ${accessToken}` };

    const [profileResponse, emailResponse] = await Promise.all([
        fetch("https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))", { headers }),
        fetch("https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))", { headers }),
    ]);

    const profileData = await profileResponse.json();
    const emailData = await emailResponse.json();

    if (!profileResponse.ok) {
        throw new Error(profileData.message || profileData.serviceErrorCode || "LinkedIn profile fetch failed");
    }
    if (!emailResponse.ok) {
        throw new Error(emailData.message || emailData.serviceErrorCode || "LinkedIn email fetch failed");
    }

    const email = emailData?.elements?.[0]?.["handle~"]?.emailAddress || "";
    const picture = profileData?.profilePicture?.["displayImage~"]?.elements?.slice(-1)?.[0]?.identifiers?.[0]?.identifier || "";
    const fullName = `${profileData?.localizedFirstName || ""} ${profileData?.localizedLastName || ""}`.trim();

    return {
        providerId: profileData?.id || "",
        email: email.trim().toLowerCase(),
        name: fullName || email.split("@")[0] || "LinkedIn Member",
        picture,
    };
};

export const linkedinCallback = async (req, res) => {
    try {
        const code = req.query?.code || req.body?.code;
        const state = req.query?.state || req.body?.state;

        if (!code || !state) {
            return redirectOAuthError(res, "linkedin_oauth_missing_code", "login");
        }

        const oauthState = parseOAuthState(state);
        const accessToken = await exchangeLinkedInCode(code, LINKEDIN_REDIRECT_URI);
        const profile = await fetchLinkedInProfile(accessToken);

        if (!profile.email) {
            return redirectOAuthError(res, "linkedin_email_unavailable", oauthState.flow);
        }

        await completeOAuthLogin({
            res,
            providerField: "linkedinId",
            providerId: profile.providerId,
            email: profile.email,
            name: profile.name,
            picture: profile.picture,
            inviteCode: oauthState.inviteCode,
            flow: oauthState.flow,
            isEmailVerified: true,
        });
    } catch (error) {
        console.log("Error in linkedinCallback:", error);
        return redirectOAuthError(res, error.message || "LinkedIn authentication failed", "login");
    }
};

// ── Sign Up ─────────────────────────────────────────────────────────────────
export const signUp = async (req, res) => {
    const { email, password, name, inviteCode } = req.body;

    try {
        ensureHumanSignup(req.body);

        if (!email || !password || !name) {
            throw new Error("All fields are required");
        }

        if (!inviteCode) {
            throw new Error("Invite code is required");
        }

        // Validate invite code
        const community = await Community.findOne({
            "inviteCodes.code": inviteCode.trim(),
            "inviteCodes.isUsed": false,
        });

        if (!community) {
            return res.status(400).json({
                success: false,
                message: "Invalid or already used invite code",
            });
        }

        const inviteEntry = community.inviteCodes.find(
            (inv) => inv.code === inviteCode.trim() && !inv.isUsed
        );

        if (!inviteEntry) {
            return res.status(400).json({
                success: false,
                message: "Invalid or already used invite code",
            });
        }

        if (inviteEntry.expiresAt && new Date(inviteEntry.expiresAt) < new Date()) {
            return res.status(400).json({
                success: false,
                message: "This invite code has expired",
            });
        }

        const userAlreadyExist = await User.findOne({ email });
        if (userAlreadyExist) {
            return res.status(400).json({
                success: false,
                message: "User already exists",
            });
        }

        const hashpassword = await bcrypt.hash(password, 10);
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

        const user = new User({
            email,
            password: hashpassword,
            name,
            isInviteVerified: true,
            verificationToken,
            verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        });

        await user.save();

        // Mark invite code as used
        inviteEntry.isUsed = true;
        inviteEntry.usedBy = user._id;
        community.members.push(user._id);
        await community.save();

        // Add membership to user
        user.memberships.push({ communityId: community._id, role: "member" });
        await user.save();

        generateTokenandSetCookie(res, user._id);

        await sendVerificationEmail(user.email, verificationToken);

        // Re-fetch with populated memberships for the frontend
        const populatedUser = await User.findById(user._id).populate('memberships.communityId', 'name slug icon').lean();

        res.status(201).json({
            success: true,
            message: "User created successfully",
            user: {
                ...(await withTier(populatedUser)),
                password: undefined,
            },
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// ── Login ───────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        if (user.twoFactorEnabled && user.twoFactorSecret) {
            return res.status(200).json({
                success: true,
                requiresTwoFactor: true,
                twoFactorToken: buildTwoFactorTempToken(user._id),
                message: "Two-factor authentication required",
            });
        }

        generateTokenandSetCookie(res, user._id);
        user.lastLogin = new Date();
        await user.save();

        // Re-fetch with populated memberships so the frontend gets community names
        const populatedUser = await User.findById(user._id).populate('memberships.communityId', 'name slug icon').lean();

        res.status(200).json({
            success: true,
            message: "User logged in successfully",
            user: {
                ...(await withTier(populatedUser)),
                password: undefined,
            },
        });
    } catch (error) {
        console.log("Error in login:", error);
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const twoFactorSetup = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("email name twoFactorEnabled");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.twoFactorEnabled) {
            return res.status(400).json({ success: false, message: "Two-factor authentication is already enabled" });
        }

        const secret = await buildTwoFactorSecret(user.email, user.name);
        return res.status(200).json({
            success: true,
            secret: secret.base32,
            otpauthUrl: secret.otpauthUrl,
            qrCodeDataUrl: secret.qrCodeDataUrl,
            manualEntryKey: secret.base32,
            issuer: TWO_FACTOR_ISSUER,
        });
    } catch (error) {
        console.log("Error in twoFactorSetup:", error);
        return res.status(500).json({ success: false, message: error.message || "Unable to start 2FA setup" });
    }
};

export const twoFactorEnable = async (req, res) => {
    try {
        const { secret, code } = req.body;
        if (!secret || !code) {
            return res.status(400).json({ success: false, message: "Secret and verification code are required" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!verifyTotpCode(secret, code)) {
            return res.status(400).json({ success: false, message: "Invalid verification code" });
        }

        user.twoFactorEnabled = true;
        user.twoFactorSecret = secret;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Two-factor authentication enabled",
            user: {
                ...(await withTier((await User.findById(user._id).populate('memberships.communityId', 'name slug icon').lean()))),
                password: undefined,
            },
        });
    } catch (error) {
        console.log("Error in twoFactorEnable:", error);
        return res.status(500).json({ success: false, message: error.message || "Unable to enable 2FA" });
    }
};

export const twoFactorDisable = async (req, res) => {
    try {
        const { code } = req.body;
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!user.twoFactorEnabled || !user.twoFactorSecret) {
            return res.status(400).json({ success: false, message: "Two-factor authentication is not enabled" });
        }

        if (!verifyTotpCode(user.twoFactorSecret, code)) {
            return res.status(400).json({ success: false, message: "Invalid verification code" });
        }

        user.twoFactorEnabled = false;
        user.twoFactorSecret = null;
        await user.save();

        return res.status(200).json({ success: true, message: "Two-factor authentication disabled" });
    } catch (error) {
        console.log("Error in twoFactorDisable:", error);
        return res.status(500).json({ success: false, message: error.message || "Unable to disable 2FA" });
    }
};

export const twoFactorVerifyLogin = async (req, res) => {
    try {
        const { token, code } = req.body;
        const payload = verifyTwoFactorTempToken(token);
        const user = await User.findById(payload.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!user.twoFactorEnabled || !user.twoFactorSecret) {
            return res.status(400).json({ success: false, message: "Two-factor authentication is not enabled for this account" });
        }

        if (!verifyTotpCode(user.twoFactorSecret, code)) {
            return res.status(400).json({ success: false, message: "Invalid verification code" });
        }

        generateTokenandSetCookie(res, user._id);
        user.lastLogin = new Date();
        await user.save();

        const populatedUser = await User.findById(user._id).populate('memberships.communityId', 'name slug icon').lean();

        return res.status(200).json({
            success: true,
            message: "Two-factor authentication verified",
            user: {
                ...(await withTier(populatedUser)),
                password: undefined,
            },
        });
    } catch (error) {
        console.log("Error in twoFactorVerifyLogin:", error);
        return res.status(400).json({ success: false, message: error.message || "Unable to verify 2FA" });
    }
};

// ── Logout ──────────────────────────────────────────────────────────────────
export const logout = async (req, res) => {
    try {
        let userId = req.userId;
        if (!userId) {
            const token = req.cookies?.Token;
            if (token && process.env.JWT_SECRET) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    userId = decoded?.userId;
                } catch {
                    // ignore invalid token
                }
            }
        }

        if (userId) {
            const profile = await Profile.findOneAndUpdate(
                { userId },
                { $set: { presence: "offline" } },
                { new: true }
            );

            try {
                const { io } = await import("../socket.js");
                io.to(`user:${userId}`).emit("profile:updated", {
                    userId,
                    presence: "offline",
                    bio: profile?.bio,
                    displayName: profile?.displayName,
                    avatar: profile?.avatar,
                });
                io.emit("presence:update", {
                    userId,
                    presence: "offline",
                    bio: profile?.bio,
                    displayName: profile?.displayName,
                    avatar: profile?.avatar,
                });
            } catch {
                // ignore socket errors
            }
        }
    } catch {
        // best effort
    }

    res.clearCookie("Token");
    res.status(200).json({
        success: true,
        message: "Logged out successfully",
    });
};

// ── Verify Email ────────────────────────────────────────────────────────────
export const verifyEmail = async (req, res) => {
    const { code } = req.body;

    try {
        const user = await User.findOne({
            verificationToken: code,
            verificationTokenExpiresAt: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification code",
            });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiresAt = undefined;
        await user.save();

        await sendWelcomeEmail(user.email, user.name);

        const populatedUser = await User.findById(user._id)
            .populate('memberships.communityId', 'name slug icon')
            .lean();

        res.status(200).json({
            success: true,
            message: "Email verified successfully",
            user: {
                ...(await withTier(populatedUser)),
                password: undefined,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ── Forgot Password ─────────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid email",
            });
        }

        const resetToken = crypto.randomBytes(20).toString("hex");
        const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000; // 1 hour

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiresAt = resetTokenExpiresAt;
        await user.save();

        await sendResetPasswordEmail(
            user.email,
            `${process.env.CLIENT_URL}/reset-password/${resetToken}`
        );

        res.status(200).json({
            success: true,
            message: "Password reset link sent to your email",
        });
    } catch (error) {
        console.log("Error in forgotPassword:", error);
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// ── Reset Password ──────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpiresAt: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset token",
            });
        }

        const hashpassword = await bcrypt.hash(password, 10);

        user.password = hashpassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiresAt = undefined;
        await user.save();

        await sendResetSuccessEmail(user.email);

        res.status(200).json({
            success: true,
            message: "Password reset successful",
        });
    } catch (error) {
        console.log("Error in resetPassword:", error);
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// ── Check Auth ──────────────────────────────────────────────────────────────
export const checkAuth = async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate('memberships.communityId', 'name slug icon');

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found",
            });
        }

        res.status(200).json({
            success: true,
            user: {
                ...(await withTier(user._doc)),
                password: undefined,
            },
        });
    } catch (error) {
        console.log("Error in checkAuth:", error);
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
