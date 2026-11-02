# Technical decisions

## Current foundation

- Web framework: Next.js App Router with TypeScript.
- Client authentication/database SDK: Firebase Web SDK.
- Firebase project: `my-ice-cream-75a08`.
- Firebase web app: `MY ICE CREAM WEB`.
- Firebase services already enabled by the project owner: Google Authentication and Cloud Firestore in `asia-south1` (Mumbai).
- Billing remains on Firebase Spark (no-cost) plan.
- Firebase client configuration is read from `NEXT_PUBLIC_FIREBASE_*` environment variables. Real values belong in local `.env.local` or a hosting provider's environment settings, never in this public repository.
- Firestore rules currently deny all client access as a temporary safe baseline. Do not open reads/writes until role and ownership rules are implemented and tested.

## Status and limitations

This repository contains an initial responsive storefront shell and Firebase client initialization. It is not yet a complete marketplace and is not production-ready. Shop onboarding, database schema, secure role assignment, shop-level authorization, orders, uploads, subscription review, admin tools, tests, deployment and backup/restore workflows remain to be implemented.

## Requirements for the next releases

- Mobile-first responsive web app with installable PWA support.
- Secure Google sign-in for customers and shopkeepers.
- Server-enforced roles and strict shop/customer data isolation.
- Product image upload with client-side resizing/compression and storage limits.
- Database and image storage export/backup strategy.
- Reliable restore procedure and provider portability.
- No paid service activated without explicit approval.

## Selection checklist

Before production use, verify current free-tier limits and terms for:
1. Commercial use and production eligibility.
2. Monthly active users, database reads/writes, bandwidth, and storage.
3. Image/file storage, egress, and backup costs.
4. Authentication quotas and Google sign-in configuration.
5. Server functions, scheduled jobs, and abuse protection.
6. Data export, backup frequency, and restore capabilities.
7. Data region, privacy terms, and account ownership.

A free tier is a limited starting allowance, not a promise of permanently unlimited free operation.
