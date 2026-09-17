# Yamzz Payment Gateway 3.0

Implemented from the feature flow shown in the supplied reference video, with original Yamzz UI/implementation.

### Dashboard
- Today's/yesterday's gross revenue
- Success ratio
- Average successful transaction
- Pending/expired totals
- Total gross volume
- 7-day revenue chart

### QRIS
- QRIS payload storage
- QR image decoding
- QR preview
- Merchant QRIS metadata

### Payments
- Idempotent `order_id`
- Dynamic nominal QR payload generation
- Expiry window
- Hosted payment page
- Public payment status page

### Developer
- API key display/regeneration
- Webhook URL + HMAC-SHA256 secret
- Webhook test
- API docs

### Activity
- Search/filter transaction history
- Invoice detail
- CSV export

### Account/System
- Profile update
- Password update
- Health/status page
- Notification endpoint settings
- PWA install shell

### Limitation
The gateway does not hold merchant funds. A QR generated from a static QR payload is not proof that a payment occurred. A legitimate upstream/acquirer status or notification channel is required before a transaction can be marked `paid`.
