# Outpero Reference Design System (Observed CSS Tokens)

Extracted directly via `get_css_styles` on `https://app.outpero.com/#/` and `https://outpero.com/`.

## Typography
- **Sans**: `Geist`, `"Nirmala UI"`, `"Noto Sans"`, sans-serif (`font-feature-settings: "ss01", "cv11"`)
- **Marketing Display**: `Outfit` (`.t-display`: `clamp(2.3rem, 6.2vw, 4.75rem)`, `font-weight: 600`, `line-height: 1.02`, `letter-spacing: -0.045em`)
- **Monospace**: `Geist Mono`, `ui-monospace`, `Menlo`, monospace

## Light App Tokens (`:root`)
- **Surfaces**: `--background: #ffffff`, `--canvas: #f6f6f8`, `--card: #ffffff`, `--popover: #ffffff`
- **Text**: `--foreground: #0f0f14`, `--ink-2: #3d3d48`, `--muted-foreground: #6b6b78`, `--faint: #a0a0ac`
- **Borders**: `--border: #e4e4e9`, `--line-strong: #d4d4dc`, `--input: #e4e4e9`
- **Sidebar**: `--sidebar: #f6f6f8`, `--sidebar-foreground: #3d3d48`, `--sidebar-accent: #ebebf0`, `--sidebar-border: #e4e4e9`
- **Status**:
  - OK/Success: `#149e6a` / soft `#e1f6ec`
  - Warning: `#c2741a` / soft `#fbf0e2`
  - Error/Destructive: `#d4493f` / soft `#fcebe9`
  - Info: `#3a78c9` / soft `#e5eefa`

## Dark Hero Card Tokens (`.dark`)
- **Surfaces**: `--background: #121019`, `--canvas: #0c0a12`, `--secondary: #1b1824`, `--accent: #221e2d`
- **Text**: `--foreground: #f2f1f7`, `--ink-2: #c9c7d4`, `--muted-foreground: #8f8c9e`
- **Borders**: `--border: #ffffff13`, `--line-strong: #ffffff21`
- **Radii**: Base `--radius: 0.625rem` (`10px`), inset shell `14px`, hero dark card `26px` outer / `20px` inner.

*Note for Trivaana AI*: Apply Outpero's crisp inset shell geometry, light canvas + white cards, dark hero prompt card contrast, and clean typographic hierarchy while retaining **Trivaana AI's original `#FF5500` orange brand accent** rather than Outpero's purple (`#7a50dc`).

