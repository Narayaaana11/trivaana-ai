# Outpero Reference Form Fields

## 1. Prompt Builder (`#/` & `#/employees/new`)
- `Language`: Combobox (`Hindi`, `Telugu`, `Tamil`, `Kannada`, `Malayalam`, `Marathi`, `English`)
- `Natural spoken`: Checkbox (default: `true`)
- `Prompt`: Multiline textarea (`What should your AI employee do?`)
- `Calling Mode` (`#/employees/new`): Radio group (`Instant`, `Bulk`, `Inbound`)
- `Copied script JSON` (Modal): Multiline textarea, validated by `Check script`

## 2. Campaign Creator (`#/campaigns/new`)
- `Campaign name`: Text input (required)
- `Employee`: Select dropdown (AI Employee)
- `Contacts source`: Tabs/inputs for File upload (`CSV`/`XLSX`), Paste phone numbers, or Saved `Reusable` list
- `Suppression list`: Optional select (`None` or saved Suppression list)
- `Calling hours`: Start time — End time
- `Calling days`: 7 day-of-week toggles (`Mon`–`Sun`)
- `Auto-retries`: Max retries + retry delay
- `Concurrency / Pacing`: Numeric/slider capped by workspace channels
- `Schedule`: Radio (`Right away` vs `Scheduled date/time`)

## 3. Contact Lists Modal (`#/campaigns`)
- `List type`: Radio (`Reusable` vs `Suppression`)
- `List name`: Text input
- `Contacts`: Paste numbers or CSV upload

## 4. Leads Filters (`#/leads`)
- `Search`: Text input
- `Sort`: Select dropdown
- `Channel`: Select (`All channels`, Instant, Campaign, Inbound)
- `Date range`: Preset dropdown + custom `From` / `To` date inputs
- `Outcome`: Select (`All outcomes`)
- `Credits per person`: `Min` / `Max` numeric inputs

## 5. Numbers & Channels (`#/numbers`)
- `Number type`: Radio (`Mobile — ₹649/month`, `Landline — ₹899/month`)
- `Extra channels`: Quantity (`₹250/month` per concurrent call channel)

## 6. Webhooks Modal (`#/developers/webhooks`)
- `Endpoint URL`: URL input (`https://...`)
- `Include call transcripts`: Switch (default: `true`)
- `Events`: 6 checkboxes (`call.completed`, `call.not_connected`, `lead.created`, `call.inbound_answered`, `call.inbound_missed`, `campaign.status_changed`)

