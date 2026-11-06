# Product plan

## Goal

Create one responsive web app/PWA with role-based experiences for customers, shopkeepers, and platform administrators.

## Release 1 — safe pilot foundation

### Customer experience
- Browse active shops and their public product catalog without login.
- View shop address, contact details, product photos, prices, and pickup/delivery availability.
- Choose Shop Pickup or Home Delivery where the shop supports delivery.
- Ask for a delivery address only after Home Delivery is selected.
- Sign in when placing an order or using account-specific features.
- View only their own profile, orders, favourites, and history.
- Submit birthday, family event, wedding, anniversary, school, office, and other bulk/party requirements.
- Choose which contact and event details are shared with shops.
- Compare offers from shops responding to a request.

### Shopkeeper experience
- Register a shop with name, logo/photo, address, and contact number.
- First-time listing payment is ₹599 and includes listing review/approval plus the first 30-day subscription period.
- Submit renewal payment UTR of ₹299 for each following 30-day period; payments are manually verified by Admin.
- See LIVE/inactive subscription status.
- Manage shop profile and product listings with name, photo, price, category, and description; edit or delete each listing.
- Do not track stock, inventory, cost, or expiry dates.
- Manage incoming orders and customer requests.
- Configure whether home delivery is available.
- See only data belonging to the shop(s) the account is authorized to manage.

### Admin experience
- Restrict admin access to explicitly allowlisted accounts.
- Review shop registrations and UTR submissions.
- Approve/reject subscription payments and set shop LIVE/inactive.
- Review subscription and platform-level reports.
- Export operational data and manage backup/restore procedures.

## Later releases
- Favourites and opt-in offer notifications.
- Ratings, reviews, complaints, digital bills, repeat orders, and order tracking.
- Advanced catalog presentation, product variations, and customer-facing menu improvements (without inventory tracking).
- Loyalty points, coupons, expenses, profit reports, and PDF/Excel exports.
- Employee roles, multiple branches, offline billing with safe sync.
- Customer rewards and richer promotional tools.

## Important privacy rules
- Public catalog data is visible to all visitors.
- Customer profile details and transaction history are private by default.
- A shop may access only customer/order information needed for its own transactions.
- Party/bulk request visibility is limited to the fields the customer intentionally publishes.
- Never expose a customer's home address to shops that are not handling that delivery/order.

## Pilot approach
Start with a limited pilot (around 20 shops is an initial planning target, not a technical limit). Validate onboarding, catalog management, ordering, payment approval, backups, and data isolation before expanding.
