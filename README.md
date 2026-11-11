# MY ICE CREAM

A mobile-first ice-cream marketplace and shop-management platform.

## Current foundation

The repository now contains a Next.js App Router + TypeScript starter, a responsive customer-facing landing page, Firebase Web SDK initialization, and a deny-by-default Firestore rules baseline.

## Product roles

- **Customer:** Browse public shops and products as a guest; sign in when needed for orders, saved items, and personal history.
- **Shopkeeper:** Manage shop details, product listings, customer orders, billing, offers, and shop settings. Inventory and stock tracking are intentionally not part of this app.
- **Admin:** Approve shop registrations and subscription payments, manage shop status, and view platform-level reports.

## Important product decisions

- Customers can browse without creating an account.
- Customer and shopkeeper sign-in is planned through Google sign-in; admin access must be restricted to explicitly authorized accounts.
- Shop pricing: first-time listing is ₹599 (includes Admin review and the first 30-day period); renewals are ₹299 per 30 days. UPI UTR is submitted for manual Admin verification; no payment gateway or auto-debit is used.
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


## Customer push notifications (new products)

The app can send Firebase Cloud Messaging (FCM) web-push notifications to customers who are signed in, have granted browser notification permission, and have registered this browser. Notifications are sent when a LIVE shop adds a new **active** product. Editing an existing product does not send another notification. The service worker displays the notification and opens that product when tapped.

### Required one-time Firebase setup

1. In Firebase Console for the project used by MY ICE CREAM, open **Project settings → Cloud Messaging → Web configuration** and generate a Web Push certificate key pair.
2. Add the **public** VAPID key as `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in the hosting provider's build/runtime environment, alongside the existing `NEXT_PUBLIC_FIREBASE_*` values. Rebuild/redeploy after setting it.
3. In Google Cloud Console, enable the **Firebase Cloud Messaging API** for the same project.
4. Create a service account for this Firebase project and grant it **Firebase Cloud Messaging API Admin** and **Cloud Datastore User** roles. Create a JSON key.
5. Add the complete JSON key as the server-only secret `FCM_SERVICE_ACCOUNT_JSON` in the hosting provider. Do not commit it to GitHub and do not prefix it with `NEXT_PUBLIC_`.
6. Publish `firebase/firestore.rules` in Firebase Console → Firestore Database → Rules. The new `pushSubscriptions` rule allows customers to manage only their own token records; customers cannot read other customers' tokens.
7. Deploy the application and test with two different customer devices/browsers. Sign in on each, install/open the app, tap **Allow Notifications**, then add a new active product from a LIVE shop.

The server verifies the Firebase ID token against Firestore's shop/product access rules before sending. It stores an idempotency record per product so editing a product or retrying the same request does not send duplicate notifications. Invalid FCM tokens are removed after FCM reports them as unregistered.

**Delivery limits:** customers must sign in at least once on each device, grant notification permission, and have a supported browser/OS with internet access. Browser/OS battery and notification settings can delay or suppress delivery. This is web push, not SMS or WhatsApp.
