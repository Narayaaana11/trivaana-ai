# TRIVAANA AI — Billing & Financial Integrity Report (`HEAD d1d4319`)

**Audit Date:** 2026-11-11  
**Commit:** `d1d4319b47a9fa3bbcec2ac02b4a7eca63e92fff`

---

## 1. P0 Findings (Critical Financial Blockers)

### BILL-F01 — Live Razorpay Payment Verification Crashes With `NameError` (`requests` Not Imported)
- **Severity:** `P0`
- **Source File & Function:** `backend/providers/razorpay_adapter.py:9, 117-135` (`RazorpayPaymentProvider.fetch_payment`), called by `backend/routers/billing.py:226-238` (`verify_and_credit_payment`)
- **Evidence:** `razorpay_adapter.py:9` imports `httpx`, not `requests`. Inside `fetch_payment()`, when `self.is_configured` is `True`, line `128` executes `resp = requests.get(...)`. `verify_and_credit_payment` catches this `NameError` at `billing.py:237-238` and raises `HTTP 502 Bad Gateway`.
- **Reproduction:** Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, create an order, submit a valid HMAC signature to `POST /api/billing/razorpay-verification` -> returns `502: Failed to verify payment with Razorpay gateway: name 'requests' is not defined`.
- **Expected Behavior:** `fetch_payment` uses `httpx.get(...)` cleanly to confirm `status`, `amount`, and `currency` with Razorpay.
- **Actual Behavior:** 100% failure on live Razorpay checkout verification.
- **Recommended Fix:** Replace `requests.get` with `httpx.get` in `razorpay_adapter.py:128`.
- **Regression Test:** `test_live_razorpay_fetch_payment_uses_httpx_without_name_error` (monkeypatching `httpx.get` with live keys configured).
- **Acceptance Criteria:** Live-configured Razorpay verification executes `fetch_payment()` without `NameError` and verifies amount/currency/status.

### BILL-F02 — Production Free-Credit Exploit If Razorpay Keys Are Missing
- **Severity:** `P0`
- **Source File & Function:** `backend/providers/razorpay_adapter.py:53-67, 89-93`, `backend/routers/billing.py:167-225`
- **Evidence:** Unlike `POST /api/billing/sandbox-topup` (`billing.py:362`), `create_razorpay_order` and `verify_and_credit_payment` have no `ENVIRONMENT` check. If `RAZORPAY_KEY_ID` or `RAZORPAY_KEY_SECRET` is empty in production, `create_order` issues `order_sandbox_*`, and `verify_payment_signature` accepts any `order_sandbox_*` + `pay_sandbox_*` pair without HMAC.
- **Reproduction:** Boot with `ENVIRONMENT=production` and unset Razorpay keys -> `POST /api/billing/razorpay-order` + `/razorpay-verification` credits up to ₹5,00,000 for free.
- **Recommended Fix:** Guard sandbox order creation and sandbox signature verification behind `ENVIRONMENT not in ("production", "prod")` (and fail closed with `503` in production if unconfigured).
- **Regression Test:** `test_razorpay_sandbox_bypass_blocked_in_production`.
- **Acceptance Criteria:** Production mode rejects unconfigured Razorpay checkout with `503`.

### BILL-F03 — Admin Emergency Kill Switch Is Unenforced Across All Calling Paths
- **Severity:** `P0`
- **Source File & Function:** `backend/routers/admin.py:303-328` (`admin_emergency_kill_switch`)
- **Evidence:** Writes `{'paused': True, 'reason': ...}` to `platform_settings` under `key = 'emergency_outbound_pause'`. Codebase-wide search confirms `'emergency_outbound_pause'` is **never queried** by `CallService.initiate_call`, `CampaignService`, `calls.py`, `public_intake.py`, `broadcasts.py`, or `worker/tasks.py`.
- **Reproduction:** Activate global emergency kill switch (`outbound_paused: true`), then call `POST /api/calls/instant` or `POST /api/campaigns/start` -> calls still proceed.
- **Recommended Fix:** Enforce `emergency_outbound_pause` inside `ComplianceService.evaluate_pre_call` and `CallService.initiate_call` (plus `CampaignService` and `broadcasts.py`), returning `503` when active.
- **Regression Test:** `test_global_emergency_kill_switch_blocks_all_outbound_calls`.
- **Acceptance Criteria:** Activating the platform kill switch immediately blocks instant calls, public intake calls, campaigns, retries, and broadcasts.

---

## 2. P1 Findings (High Financial & Pricing Gaps)

### BILL-F04 — Call Billing Ignores Admin Tariffs, Premium Voice Tier, Concurrency Balance Reserves & Debit Failures
- **Severity:** `P1`
- **Source File & Function:** `backend/services/call_service.py:52-61, 140-190`, `backend/routers/broadcasts.py:226`, `backend/routers/tenant.py:26-28`
- **Evidence:**
  1. `CallService.process_call_event` (`L140-144`) passes `settings.RATE_STANDARD_PAISE_PER_MIN` (`650`) instead of `BillingService.get_pricing_catalog(conn)`, ignoring Super Admin tariff updates (`commercial_tariffs` in `platform_settings`) and rounding overrides. Same in `call_service.py:57`, `tenant.py:26-28`, and `broadcasts.py:226`.
  2. `RATE_PREMIUM_PAISE_PER_MIN` (`850` paise/min) is **never applied** anywhere—agents using ElevenLabs/premium neural voices are billed at `650` paise/min.
  3. `CallService.process_call_event` (`L151`) does not catch `InsufficientBalanceError`; if wallet balance drops below call cost mid-call, the carrier callback fails with `HTTP 500` and never updates `calls.status`, `duration_seconds`, or `recording_url`.
  4. `CallService.initiate_call` (`L52-61`) checks `wallet_balance_paise >= 650` without holding/reserving funds for parallel in-flight calls, enabling overdraft via concurrency.
- **Recommended Fix:** Resolve effective tariff from `BillingService.get_pricing_catalog(conn)` + voice tier (`standard` vs `premium`), enforce balance reserve/overdraft handling cleanly on terminal callbacks so call status/duration are always persisted.

### BILL-F05 — Non-Atomic `debit_wallet` Commits & Non-Atomic Running Balance Reads
- **Severity:** `P1`
- **Source File & Function:** `backend/services/billing_service.py:152-168, 181-245`, `backend/routers/billing.py:140-163`, `backend/routers/broadcasts.py:225-253`
- **Evidence:**
  - `BillingService.debit_wallet()` (`L245`) always calls `conn.commit()` (lacks `commit: bool = True` unlike `credit_wallet`). Thus `process_call_event`, `start_broadcast`, and `update_subscription` commit wallet debits independently before updating `calls`, `voice_broadcast_recipients`, or `tenants.plan`/`subscriptions`.
  - Both `credit_wallet` (`L152-159`) and `debit_wallet` (`L216-226`) run `UPDATE tenants` followed by a separate `SELECT wallet_balance_paise FROM tenants`, allowing `running_balance_paise` skew under concurrent PostgreSQL `READ COMMITTED` transactions.
  - Positive verification (`billing.py:248-271, 331-348`): Razorpay client verification & webhook share `idempotency_key = f"razorpay_order_{order_id}"`, atomic `UPDATE payment_orders ... WHERE status != 'paid'`, and single `conn.commit()`. (Minor gaps: webhook `L319-321` skips currency check, and `invoice_number` `TAX-2026-XXXXXX` uses only 6 chars of payment ID, risking `UNIQUE` collision.)
- **Recommended Fix:** Add `commit: bool = True` to `debit_wallet`, use `UPDATE ... RETURNING wallet_balance_paise`, and wrap multi-table updates in single atomic transactions.

### BILL-F06 — Conflicting Prices & Tax-Inclusive vs Tax-Exclusive GST Mismatch
- **Severity:** `P1`
- **Source File & Function:** `backend/core/config.py:192-196`, `backend/services/billing_service.py:100-101`, `backend/routers/billing.py:124-149`, `frontend/src/components/dashboard/FinancialLedgerPanel.tsx:80, 167, 191-195, 221-226`, `PhoneNumbersPanel.tsx:77-86`, `PricingSection.tsx`, `VoiceShowcaseSection.tsx`, `HeroSection.tsx`, `PublicPages.tsx`, `DocsPortalPage.tsx`
- **Evidence:**
  - **8+ conflicting price points**: `config.py` = `₹6.50`/`₹8.50/min`, Number `₹799/mo`, Channel `₹649/mo`; `FinancialLedgerPanel.tsx` shows `₹6.50/min` at top (`L167`) and `₹5.00`/`₹6.80` at bottom (`L222-226`); `PhoneNumbersPanel.tsx` displays `₹999/mo` / `₹1,499/mo`; `HeroSection.tsx` / `VoiceShowcaseSection.tsx` / `PublicPages.tsx` / `DocsPortalPage.tsx` advertise `₹5.00`/`₹6.80` (`README.md` says `₹3.60`); `HeroSection.tsx` contradicts itself (`₹500 Demo Wallet` at `L256` vs `50 free credits` at `L424`).
  - **GST math bug**: `FinancialLedgerPanel.tsx:191-195` shows `Credits: ₹1,000 + GST 18%: ₹180 = Total Payable: ₹1,180`, yet `handleQuickRecharge` (`L80`) sends `amount = 1000` to `createRazorpayOrder`. Backend credits `₹1,000` to wallet and writes a tax-inclusive invoice (`₹847.46 + ₹152.54 GST = ₹1,000`).
  - **Subscription billing**: `billing.py:124-149` debits flat `299900`/`799900`/`2499900` paise without adding 18% GST (despite UI `"per month + 18% GST"`) and creates no `invoices` record.
- **Recommended Fix:** Make `/api/billing/pricing` (backed by `platform_settings` + `config.py`) the single source of truth across all landing & dashboard components, and align GST-inclusive vs GST-exclusive checkout & invoice calculation.

### BILL-F07 — Provider COGS & Monthly Number/Channel Rentals Completely Unwired
- **Severity:** `P1`
- **Source File & Function:** `workers/billing/reconciler.py:10-30`, `backend/routers/phone_numbers.py:125-149, 208-226`, `backend/routers/admin.py:254-283`
- **Evidence:**
  - `record_provider_cogs()` in `workers/billing/reconciler.py` is **never imported or called anywhere**; `provider_usage_costs` is always empty, making `gross_margin_paise` in `/api/admin/finance/summary` artificially equal `earned_usage_revenue_paise`.
  - `phone_numbers` (`79900` paise/mo) and `calling_channels` (`64900` paise/mo) record rental prices in DB without ever debiting wallets or generating monthly invoices.

---

## 3. P2 Findings (Accounting & Reporting Accuracy)

### BILL-F08 — Admin Finance Summary Conflates Promo, Sandbox, Subscriptions & Usage Revenue
- **Severity:** `P2`
- **Source File & Function:** `backend/routers/admin.py:254-283` (`admin_finance_summary`), `backend/services/billing_service.py:100, 108`, `backend/routers/billing.py:368`, `backend/database/seed.py:268`
- **Evidence:**
  1. `earned_usage_revenue_paise` sums all `transactions WHERE type = 'debit'` (conflating subscription fees, promotional credit spend, and metered calling).
  2. `purchased_credits_paise` sums `transactions WHERE type = 'credit' AND invoice_id IS NOT NULL`, which mistakenly counts `sandbox-topup` (`invoice_id = "DEV-SANDBOX-..."`) and seeded demo credits (`invoice_id = "TAX-2026-001"`).
  3. `BillingService._record_invoice` hardcodes `/ 1.18` and `18.0`, ignoring `gst_percentage` from admin `commercial_tariffs`.
  4. Inbound calls (`inbound.py`) have no billing hooks unless a carrier callback hits `/api/calls/callback/{call_id}`.
- **Recommended Fix:** Tag transactions by category (`call_usage`, `subscription`, `number_rental`, `topup`, `sandbox`, `promo`), separate promo wallet balances from cash liabilities, and read `gst_percentage` from the pricing catalog.

