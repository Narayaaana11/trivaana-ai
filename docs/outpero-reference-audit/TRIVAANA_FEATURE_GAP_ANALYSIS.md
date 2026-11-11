# Trivaana AI vs. Outpero — Feature Gap Analysis

## Codebase-to-Reference Mapping

| Outpero Capability | Trivaana Status | Evidence / Gap Details |
|---|---|---|
| **Inset App Shell + Grouped Sidebar** | Partially Implemented | `AppSidebar.tsx` has flat list; needs grouped sections (`AI EMPLOYEES`, `RESULTS`, `CALLING`, `WORKSPACE`), collapsible sidebar, `Search ⌘K` command palette, `Calling activity` popover, and `Setup guide` checklist. |
| **Home Hero Prompt Builder + Templates + JSON Script Import** | Partially Implemented | `AgentStudioPanel.tsx` has prompt generator inside a modal; needs Outpero-style dark hero prompt card on Home/Create with `Natural spoken` toggle, `Mode` radio (`Instant`/`Bulk`/`Inbound`), 14-category Templates, and `Paste JSON script` import/export. |
| **AI Employee Builder, Lifecycle, Versioning, React Flow** | Already Implemented (Needs UI Polish) | Backend `agents.py` + `ai_prompt_service.py` complete; `AgentWorkflowCanvas.tsx` created; needs wiring into `AgentStudioPanel.tsx` + side-by-side Version Compare. |
| **Voice Library & Previews** | Already Implemented | `voices.py` + `voice_adapters.py` + `AgentStudioPanel.tsx` voice tab ready with 7 Indian languages & verification test. |
| **Instant Lead Calling (`Activity`, `Analytics`, `Queue`, `Sources`)** | Partially Implemented | Backend `public_intake.py` & `calls.py` complete; UI is currently a simple tab inside `CampaignManagerPanel.tsx` and needs dedicated sub-tabs (`Activity`, `Analytics`, `Queue`, `Sources`). |
| **Bulk Campaigns + Contact Lists (`Reusable` & `Suppression`) + Split Creator** | Partially Implemented | Backend `campaigns.py` & `contact_lists` ready; UI needs Contact Lists modal, Split Create Campaign view (Calling days Mon–Sun, Suppression list, Sticky Summary), and CSV mapper. |
| **Incoming Calls (`Overview`, `Calls`, `Messages`, `Missed callers`)** | Partially Implemented | Backend `inbound.py` complete; UI only has a single simulation button inside `CallIntelligencePanel.tsx` and needs a dedicated Incoming Calls workspace view. |
| **Voice Broadcast** | Already Implemented (Needs Audio Upload UI) | Backend `broadcasts.py` (including `upload-audio` & CSV) complete; `VoiceBroadcastPanel.tsx` needs audio file upload & recipient CSV upload buttons wired. |
| **Leads (`Pipeline`, `List`, `Cards`, `Priority`, `More filters`)** | Partially Implemented | `LeadManagementPanel.tsx` has list view & stages; needs 4-way view switcher (`Pipeline` Kanban, `List`, `Cards`, `Priority`), `More filters` drawer, and Contact Detail drawer. |
| **Conversations & Call Intelligence** | Partially Implemented | `CallIntelligencePanel.tsx` has transcripts, analysis, CSV export; needs extracted-field chips, action badges (WhatsApp/Sheets/CRM), `.txt` transcript download, and audio player. |
| **Performance / Analytics** | Already Implemented | `tenant.py` `/api/analytics` + `AnalyticsPanel.tsx` DB-driven charts & filters complete. |
| **Knowledge Base RAG** | Already Implemented | `knowledge.py` + `knowledge_service.py` + `KnowledgeBasePanel.tsx` complete. |
| **Actions, Integrations & Credentials Vault** | Partially Implemented | Backend `actions.py` & `integrations.py` complete; `IntegrationsPanel.tsx` needs webhook event checkboxes (`call.completed`, `call.not_connected`, etc.), `Include call transcripts` toggle, delivery logs, and WhatsApp templates UI. |
| **Developers Hub (`Overview`, `API Keys`, `Webhooks`, `API Activity`)** | Backend Ready / UI Split | Endpoints exist across `workspaces.py` & `integrations.py`; needs unified Developers hub (`DevelopersPanel.tsx`) with lead-intake curl quickstart, API keys, webhooks, and activity logs. |
| **Numbers & Channels** | Already Implemented | `phone_numbers.py` + `PhoneNumbersPanel.tsx` separates numbers/KYC from concurrency channels. |
| **Billing (`Overview`, `Statement`, `Billing details`, `Invoices`, `Add credits`)** | Partially Implemented | `billing.py` + `FinancialLedgerPanel.tsx` complete for ledger/invoices/top-up; needs `Billing details` sub-tab and 18% GST top-up preview. |
| **Settings (`General`, `Account`, `Remembered Callers`, `DNC`, `Credentials`, `Privacy`)** | Partially Implemented | `SettingsPanel.tsx` has profile/DNC/API keys; needs 6 clean sub-tabs including `Remembered Callers` (`GET/DELETE /api/caller-memory`), `Credentials` vault, `Privacy & Data` (consent records + audit logs), and live-call alert snooze controls. |
| **Auth Reset Flow & Automated Frontend Tests** | Missing | `AuthModal.tsx` needs Forgot/Reset password flow; `frontend/` needs Vitest component/form/navigation tests. |

