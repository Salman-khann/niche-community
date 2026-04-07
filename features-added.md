# CircleCore Feature Additions (Session Log)

This file tracks only the features and fixes added in this implementation session.

## Frontend Fixes and UX
- Fixed white-screen crash by replacing invalid LinkedIn icon imports on login and signup pages
- Improved OAuth error visibility on invite page (shows real provider error messages)
- Added reCAPTCHA policy/terms disclosure text on auth pages

## OAuth and Auth Flow Improvements
- Added explicit OAuth callback URI env support for Apple and LinkedIn
- Standardized Apple and LinkedIn redirect URI handling in backend start/callback flow
- Added `/api/auth/refresh-token` endpoint for access-token renewal

## Session and Security Enhancements
- Implemented access + refresh token cookie rotation
- Added refresh token hashing and expiry persistence on user sessions
- Added session versioning for token invalidation
- Added idle session timeout enforcement
- Added account lockout after repeated failed login attempts
- Added auth endpoint rate limiting middleware
- Added session revocation on logout and password reset

## Anti-Bot / reCAPTCHA
- Added backend optional reCAPTCHA verification support (`RECAPTCHA_SECRET_KEY`, `RECAPTCHA_MIN_SCORE`)
- Added auth env configuration for rate limits, lockout, and token TTLs
- Added frontend reCAPTCHA integration for login/signup/forgot-password
- Migrated frontend reCAPTCHA from invisible v3 flow to visible v2 checkbox flow

## Tracking Updates
- Updated `requirements-checklist.md` authentication/access statuses to completed where implemented

## Reputation and Leaderboard
- Implemented structured reputation signal tracking for posts, comments, likes, helpful replies, and channel activity
- Added community-level score aggregation (`communityScore`) with score signal counters
- Added leaderboard API endpoint (`GET /api/profile/leaderboard`) for top members and top communities

## Full Bot Features
- Added bot account flags in user model (`isBot`, `botKey`)
- Added `CircleBot` auto-provisioning on backend startup
- Added `/leaderboard` chat command handling in channels
- Added `/digest` chat command handling in channels
- Added scheduled leaderboard auto-posts to announcement/text channels
- Added event reminder bot posts (24h, 1h, 10m before start)
- Added weekly digest auto-posts with 7-day community stats
- Added reputation-based auto-role assignment (`top-contributor` by threshold)
- Updated bot leaderboard output to render as table-style blocks
- Added leaderboard bot environment controls (`LEADERBOARD_BOT_*`)
