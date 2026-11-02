# Security and data requirements

These are mandatory design constraints, not optional UI preferences.

## Public repository safety
This repository is public. Commit only source code, documentation, and safe examples.
- Never commit real API keys, passwords, OAuth client secrets, service-account files, payment credentials, UTR screenshots, customer records, or production exports.
- Keep local secrets in ignored environment files and production secrets in the hosting provider's secret manager.
- `.env.example` may contain placeholder names only, never real values.

## Access control
- Enforce authorization in trusted server/database rules for every read and write.
- Customer accounts can read their own profile and order history.
- A shop account can read/write only shops and records explicitly assigned to it.
- Admin access must use a server-verified allowlist or equivalent authorization; a client-side role flag is not sufficient.
- Employees receive only the permissions required for their assigned role.

## Data minimization
- Do not ask for a home address until the customer selects Home Delivery.
- Collect only the event/request details a customer chooses to share.
- Keep customer contact details and delivery addresses private from unrelated shops.
- Do not put personal data in public product listings, URLs, logs, or analytics.

## Operational resilience
- Define export formats before launch.
- Schedule backups and periodically test restoring them into a separate environment.
- Document retention and deletion rules.
- Keep the data model and file storage portable; avoid relying on a single provider-specific feature without an exit plan.

## Payments
- Initial subscription workflow is manual UTR submission and admin verification.
- Never store card, UPI PIN, banking password, or other payment authentication secrets.
- Store only the minimum payment reference and approval audit information needed.
- Do not claim a subscription is paid until an authorized admin verifies it.
