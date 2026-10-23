# Trivaana AI — Repository Audit Findings (Public GitHub Snapshot)

- Repository: https://github.com/Narayaaana11/trivaana-ai
- Branch: main
- Commit audited: d5796ac7d3fa32343fc82691643693f983046bd8
- Audit mode: read-only source review via public GitHub API. No code was changed and no local tests could be run in this environment.
- Important: the repo currently appears to contain a single initial commit, so this snapshot should be checked against the latest local working tree before remediation.

## Current stack observed
- Frontend: React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Framer Motion, lucide-react, Recharts, canvas-confetti, clsx, tailwind-merge, Oxlint.
- Backend: FastAPI, Pydantic, SQLite WAL database.
- Browser testing: not visible in package scripts; build/lint are available. Current local/previous audit claims are not accessible as current source code in this repo snapshot.

## P0 — Security, financial correctness, false outputs
1. `backend/main.py` configures CORS with `allow_origins=["*"]` and `allow_credentials=True`. Replace with explicit environment-configured origin allowlist and tests.
2. Public routes expose tenant/stats/leads/calls/transactions/agents without auth, and handlers query globally or write using hard-coded `tenant_enterprise_demo`. Implement authentication, authorization and tenant scoping before commercial use.
3. `backend/database.py` seeds a fixed tenant API key string and a demo wallet. Remove hard-coded credential, rotate/revoke any published credential, create per-environment secrets and never seed a privileged production key.
4. `backend/main.py` `/api/leads/discover` generates records from `sample_names` and random synthetic phone numbers but labels them as “OSM Autonomous Scout” and “Discovered via local business registry”. This is fabricated lead data, not discovery. Replace with a real, documented provider integration; on provider failure return an explicit error and no fake records.
5. `backend/main.py` `/api/calls/instant` creates a scripted transcript, hard-codes a 90-second completed call, ₹5.40 cost, fixed recording URL and 11.4-second callback latency. It does not dispatch a telephony provider call in the inspected code. Replace with real provider adapter and webhook/state-machine flow; otherwise return a clearly labelled sandbox simulation and never bill it as a real call.
6. `backend/main.py` `/api/calls/{call_id}/whatsapp` returns “dispatched/delivered” without invoking a provider. Implement real Meta Cloud API dispatch and delivery-status webhooks, or return NOT_CONFIGURED/BLOCKED; don't claim delivery.
7. `frontend/src/components/dashboard/FinancialLedgerPanel.tsx` generates fake payment ID and posts `sig_verified_mock_checksum` to the app webhook route, then shows “added successfully”. This lets the UI simulate a wallet recharge. Remove that client-side path. Use actual Razorpay Checkout/order creation and only credit wallet from verified, idempotent signed backend webhook. Separate test fixtures from runtime. This is a release blocker.
8. `backend/main.py` Razorpay order creation fabricates an order ID locally. The webhook handler accepts a client-supplied payload and increases wallet by supplied amount without checking signature/payment status/order amount/idempotency. Implement actual Razorpay API order creation, verify webhook raw-body signature from secret, verify payment/order state and amount server-side, idempotently fulfill each payment once, and tests.
9. Currency model is inconsistent: schema stores wallet as REAL and rate_per_min REAL; calls cost REAL; transaction amount_inr/running_balance REAL even though amount_paise exists. Move all money calculations/storage to integer paise (or exact Decimal at boundaries) with migration and reconciliation tests. Avoid client-supplied amounts being authoritative.
10. CORS credential wildcard and lack of auth/tenant scoping are critical issues before public deployment.

## P1 — Workflow functionality and state integrity
11. `/api/campaigns/start` only inserts a campaign with arithmetic estimates for placed/connected/demo outcomes. It does not enqueue or dispatch calls in the inspected implementation. Build a campaign worker/queue and real provider event-driven updates; until then label as simulation and prevent live launch.
12. `/api/campaigns/kill` only updates database rows to halted and returns text claiming “all active PRI lines severed”. It does not call carrier hang-up APIs. Implement carrier cancellation/hang-up for all known active provider call IDs; if unavailable, say stop requests queued/partial and expose exact status.
13. `AgentStudioPanel.tsx` `handleSavePrompt` only displays an alert saying prompt saved; no API persistence is visible. Add a backend update endpoint, tenant-scoped database transaction and reload verification.
14. `LiveCallSimulatorModal.tsx` uses hard-coded dialogue arrays, timer-based state transitions and browser SpeechSynthesis. This is a mock sandbox, not a real call or server-connected AI conversation. Clearly label as a scripted demo; add separate provider-backed real-time test agent only when enabled/configured.
15. `backend/main.py` CSV upload defaults missing name/phone fields and inserts a fabricated phone number `+91 99999 99999`. Reject invalid/missing fields, normalize phone numbers, return per-row validation errors, enforce file size/type limits and deduplicate contacts.
16. `/api/stats` hardcodes conversion rate 24.8%, latency 218 ms and active concurrency 5. Compute values from actual persisted events or return null/unavailable with no fake claim.
17. `backend/main.py` ignores API key argument in `/api/tenant`. Remove the insecure/unused parameter or replace with proper authenticated context. Never select “first tenant” for customer-facing endpoints.
18. Lead/call/agent/transaction list operations are globally scoped and do not implement pagination or RBAC. Tenant scope every query; add pagination and audit logging.
19. Timestamp generation uses naive `datetime.now()`; use UTC-aware timestamps consistently and render locale in UI.
20. Validate request limits: campaign concurrency/max_calls, lead-discovery limit, amount positivity, phone format, language choices, CSV size/encoding/headers and unexpected inputs.

## P2 — Architecture, operability and UX
21. Backend is concentrated in `backend/main.py` with only three dependencies; split into routes, schemas, services, provider adapters, auth/policy, billing, repositories, workers, config and tests as changes are made.
22. Add real provider interfaces and explicit configuration status for telephony, TTS, STT, WhatsApp, calendar, payments and lead discovery. The README alone does not prove those integrations are implemented.
23. Add tests: no automated test files/workflow were visible in the shallow tree currently returned; verify deeper tree and local workspace. Add unit, API integration, webhook security, tenant isolation, billing idempotency, provider adapter, Playwright UI and responsive suites.
24. Add GitHub Actions CI for Python lint/test, frontend lint/typecheck/build, dependency checks and secret scanning.
25. Improve UI state handling: replace `alert()`/fake success with toast/error boundary; ensure every button represents a real supported action; provide loading/error/empty states and accessible controls.
26. Inspect mobile menu, dialog focus management, keyboard support, reduced motion, chart/data accessibility, page overflow and real Playwright screenshots.
27. Product README claims “production-grade”, “verified” OSM leads, compliance, 11.4-second speed-to-lead and exact latencies. Those claims are not substantiated by the code reviewed. Replace with evidence-backed status. Do not claim TRAI compliance just from a fixed 10:00–18:00 display; requirements depend on call classification/provider setup and need legal verification.
28. Add startup config validation, secret manager/env variables, production-origin CORS, HTTPS/proxy settings, structured logs without PII, health/readiness endpoints, backups, database migrations and deployment/rollback guide.

## UI/source layout observed
- Landing: `frontend/src/components/landing/{HeroSection,LandingFooter,LandingNav,LandingPage,PricingSection,RoiCalculatorSection,VerticalPresetsSection}.tsx`
- Dashboard: `frontend/src/components/dashboard/{AgentStudioPanel,AppSidebar,CallIntelligencePanel,CampaignManagerPanel,FinancialLedgerPanel,LeadManagementPanel,LiveCallSimulatorModal,MissionControl,OverviewPanel,SpeedToLeadPanel}.tsx`
- UI components: `frontend/src/components/ui/BackgroundPattern.tsx`
- React Bits wrappers: `BlurText`, `CountUp`, `Magnet`, `ShinyText`, `SpotlightCard`
- Shared libraries: `frontend/src/lib/brand.ts`, `frontend/src/lib/trivaana-api.ts`
- Entry: `frontend/src/App.tsx`
The existing code is already organized into separate component folders, so prefer tightening conventions rather than blindly moving every file.

## Recommended repo candidates (evaluate, do not blindly clone all)
- UI primitives: https://github.com/shadcn-ui/ui (MIT)
- React motion: https://github.com/motiondivision/motion (MIT)
- React Bits: https://github.com/DavidHDev/react-bits (check exact license/source distribution before copying components; repo API reports license as NOASSERTION)
- Data tables: https://github.com/TanStack/table (MIT)
- Charts: https://github.com/recharts/recharts (MIT)
- Browser tests: https://github.com/microsoft/playwright (Apache-2.0)
- Voice runtime alternatives to benchmark before adopting: https://github.com/livekit/agents (Apache-2.0), https://github.com/pipecat-ai/pipecat (BSD-2-Clause)
- REA: https://github.com/morluto/rea (MIT, according to GitHub API at audit time)
Inspect current versions, peer dependencies, compatibility and licenses first. Prefer package-level installation or selective adaptation over wholesale repository copying. Do not clone branded assets or copied user-specific configuration from third parties.

## Testable Acceptance Gates
- P0 security, fabricated behavior and payment bugs resolved before any live customers.
- All list/modify routes auth-protected and tenant-scoped.
- Real lead discovery: sourced provider provenance + no synthetic phone numbers.
- Real calling: actual provider call ID/webhooks; correct lifecycle records; no false completed states.
- Kill switch sends actual provider termination actions where supported.
- WhatsApp success only after provider reports accepted/delivered, with statuses distinguished.
- Real payment: verified Razorpay signature, amount/order match, idempotency and one-time credit.
- Agent settings persist to DB and reload.
- CSV validation rejects invalid rows without default/fabricated contacts.
- Statistics computed from real data.
- CI green, browser E2E pass for desktop/mobile, no secret scan findings.
- Final release report distinguishes tested sandbox from live-verified external integrations.

This document is based on public source files fetched from the repository's main branch. Runtime tests, environment configuration, live credentials and authenticated Outpero application screens were not available from this remote source-only review.

## 8. Additional pricing and voice-provider gaps

29. **Pricing UI conflicts with the owner's selected pure per-minute model.** `frontend/src/components/landing/PricingSection.tsx` displays monthly subscription plans (the inspected source has ₹7,999/month and ₹24,999/month tiers) with included minute allowances, while the later product decision was to sell primarily by connected minute with number/channel rent separate. `backend/database.py` also seeds a ₹3.60/min rate. Do not hard-code three different pricing models. Create one backend-owned, versioned price catalog; ensure landing pricing, agent voice selection, campaign preflight, wallet estimation, invoices, and call debits all use the same returned price/rules.
30. **ROI claims/assumptions need substantiation.** `RoiCalculatorSection.tsx` hard-codes ₹3.20/min, fixed human costs/lead productivity, and illustrative conversion changes (6% baseline to 22% Trivaana). These should be configurable, explicitly labelled assumptions or replaced by customer-provided inputs and sources. Never present modeled results as measured product outcomes.
31. **Configured AI keys are not automatically used.** In the source reviewed, `backend/requirements.txt` only lists FastAPI, Uvicorn, Pydantic, multipart and requests; the backend endpoints shown do not call ElevenLabs, Sarvam or Deepgram APIs. I did not find a real provider client/adapter in the reviewed backend source. If API keys have been placed only in Antigravity or a local environment, they will not create functional speech integration by themselves. Implement server-side adapters, validated environment configuration, timeouts, status/error reporting and an integration test using non-production credentials. Never store keys in React env variables or commit them.
32. **Current frontend proxy only configures Vite development.** `frontend/vite.config.ts` proxies `/api` to `http://127.0.0.1:8001` for the Vite dev server. Production requires an actual reverse proxy/API base URL or same-origin routing configuration; do not assume that the development proxy is active in the production bundle.

