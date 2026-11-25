# Roles & permissions

| Role | Login | Scope |
|---|---|---|
| Guest (customer) | Mobile + OTP | Own profile, bookings, wishlist, travellers, reviews, support |
| Vendor | Email + password (`/vendor/login`) | Own properties, rooms, rates, inventory, bookings, earnings, reports. Live operations need **approved** status. Admin can set per-vendor limits: max properties, inventory/pricing edit rights, instant booking vs request-to-book, commission override |
| Master admin | `/admin/login` | Everything |
| Sub-admin | `/admin/login` | Only the modules the master grants. **Never revenue data.** |

## Sub-admin permission catalogue
Assignable: `dashboard, users, vendors, properties, catalog, inventory, bookings, coupons, content, reviews, support, seo, media, appearance, integrations`.

Never assignable (master only): `finance` (transactions, refunds, revenue on dashboard), `payouts`, `commission`, `revenue_reports`, plus
sub-admin management, audit log and the tax/commission settings.

## Enforcement (defence in depth)
1. `Admin` model validator + pre-save hook strip revenue permissions from sub-admins.
2. Sub-admin controller filters permissions on create/update.
3. `can(...)` middleware returns 403 for revenue permissions when role ≠ master.
4. `stripRevenueForSubadmin` removes `commission`, `vendorPayoutAmount`, `payout` from every JSON response for sub-admins
   (e.g. booking lists they *can* see).
5. Dashboard controller computes revenue aggregates only for the master.
6. UI hides revenue navigation, columns and widgets (`useAuth().can()`, `RequirePerm`).

Sub-admins can see the booking total a customer paid (needed for support/refund conversations) but not commission, payouts or aggregate revenue.
