# CircleCore Feature Additions (Short)

## Auth and Security
- OAuth polish (Google/Apple/LinkedIn callback handling), refresh-token endpoint, and stronger session controls.
- Added account lockout, auth rate limiting, and optional reCAPTCHA verification.

## Community and Engagement
- Reputation tracking + leaderboard API.
- CircleBot support: `/leaderboard`, `/digest`, scheduled posts, event reminders, weekly digest, and auto-role assignment.

## Billing and Membership
- Stripe premium + enterprise checkout support.
- Added billing APIs for subscription status, auto-renew toggle, billing portal, and invoices.
- Upgrade UI now supports enterprise checkout, billing management, and invoice links.

## Scalability and Performance
- Cursor pagination for channel messages, post comments, channel comments, and selected feed/search paths.
- Incremental loading UX for older messages/comments.
- MongoDB pool/timeout tuning env knobs and cursor-friendly indexes.
- Frontend responsiveness improvements: lazy-loaded routes, cancelable search requests, and memoized heavy cards.
