# Trivaana AI — Outpero-Parity Implementation Roadmap

1. **Phase A — Shell, Command Palette & Home Hero Prompt Builder**
   - Upgrade `AppSidebar.tsx` to grouped sections (`AI EMPLOYEES`, `RESULTS`, `CALLING`, `WORKSPACE`) with collapsible desktop toggle.
   - Upgrade `MissionControl.tsx` with `Search ⌘K` command palette, `Calling activity` live popover, `Notifications` popover, `Setup guide` 6-step floating checklist, and `Ask Trivaana` helper drawer.
   - Upgrade `OverviewPanel.tsx` with a dark hero Prompt Builder card (Language selector, `Natural spoken`, Mode selector, 14-category Industry Templates, `Paste JSON script` modal) above DB-driven KPIs and charts.

2. **Phase B — AI Employee Studio, Visual Flow & Prompt Diff**
   - Wire `AgentWorkflowCanvas.tsx` (React Flow) into `AgentStudioPanel.tsx` as a dedicated `Visual Call Flow` sub-tab.
   - Add side-by-side Prompt Version Diff Comparison & `Copy script` JSON export.

3. **Phase C — Calling Modes (Instant Leads, Split Campaigns, Incoming Calls, Voice Broadcast)**
   - Add dedicated `InstantLeadsPanel.tsx` (`Activity`, `Analytics`, `Queue`, `Sources`) and `IncomingCallsPanel.tsx` (`Overview`, `Calls`, `Messages`, `Missed callers`).
   - Upgrade `CampaignManagerPanel.tsx` with `Contact Lists` modal (`Reusable` & `Suppression`), Split Campaign Creator (`Mon–Sun` calling days, retry rules, sticky summary), and live progress.
   - Wire audio file upload & recipient CSV upload in `VoiceBroadcastPanel.tsx`.

4. **Phase D — Leads 4-View CRM, Conversations Polish, Developers Hub, Settings & Super Admin**
   - Upgrade `LeadManagementPanel.tsx` with `Pipeline` / `List` / `Cards` / `Priority` switcher, `More filters`, and Contact Detail drawer.
   - Upgrade `CallIntelligencePanel.tsx` with extracted-field pills, action badges, `.txt` transcript export, and audio playback.
   - Create `DevelopersPanel.tsx` (`Overview`, `API Keys`, `Webhooks` with 6 event checkboxes & transcript switch, `API Activity` logs).
   - Upgrade `SettingsPanel.tsx` (6 sub-tabs: General, Account/Verify Email, Remembered Callers, DNC, Credentials Vault, Privacy & Consent), `AuthModal.tsx` (Forgot/Reset Password), `FinancialLedgerPanel.tsx` (`Billing details` + GST top-up preview), and `SuperAdminPanel.tsx` (Failed Calls, System Errors, Platform Audit Logs).

5. **Phase E — Verification & Live Browser Inspection**
   - Clean up frontend lint warnings and add Vitest automated component/navigation/form tests.
   - Verify backend (`pytest`), frontend (`npm run lint`, `npm test`, `npm run build`), and inspect the live running Trivaana AI app in Chrome via the `browser` subagent.

