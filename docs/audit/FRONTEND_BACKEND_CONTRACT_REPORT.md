# TRIVAANA AI — Frontend & Backend Contract Report (`HEAD d1d4319`)

**Audit Date:** 2026-11-11  
**Commit:** `d1d4319b47a9fa3bbcec2ac02b4a7eca63e92fff`  
**Live Frontend Baseline:** `oxlint` (`0` errors, `1` warning across `74` files); `vitest` (`17/17` unit tests across `2` files); `tsc -b && vite build` (`1.27s`); interactive live Chromium click-through remains `NOT_VERIFIED` (`docs/QA/BROWSER_QA_REPORT.md:5`).

---

## 1. Confirmed UI ↔ Backend API Contract Bugs (`P1`/`P2`)

| ID | Sev | Frontend Location | Backend Location | Contract Mismatch & Actual Impact |
|---|---|---|---|---|
| **FE-F01** | `P1` | `VoiceBroadcastPanel.tsx:185-186` | `broadcasts.py:196` | UI reads `res.added_count`; backend returns `{"added": added, "dnc_blocked": blocked}`. UI displays `"Added undefined CSV recipient(s)"`. Also uses browser `speechSynthesis` (`L130`) instead of `/preview-audio`, omits `indicf5`, and lacks `try/catch` in `startBroadcast` (`L195`). |
| **FE-F02** | `P1` | `CampaignManagerPanel.tsx:503-504` | `campaign_service.py:415` (`worker/tasks.py:144`) | UI reads `r.requeued_jobs`; backend returns `"dispatched"` (and `worker/tasks.py:144` reads `"requeued_count"`). UI displays `"Processed undefined due retry job(s)"`. UI also locks `leadVertical='Real Estate'` (`L67`) and shows `Resume` for completed/halted campaigns (`L467-487`). |
| **FE-F03** | `P1` | `LeadManagementPanel.tsx:63-70, 140, 546` | `lead_service.py:42-46, 95-98` | UI maps `email` in CSV column mapper, but `validate_and_import_csv` ignores `email` and `call_category` completely (`email` dropped on import). `handleQuickCall` (`L197-206`) hardcodes `language: 'te-IN'` and `is_sandbox: true`. |
| **FE-F04** | `P1` | `WorkflowsPanel.tsx:24-30, 108-114`, `AgentWorkflowCanvas.tsx:44-49` | `workflows.py:76-95` | `AgentWorkflowCanvas` has no `key={activeWf?.id}` or `useEffect` on `initialGraph`, so switching workflows never updates the canvas. `saveMut` ignores header `name`/`triggerType` when editing an existing workflow, and there is no "New Workflow" button. |
| **FE-F05** | `P1` | `MissionControl.tsx:672-687`, `AppSidebar.tsx:130-138`, `App.tsx:150-172` | `admin.py`, `support.py` | 1) `#/admin` renders `<SuperAdminPanel />` for non-super-admins, firing 6 `403` calls. 2) `#/staff` passes `hasStaffAccess={Boolean(userProfile?.is_super_admin)}`, locking out users with `staff_role` inside `MissionControl`. 3) `onExitToCustomer` in `AdminPortal`/`StaffPortal` enters `'dashboard'` even when unauthenticated, firing 6 `401` calls. |
| **FE-F06** | `P1` | `FinancialLedgerPanel.tsx:80, 98-103, 191-195, 221-226, 346-355`, `App.tsx:89-91` | `billing.py:26-29, 124-149`, `billing_service.py:100-101` | 1) Top card shows `₹6.50/min`, bottom card hardcodes `₹5.00`/`₹6.80`. 2) Checkout shows `₹1,000 + ₹180 GST = ₹1,180` while submitting `amount_inr=1000` to backend tax-inclusive invoice logic (`₹847.46 + ₹152.54`). 3) No UI for `GET/POST /api/billing/subscription`, and `handleSelectPlan` (`App.tsx:89`) discards selected plan ID. 4) `Save Billing Details` lacks `try/catch` and refresh. |
| **FE-F07** | `P1` | `IntegrationsPanel.tsx:6-13, 123`, `DevelopersPanel.tsx:18-25` | `integrations.py:121, 187-228`, `webhook_service.py` | 1) `IntegrationsPanel` connects providers with `{enabled: true}`, tricking `/test` (`L210`) into reporting `"credentials verified"`. 2) UI subscribes to `call.not_connected`, `lead.qualified`, `lead.created`, `call.inbound_answered`, `call.inbound_missed`, `campaign.status_changed`—none of which are emitted (`WebhookService` only dispatches `lead.intake_called` and `call.{status}`). |
| **FE-F08** | `P2` | `AgentStudioPanel.tsx:152, 296-300`, `LiveCallSimulatorModal.tsx:78-112` | `agents.py:359`, `ai_prompt_service.py:274-277` | 1) `testHistory`/`nextHistory` already includes the latest user message AND passes `message: msg`, causing `simulate_agent_turn` to append the user's message twice to the LLM. 2) `handleSaveAgent` always sends `system_prompt` + `structured_config`, bumping `agent_versions` on every minor field save. 3) `LiveCallSimulatorModal` doesn't stop `new Audio(...)` on barge-in and is text-only (never uses LiveKit or WS audio). |
| **FE-F09** | `P2` | `AdminPortal.tsx:29-35`, `SuperAdminPanel.tsx:33-43, 145-162` | `admin.py:122, 146, 303` | `AdminPortal` never loads current kill-switch state on mount; `SuperAdminPanel` omits `GET /api/admin/users` and omits inputs for `broadcast_paise_per_call`, `channel_rental_paise_per_month`, and `gst_percentage`. |
| **FE-F10** | `P2` | `AppointmentsPanel.tsx:48-52` | `appointments.py:20-32` | Uses raw text defaults `'2026-11-15T11:00:00+05:30'` instead of date/time picker; omits `email` and `notes` fields; `oxlint` warns on `useReactTable` (`L114`). |

---

## 2. Unsaved State, Stale Sub-Tabs & Missing Flows (`P2`)

1. **Conditional Unmounting Loses Drafts (`MissionControl.tsx:585-688`)**: Switching sidebar tabs unmounts the panel component, discarding unsaved edits in `AgentStudioPanel`, `SettingsPanel`, `WorkflowsPanel`, etc.
2. **Hash Sub-Tab Props Ignored After Mount**: `InstantLeadsPanel.tsx:20`, `IncomingCallsPanel.tsx:16`, `FinancialLedgerPanel.tsx:40`, `SettingsPanel.tsx:26`, and `DevelopersPanel.tsx:32` capture `initialSubTab`/`initialTab` once in `useState(...)`. Navigating between `#/settings/dnc` and `#/settings/memory` does not update the active sub-tab.
3. **`SettingsPanel.tsx` Local-Only `alertPrefs` & Missing Invite/Revoke Flows**:
   - `alertPrefs` (`L44-48, 170-173`) is local React state only—never persisted to `PUT /api/workspaces/current` (`low_balance_threshold_paise`).
   - `inviteMember` (`L263-269`) discards `invite_token`, and no frontend page handles `POST /api/auth/accept-invite`.
   - `Credentials Vault` (`L385-415`) duplicates workspace API keys (not provider credentials) and lacks key revocation (`DELETE /api/workspaces/api-keys/{id}`).
4. **`PublicContactPage` (`PublicPages.tsx:439-462`)**: Form submission calls `setSent(true)` locally with zero backend API request.
5. **Duplicated Store State (`MissionControl.tsx:269` vs `stores/useAppStore.ts`)**: `MissionControl` manages `userProfile`, `tenant`, `stats`, and `theme` locally instead of syncing with `useAppStore`.

---

## 3. Hardcoded Demo Values, Misleading Marketing Claims & Dead Code (`P2`/`P3`)

- **Hardcoded UI Values**:
  - `MissionControl.tsx:300`: Setup guide step `5. Connect a business number` hardcodes `done: true`.
  - `InstantLeadsPanel.tsx:146`: Hardcodes `<SplitFlapText text="< 15S" />` SLA latency.
  - `PhoneNumbersPanel.tsx:77-86`: Hardcodes `₹999/mo` and `₹1,499/mo` (contradicting backend `₹799`/`₹649`).
  - `HeroSection.tsx:422`: Claims `"Trusted by 5,000+ businesses"`; `256` vs `424` contradict (`₹500 Demo Wallet` vs `50 free credits`).
  - `DocsPortalPage.tsx:44`: Claims `"140+ industry templates"` (`templates.ts` has `27` across `14` categories).
- **Dead / Unused Client Exports**:
  - `trivaana-api.ts`: `addCallingChannel`, `benchmarkVoicePipeline`, `discoverLeads`, `getAgent`, `getPricing`, `getReadiness`, `getVoiceEngineStatus`.
  - `platformService.ts`: `listWorkflowExecutions`.
  - `reactbits/index.ts`: 14 unused primitive exports (`CircularText`, `GlassSurface`, `GooeyNav`, `GradualBlur`, `HoldButton`, `LatticeLoader`, `ParticlesBackground`, `PixelTransition`, `PromptBar`, `RippleButton`, `ScrambledText`, `ScrollReveal`, `Shuffle`, `TextLoop`).
- **Build & Lint Status**: `tsc -b && vite build` produces a `668.86 kB` main bundle (`index-CHkvYa9k.js`, Vite >500kB warning) — portal code-splitting via `React.lazy` is not yet applied for `AdminPortal` / `StaffPortal` / `MissionControl`.

