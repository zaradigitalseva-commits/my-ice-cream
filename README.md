# MY ICE CREAM

A mobile-first ice-cream marketplace and shop-management platform.

## Project status

Early planning and foundation stage. This repository is separate from the existing `school` and `ngo-connect` projects.

## Product roles

- **Customer:** Browse public shops and products as a guest; sign in when needed for orders, saved items, and personal history.
- **Shopkeeper:** Manage one or more shops, products, stock, orders, billing, offers, and shop settings.
- **Admin:** Approve shop registrations and subscription payments, manage shop status, and view platform-level reports.

## Important product decisions

- Customers can browse without creating an account.
- Shopkeeper and customer sign-in are planned through Google sign-in; admin access must be restricted to explicitly authorized accounts.
- Planned shop subscription: ₹299 per month, with UTR submission and manual admin approval in the initial release.
- Home delivery is optional per shop. A customer is asked for a delivery address only after choosing Home Delivery.
- Customer private details and transaction history must not be visible to unrelated shops.
- Public party/bulk requests expose only the details the customer chooses to share.
- Product types are flexible: cups, cones, kulfi, sticks, family packs, scoops, and shop-defined products.

## Development principles

1. Build a small pilot first; do not assume unlimited free hosting or storage.
2. Never commit passwords, API keys, OAuth secrets, payment credentials, or customer data.
3. Enforce shop-level data isolation on the server/database, not only in the user interface.
4. Provide data export, regular backups, and tested restore procedures before relying on the app for business.
5. Do not enable paid services or incur charges without explicit approval.
6. Keep the architecture portable so hosting or database providers can be changed later.

## Planned documentation

- [Product plan](docs/PRODUCT_PLAN.md)
- [Security and data rules](docs/SECURITY_AND_DATA.md)
- [Technical decisions](docs/TECHNICAL_DECISIONS.md)

## Current status

No production services, payment gateway, domain, or paid plan has been connected.
