# Yamzz Payment Gateway 3.0

Merchant-owned QRIS payment infrastructure for Vercel.

## Included
- Merchant register/login/session
- Static QRIS parser and nominal QR generator
- Payment API with idempotent order_id
- Hosted payment page
- Transaction dashboard, search, filters and CSV export
- Dashboard metrics and 7-day chart
- API key regeneration
- Webhook endpoint + HMAC-SHA256 secret
- Notification endpoint settings
- Account/profile/password management
- Application health status
- API documentation page
- PWA install shell

## Important payment-status limitation
Generating a nominal QR does not itself prove that a customer has paid. The gateway must receive a supported, legitimate transaction-status/notification signal from the merchant's QRIS/acquirer before marking a transaction `paid`.

## Deploy
1. Create/link Vercel Postgres and expose the required `POSTGRES_*` variables.
2. Set `SESSION_SECRET` to a long random value.
3. Deploy the project.
4. Call `POST /api/index?route=setup-db` once.
5. Register a merchant and save their own QRIS payload.

For production, keep merchant API keys server-side. Do not embed them in public frontend JavaScript.
