## Session: Frontend Brand Refresh — Databricks Design System

**Date:** 2026-04-24
**Bundle:** scAuditor_agent
**Target:** dev

---

### Summary

Comprehensive frontend refresh of the SC Auditor React app applying all 8 Databricks brand skills (colors, typography, design principles, assets, dark/light mode, motion, components, accessibility). Built a semantic token foundation in CSS, created a ThemeProvider with light/dark/system/high-contrast modes, refreshed all shared components, and updated the Navbar and App shell. Deployed the bundle and app. 5 page components remain for a follow-up session.

---

### Brand Skills Created (4 new)

Extended the existing 4 brand skills with 4 new ones, all registered in `.assistant_instructions.md`:

| Skill | File Size | Key Content |
| --- | --- | --- |
| `databricks-brand-dark-light-mode` | 13.6 KB | 30 semantic tokens (surfaces, text, borders, accents), `prefers-color-scheme`, `.dark` class toggle, Tailwind v4 `@theme`, React ThemeProvider, WCAG-verified pairings |
| `databricks-brand-motion` | 12.3 KB | 6 duration tiers, 5 easing curves, entrance/exit/hover/loading/state patterns, stagger choreography, `prefers-reduced-motion` support |
| `databricks-brand-components` | 24.9 KB | 8 component recipes (Button, Card, Badge, Input, Toast, Modal, DataTable, EmptyState) with semantic tokens, motion integration, legacy var migration mapping |
| `databricks-brand-accessibility` | 10.5 KB | Full WCAG contrast matrices for 7 surfaces × 20+ foregrounds, filled button checks, focus indicator spec, badge contrast audit, testing tools |

---

### Foundation Files (3)

#### `src/client/index.css` (9,082 bytes) — Complete rewrite

Replaced all legacy CSS variables with the semantic token system from the dark-light-mode skill:

- **30 semantic tokens** across 4 categories: surfaces (6), text (6), borders (4), accents (10 + subtle variants)
- **Light mode** uses White / Oat Light / Oat Medium surfaces with Navy 800 text
- **Dark mode** (via `.dark` class) swaps to Navy 800 / Navy 900 / Navy 700 surfaces with Gray 300 text
- **High-contrast mode** (`.high-contrast`) increases border prominence and uses bolder accent tones
- **Motion tokens**: 6 durations (`--motion-fast` 100ms through `--motion-slower` 500ms), 4 easing curves
- **Keyframe animations**: fadeIn, fadeOut, slideUp, slideDown, scaleIn, shimmer, spin
- **Utilities**: `.stagger-list` (50ms delay between children, max 5), `.skeleton` loading shimmer
- **`prefers-reduced-motion`** media query: disables all animations and transitions
- **Custom scrollbar** using semantic tokens, **selection color** using accent-primary

#### `src/client/ThemeProvider.tsx` (4,082 bytes) — New file

React context provider with:
- Three theme modes: `light`, `dark`, `system` (follows OS preference)
- High-contrast accessibility toggle (independent of theme)
- `localStorage` persistence for both settings
- `ThemeSelector` component: Sun/Moon/Monitor icons for theme + Accessibility button
- Applies `.dark` and `.high-contrast` classes to `<html>` element
- Uses `matchMedia('prefers-color-scheme: dark')` listener for system mode

#### `src/client/App.tsx` (1,517 bytes) — Updated

Wrapped entire app with `<ThemeProvider>`. Updated `<Layout>` with semantic surface/text tokens. Added footer with muted brand text.

---

### Shared Components (6)

#### `src/client/components/Navbar.tsx` (2,354 bytes)

- **Brand mark**: Gradient Lava icon (600→700) with shadow, "SC Auditor" bold + "SCREEN CAPTURE" uppercase micro-label
- **Navigation**: 5 nav items with lucide-react icons (LayoutDashboard, ScanSearch, ClipboardList, Route, Settings)
- **Active state**: `--accent-primary` background tint, white text
- **Hover state**: `--surface-nav-hover` with motion-fast transition
- **ThemeSelector** positioned in top-right corner
- **Always dark**: `--surface-nav` is Navy 800 (light) / Navy 900 (dark)

#### `src/client/components/Card.tsx` (951 bytes)

Semantic tokens (`--surface-raised`, `--border-default`), optional `elevated` prop for shadow-md/shadow-lg, motion transitions on hover.

#### `src/client/components/Button.tsx` (1,971 bytes)

4 variants:
- **Primary**: Lava gradient background (600→700), white text, shadow with Lava tint
- **Secondary**: Transparent with accent-primary border and text
- **Ghost**: No border, accent-primary text, subtle hover background
- **Danger**: `--accent-error` background, white text

3 sizes (sm/md/lg), focus ring with `--border-focus`, motion-fast transitions, disabled opacity.

#### `src/client/components/Badge.tsx` (1,348 bytes)

5 semantic variants (default, success, warning, error, info) using `--accent-*-subtle` backgrounds with matching text. `StatusBadge` helper component with colored dot indicator. ScaleIn entrance animation.

#### `src/client/components/Input.tsx` (3,298 bytes)

Input, Textarea, and Select components with labels, placeholder styling, error states (red border + error message), focus rings with `--border-focus`. All use semantic tokens and motion-fast transitions.

#### `src/client/components/EmptyState.tsx` (775 bytes)

Centered layout with icon container (accent-primary tint), title, description, optional action slot. FadeIn entrance animation.

---

### Design Decisions

1. **Semantic tokens over raw hex** — All components reference `--surface-*`, `--text-*`, `--border-*`, `--accent-*` variables. No hardcoded colors. Theme changes propagate automatically.

2. **CSS-first theming** — Theme switching done via CSS class toggle (`.dark`, `.high-contrast`) on `<html>`, not React state-driven re-renders. Better performance for large component trees.

3. **Navbar always dark** — `--surface-nav` is always Navy 800/900 regardless of theme. Provides a consistent brand anchor and visual stability during theme transitions.

4. **Motion respect** — Every animation and transition is wrapped in `prefers-reduced-motion` awareness. The `index.css` media query globally disables all animations for users who prefer reduced motion.

5. **Focus-visible only** — Focus rings use `focus-visible:` not `focus:` to avoid showing rings on mouse clicks while maintaining keyboard accessibility.

6. **High-contrast as independent toggle** — Not a third theme but a modifier that can overlay light or dark mode. Increases border width and uses higher-contrast accent tones.

7. **Stagger animations** — `.stagger-list` utility uses CSS `nth-child` selectors with `animation-delay` for a choreographed entrance effect (50ms per item, max 5 staggered).

---

### Remaining Work (5 page components)

| Page | Key Needs |
| --- | --- |
| `pages/dashboard/DashboardPage.tsx` | Stagger animations on stats grid, elevated cards, accent-colored icons, brand typography hierarchy |
| `pages/audit/AuditPage.tsx` | Split-pane styling with semantic tokens, chat panel message bubbles, screenshot viewer |
| `pages/history/HistoryPage.tsx` | DataTable with semantic tokens, search input styling, status badges |
| `pages/patterns/PatternsPage.tsx` | Pattern editor cards, step timeline with accent colors, action icons |
| `pages/settings/SettingsPage.tsx` | Tabbed UI with semantic tokens, credential management, theme selector integration |

Toast and Modal component recipes are available from the components skill but not yet integrated into the app.

---

### Brand Compliance Status

| Principle | Status | Evidence |
| --- | --- | --- |
| **Distilled** | Pass | Clean semantic tokens, minimal decorative elements, purposeful motion |
| **Bold** | Pass | Lava 600 primary accent, gradient shadows, confident typography, striking navbar |
| **Fresh** | Pass | Contemporary motion patterns, dark mode, accessibility toggle, modern components |
| **Colors** | Pass | All 7 families available via semantic tokens, WCAG AA verified |
| **Typography** | Pass | DM Sans (all UI), DM Mono (code), type scale divisible by 8, 150% line-height |
| **Motion** | Pass | 6 duration tiers, ease-out entrances, ease-in exits, reduced-motion support |
| **Accessibility** | Pass | Focus rings, contrast-verified tokens, high-contrast mode, ARIA-compliant |
| **Assets** | Pending | Product icons/lockups not yet integrated into pages |
| **Components** | Partial | 6 of 8 recipes implemented; Toast and Modal pending |

---

### Deployment

Bundle deployed and app restarted successfully:
- `databricks bundle deploy --target dev` — files uploaded, resources updated
- `databricks bundle run sc_auditor --target dev` — app restarted with new frontend
- App URL: `https://dev-sc-auditor-7474657291520070.aws.databricksapps.com`

---

### Files Modified Summary

| File | Change |
| --- | --- |
| `src/client/index.css` | Complete rewrite — semantic token system, motion tokens, keyframes, utilities |
| `src/client/ThemeProvider.tsx` | New — React context with light/dark/system + high-contrast toggle |
| `src/client/App.tsx` | Wrapped with ThemeProvider, semantic tokens, footer |
| `src/client/components/Navbar.tsx` | Brand mark, icon nav, always-dark surface, ThemeSelector |
| `src/client/components/Card.tsx` | Semantic tokens, optional elevation, motion transitions |
| `src/client/components/Button.tsx` | 4 variants with Lava gradient primary, 3 sizes, focus ring |
| `src/client/components/Badge.tsx` | 5 semantic variants, StatusBadge helper, scaleIn animation |
| `src/client/components/Input.tsx` | Input/Textarea/Select with labels, errors, focus rings |
| `src/client/components/EmptyState.tsx` | Icon container, fadeIn animation, action slot |
| `.assistant/skills/databricks-brand-dark-light-mode/SKILL.md` | New skill — 30 semantic tokens, theme switching |
| `.assistant/skills/databricks-brand-motion/SKILL.md` | New skill — durations, easings, animation patterns |
| `.assistant/skills/databricks-brand-components/SKILL.md` | New skill — 8 component recipes |
| `.assistant/skills/databricks-brand-accessibility/SKILL.md` | New skill — WCAG contrast matrices, focus spec |
| `.assistant_instructions.md` | Registered all 4 new brand skills |