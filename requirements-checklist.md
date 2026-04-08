# CircleCore Requirements Status

Legend: [x] completed, [~] partial, [ ] missing

## Product Scope
- [x] Build an invite-only community platform for curated groups
- [x] Focus on high-trust, high-signal engagement over broad social noise
- [~] Support professional, hobbyist, and interest-based communities

## Authentication & Access
- [x] Support email and password login
- [x] Support OAuth sign-in for Google
- [x] Support OAuth sign-in for Apple
- [x] Support OAuth sign-in for LinkedIn
- [x] Require invite code entry during onboarding
- [x] Add email verification
- [x] Add optional two-factor authentication
- [x] Implement session management with refresh tokens
- [x] Add reCAPTCHA or similar anti-bot protection
- [x] Add session timeout and blocklist policies

## Profiles & Reputation
- [x] Create rich user profiles with avatar, bio, skills, and interests
- [x] Track member tier
- [x] Track community score and reputation signals
- [x] Support profile completeness onboarding

## Content & Community
- [x] Support posts with text and media
- [x] Support polls
- [x] Support resource links and file/document uploads
- [x] Support threaded replies
- [x] Support comment reactions
- [x] Organize content into channels
- [x] Add search, filters, pinning, featured content, saves, and hashtags

## Real-Time Features
- [x] Add live reactions and likes
- [x] Add live comments
- [x] Add presence and typing indicators
- [x] Use WebSockets or Socket.IO
- [x] Use Redis pub/sub for scaling real-time updates

## Events & Meetups
- [x] Support webinars, local meetups, and private online rooms
- [x] Add RSVP flows
- [x] Add calendar sync
- [x] Add reminders

## Notifications
- [x] Notify on mentions
- [x] Notify on replies
- [x] Notify on event invites
- [x] Notify on admin announcements
- [x] Notify on moderator actions
- [x] Deliver in-app notifications
- [x] Support email digests
- [x] Support optional push notifications

## Billing & Membership
- [x] Support free invite-only access
- [x] Support premium paid perks
- [ ] Support enterprise or white-label tiering
- [x] Integrate Stripe
- [~] Support auto-renewals
- [ ] Generate tax-compliant invoices

## Moderation & Safety
- [x] Add content flags
- [x] Add a moderator review queue
- [x] Add member warnings
- [x] Add temporary suspensions
- [x] Add blocklists
- [x] Maintain audit trails for moderation actions

## UX & Product Experience
- [x] Keep the UI clean, professional, and modern
- [x] Make the product mobile-first and responsive
- [x] Show clear identity and trust signals
- [x] Optimize for readability and low distraction
- [x] Build an invite-only onboarding flow from landing to first content
- [x] Build posting and event RSVP flows

## Data Model
- [x] Store users and profiles separately
- [x] Store communities with invite codes
- [x] Store posts with media, tags, and timestamps
- [x] Store threaded replies
- [x] Store events with RSVP lists
- [x] Store notifications with read state and metadata

## APIs & Backend
- [x] Define API routes for auth, content, events, notifications, billing, and moderation
- [x] Keep the API layer separate from the frontend
- [~] Support scalability from hundreds to tens of thousands of members

## Infrastructure & Deployment
- [x] Deploy the frontend on Vercel
- [ ] Deploy the backend on AWS ECS or Render
- [x] Use MongoDB Atlas for the database
- [x] Use Redis for cache, sessions, and presence
- [ ] Use AWS S3 for media storage
- [ ] Use CloudFront or a CDN for delivery
- [ ] Set up CI/CD with GitHub Actions
- [ ] Add monitoring with Sentry

## QA & Security
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Add end-to-end tests
- [ ] Add load testing
- [ ] Add security penetration testing
- [ ] Meet GDPR and opt-in communication requirements
- [x] Protect sessions and tokens

## Milestones
- [x] Week 1: auth, invite system, onboarding, feed, and basic channels
- [x] Week 2: comments, reactions, notifications, RSVP, search, and filters
- [~] Week 3: subscriptions, billing, admin panel, QA, security audit, and beta launch

## Notes
- [x] Google OAuth is implemented
- [x] Apple OAuth flow is implemented (provider dashboard credentials/callback setup required per environment)
- [x] LinkedIn OAuth flow is implemented (provider dashboard credentials/callback setup required per environment)
- [x] Frontend white screen startup issue was fixed (invalid icon imports in auth pages)
- [x] Access and refresh token session flow is implemented with cookie rotation
- [x] Session timeout, login lockout, and auth rate-limiting policies are implemented
- [x] Optional captcha verification is supported with RECAPTCHA_SECRET_KEY and RECAPTCHA_MIN_SCORE
- [x] Invite-only signup flow is implemented
- [x] Email verification flow is implemented
- [x] Premium billing flow is implemented
- [x] Moderation and audit logging are implemented
- [x] Realtime channel and DM features are implemented
- [~] Some deployment and compliance requirements are still plan-level only
