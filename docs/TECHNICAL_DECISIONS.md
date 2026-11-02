# Technical decisions

## Status

No hosting, database, authentication provider, payment gateway, or paid plan has been selected or connected yet.

## Requirements for the eventual stack
- Mobile-first responsive web app with installable PWA support.
- Secure Google sign-in for customers and shopkeepers.
- Server-enforced roles and strict shop/customer data isolation.
- Product image upload with client-side resizing/compression and storage limits.
- Database and image storage export/backup strategy.
- Reliable restore procedure and provider portability.
- No paid service activated without explicit approval.

## Selection checklist
Before choosing providers, verify current free-tier limits and terms for:
1. Commercial use and production eligibility.
2. Monthly active users, database reads/writes, bandwidth, and storage.
3. Image/file storage, egress, and backup costs.
4. Authentication quotas and Google sign-in configuration.
5. Server functions, scheduled jobs, and abuse protection.
6. Data export, backup frequency, and restore capabilities.
7. Data region, privacy terms, and account ownership.

## Decision rule
Choose the simplest stack that meets the security and backup requirements for the pilot. Re-check provider pricing and terms immediately before connecting or deploying. A free tier is a limited starting allowance, not a promise of permanently unlimited free operation.
