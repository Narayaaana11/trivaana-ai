# TRIVAANA AI — Security & Compliance Architecture

## Authentication & Multi-Tenancy
- Passwords hashed with PBKDF2-HMAC-SHA256 (600,000 iterations).
- API keys (`api_keys`) and per-agent lead intake secrets (`intake_secret_hash`) stored exclusively as SHA-256 hashes.
- Strict tenant scoping across every database query and mutation; suspended workspaces are blocked at dependency resolution.
- Role-based access control (`owner`, `admin`, `manager`, `operator`, `viewer`) plus isolated `is_super_admin` gate for `/api/admin/*`.

## Payment & Webhook Security
- Razorpay orders are recorded server-side; payment verification reads the authoritative amount from the server order record and verifies HMAC-SHA256 signatures over raw request bodies.
- Outbound webhooks are signed with HMAC-SHA256 (`X-Trivaana-Signature`) + timestamps + idempotency keys, and custom API/webhook targets apply SSRF checks against private/loopback IP ranges.
- Carrier callbacks verify `X-Twilio-Signature` (HMAC-SHA1) and Exotel HTTP Basic / token authentication.

## Telecom Compliance (India TRAI TCCCPR)
- Enforces Do-Not-Call suppression, explicit consent records, promotional vs service/transactional call categorization, configurable calling hours, and recording disclosure flags prior to outbound dialing.

