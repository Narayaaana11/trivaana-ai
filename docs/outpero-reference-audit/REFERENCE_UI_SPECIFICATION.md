# Outpero Reference UI Specification

## 1. Shell & Layout Geometry
- **Outer Frame**: `--canvas` (`#f6f6f8` light / `#0c0a12` dark) background surrounding a sticky left sidebar (`240px`) and an inset rounded main viewport (`md:rounded-xl`, `border: 1px solid var(--border)`).
- **Header Bar**: Compact top utility bar inside the main shell containing breadcrumb/page title on the left, `Search ⌘K` trigger, `Calling activity`, `Take the tour`, `Help`, theme toggle, and `Notifications` bell on the right.
- **Floating Bottom-Right Controls**: Compact pill triggers for `Ask Swara`, `Support and feedback`, and expandable 6-step `Setup guide`.

## 2. Screen Patterns
- **Home (`#/`) & Hire (`#/employees/new`)**: Centered dark-mode hero prompt card (`rounded-[26px]`, `#121019` / `#1b1824`) inside the light workspace, featuring language selector, `Natural spoken` checkbox, prompt textarea, mode selector, and white pill CTA button. Below the card sits the 14-category expandable Template Browser.
- **Leads (`#/leads`)**: Top view-switcher pills (`Pipeline`, `List`, `Cards`, `Priority`), inline search + sort + export row, secondary filter bar (`All channels`, `Date`, `All outcomes`, `More filters` collapsible drawer).
- **Campaign Builder (`#/campaigns/new`)**: Two-column asymmetric split (`~65%` scrollable form sections for Basics, Who's calling, Contacts, Calling Rules; `~35%` sticky right summary card with live counts & Launch CTA).
- **Settings (`#/settings/*`) & Billing (`#/billing/*`) & Developers (`#/developers/*`)**: Horizontal pill/underline sub-navigation tabs at top of the page, followed by clean grouped section cards (`rounded-xl`, `1px solid #e4e4e9`).
- **Empty States**: Centered icon badge + concise headline + 1-line explanation + single primary CTA button (`New employee`, `New campaign`, `Connect a source`, `Get a number`).

