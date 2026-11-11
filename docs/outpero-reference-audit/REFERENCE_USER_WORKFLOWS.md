# Outpero Reference User Workflows

## 1. First-Time Workspace Onboarding
1. Land on `#/` with floating 6-step `Setup guide`.
2. Fill business details in Settings (`#/settings`).
3. Hire first AI employee via `#/employees/new` using natural-language prompt, industry template, or pasted JSON script.
4. Test the employee via browser/test call before publishing.
5. Add credits on `#/billing/add` (preset or custom amount + 18% GST).
6. Provision a Mobile/Landline business number via `#/numbers` (2-step KYC + number activation).
7. Launch calling across Instant Leads, Bulk Campaigns, or Incoming Calls.

## 2. Instant Lead Calling Workflow
1. Connect a source on `#/instant/sources` (Meta Lead Ads, IndiaMART, JustDial, Zoho, LeadSquared, Zapier/Make/Pabbly, Google Sheets, or `POST /lead-intake/{slug}` with `X-Outpero-Lead-Secret`).
2. Incoming lead enters `#/instant/queue` (`202 Accepted · calling in 30s`).
3. Live progress appears in `#/instant` (`Activity`) and top-bar `Calling activity`.
4. Completed call writes to `#/leads`, `#/conversations` (transcript, audio, summary, extracted fields), and fires signed `X-Outpero-Signature` webhooks.

## 3. Bulk Campaign Workflow
1. Optionally create `Reusable` and `Suppression` lists in `#/campaigns` -> `Lists`.
2. Click `New campaign` -> acknowledge/provision phone number if needed -> fill Basics, Employee, Contacts, Suppression list, Calling Hours/Days, Auto-retries, and Start timing on `#/campaigns/new`.
3. Click `Launch campaign` from the sticky summary card; pause/resume anytime.

## 4. Inbound Call Handling Workflow
1. Assign an inbound AI employee and map a live business number on `#/inbound` (`Who answers` & `Which number rings whom`).
2. Test in browser or dial the number (`Hear it yourself`).
3. Review answered calls, messages, and missed callers across `#/inbound/calls`, `#/inbound/messages`, and `#/inbound/missed`.

