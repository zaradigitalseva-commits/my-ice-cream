# MY ICE CREAM

A mobile-first ice-cream marketplace and shop-management platform.

## Current foundation

The repository now contains a Next.js App Router + TypeScript starter, a responsive customer-facing landing page, Firebase Web SDK initialization, and a deny-by-default Firestore rules baseline.

## Product roles

- **Customer:** Browse public shops and products as a guest; sign in when needed for orders, saved items, and personal history.
- **Shopkeeper:** Manage one or more shops, products, stock, orders, billing, offers, and shop settings.
- **Admin:** Approve shop registrations and subscription payments, manage shop status, and view platform-level reports.

## Important product decisions

- Customers can browse without creating an account.
- Customer and shopkeeper sign-in is planned through Google sign-in; admin access must be restricted to explicitly authorized accounts.
- Planned shop subscription: ₹299 per month, with UTR submission and manual admin approval in the initial release.
- Home delivery is optional per shop. A customer is asked for a delivery address only after choosing Home Delivery.
- Customer private details and transaction history must not be visible to unrelated shops.
- Public party/bulk requests expose only the details the customer chooses to share.
- Product types are flexible: cups, cones, kulfi, sticks, family packs, scoops, and shop-defined products.

## Run locally

1. Install Node.js (LTS) and npm.
2. Clone this repository.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Fill the Firebase web app values in `.env.local` from Firebase Console.
6. Run `npm run dev` and open `http://localhost:3000`.

Required environment variables are listed in `.env.example`. Never commit `.env.local`.

## Security and cost principles

- This is a public repository. Never commit passwords, service-account keys, OAuth secrets, payment credentials, UTR screenshots, or customer data.
- Firebase client configuration is supplied through environment variables; security must be enforced with Firestore Rules and trusted authorization, not by hiding client config.
- Firestore rules currently deny all client reads and writes until the role and ownership model is implemented and tested.
- Do not enable paid services or incur charges without explicit approval. Firebase remains on the Spark plan.
- Do not assume free-tier usage is unlimited.
- Provide data export, regular backups, and tested restore procedures before relying on the app for business.

## Project documentation

- [Product plan](docs/PRODUCT_PLAN.md)
- [Security and data rules](docs/SECURITY_AND_DATA.md)
- [Technical decisions](docs/TECHNICAL_DECISIONS.md)

## Not production-ready yet

The current landing page is a starter shell, not a complete marketplace. Shop onboarding, database schema, secure roles and shop-level access rules, product uploads, ordering, subscription verification, admin tools, tests, deployment and backup/restore workflows still need to be built and reviewed.
