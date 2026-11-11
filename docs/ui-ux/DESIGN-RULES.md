# Bhuiya Property Manager — Approved Design Rules v3.1
**Design System Specification & Invariant Reference**  
**Role**: Product Design, UI/UX Architecture, Android UX & React 19 Design Tokens  
**Applies to**: Web (Cloudflare Pages), Mobile Web & Android (Capacitor 7)

---

## 1. Core Philosophy & Invariants

1. **Design Direction**: **Premium Minimal + Refined Liquid Glass** (Xiaomi HyperOS 2.0 visual language + Apple HIG + Modern Financial Clarity).
2. **Functionality Over Decoration**: Beautiful aesthetics are mandatory, but financial precision, Bengali readability, touch usability, and Android performance strictly take precedence over decorative effects.
3. **The Five Invariants**:
   - **Financial Clarity**: Every monetary figure, payment status, transaction tag, and ledger row must be unambiguous, formatted, and readable in both light and dark themes.
   - **Visual Consistency**: Zero ad-hoc HEX codes or custom gradients in components. All colors, radii, spacing, and shadows must derive from centralized tokens.
   - **Functional Simplicity**: Each view prioritizes exactly one primary action (e.g., sticky action in forms; high-contrast CTA in dialogs).
   - **Performance**: Maximum **two** backdrop-filter blur layers active on any screen (typically Header and Floating Dock). Content cards use solid or semi-solid fills. No animated blurs.
   - **Accessibility (WCAG 2.2 AA)**: Never convey status with color alone. Status badges must always display **Color + Tint + Icon + Text Label**. Minimum 44×44px touch targets.

---

## 2. Centralized Color & Semantic Token System

### 2.1 Fill and Ink Token Pairs
Every semantic color uses a verified two-part pairing: **Fill** (background, chip, accent border) and **Ink** (text, iconography) with light-theme and dark-theme inks.

| Semantic Role | Token Base | Fill (Hex) | Light Ink (Hex) | Dark Ink (Hex) | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary / Paid** | `--color-primary` | `#22B84A` | `#15803D` | `#4ADE80` | Income, Paid bills, Primary CTA, Success |
| **Secondary / Property** | `--color-secondary` | `#0D9488` | `#0F766E` | `#14B8A6` | Properties, Units, Inventory |
| **Interactive / Info** | `--color-info` | `#1685E8` | `#1D4ED8` | `#38BDF8` | Links, Active tabs, Information alerts |
| **Expense / Warning** | `--color-warning` | `#F28A24` | `#B45309` | `#FB923C` | Expenses, Partial payment, Discard warnings |
| **Due / Destructive** | `--color-danger` | `#E94B4B` | `#B91C1C` | `#F87171` | Overdue rent, Vacate, Delete, Errors |
| **Admin / Reserve** | `--color-admin` | `#7655E8` | `#6D28D9` | `#A78BFA` | Reserve fund, Beneficiary payouts, Master Admin |

### 2.2 Surface & Canvas Tokens

| Token | Light Theme | Dark Theme (Default) | Dark OLED Mode |
| :--- | :--- | :--- | :--- |
| `--surface-canvas` | `#F2F3F5` | `#0B0D10` | `#000000` |
| `--surface-card` | `#FFFFFF` (88% glass) | `#181A1F` (90% glass) | `#121214` |
| `--surface-card-subtle` | `#F8FAFC` (70% glass) | `#22252B` (75% glass) | `#1A1A1C` |
| `--surface-modal` | `#FFFFFF` | `#181A1F` | `#0E0E10` |
| `--surface-input` | `rgba(255, 255, 255, 0.90)` | `rgba(34, 37, 43, 0.85)` | `rgba(24, 24, 27, 0.9)` |
| `--border-subtle` | `rgba(0, 0, 0, 0.08)` | `rgba(255, 255, 255, 0.10)` | `rgba(255, 255, 255, 0.14)` |
| `--border-glass` | `rgba(255, 255, 255, 0.75)` | `rgba(255, 255, 255, 0.12)` | `rgba(255, 255, 255, 0.15)` |

### 2.3 Strict Color Rules
- Primary buttons must use ink-level accessible backgrounds (`#15803D` in light mode or high-contrast fill `#22B84A` with dark ink text).
- White text on brand fill `#22B84A` is allowed **only** on large prominent buttons where contrast is mathematically verified >= 4.5:1.
- Chips and badges must use `rgba(color, 0.12)` tint background + Ink color text + icon.

---

## 3. Typography & Bengali (Bangla-First) Localization

### 3.1 Type Hierarchy & Metrics
- **English Font**: Inter / Manrope (system fallback: system-ui, -apple-system, sans-serif).
- **Bangla Font**: Noto Sans Bengali (`font-display: swap`, self-hosted subsets for offline APK).
- **Line-Height Rule**: Bengali text must maintain **minimum 1.5 line-height** (`leading-normal` or `leading-relaxed`) to prevent vowel-sign clipping (কার, ফলা, ি, ী, ু, ূ, ্য, ্র, ্ত্ব).

| Scale | Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | 28px | 36px | 800 (Bold) | Splash, Big Metrics |
| **Page Title** | 22px | 30px | 700 (Bold) | Main view headers |
| **Section Title** | 18px | 24px | 700 (Bold) | Dashboard sections, Modal headers |
| **Card Title** | 16px | 22px | 600 (Semibold) | StatTile, Property cards |
| **Body Text** | 14px | 22px | 400 / 500 | General content, table rows, form hints |
| **Caption** | 12px | 18px | 500 (Medium) | Timestamps, metadata, labels |
| **Micro Label** | 12px | 18px | 600 (Semibold) | Badges, tags, form field labels |
| **Hero Financial** | 28px | 34px | 800 (Extrabold) | Current Month Collection Hero |
| **Standard Financial**| 20px | 26px | 800 (Extrabold) | StatTile values |
| **Ledger Financial** | 16px | 22px | 700 (Bold) | Table and list amounts |

### 3.2 Numeric & Date Formatting Standards
- Centralized utility `formatMoney(amount, { locale, useBanglaDigits })`.
- Currency symbol: `৳` (Taka).
- Default format: `bn-BD` lakh/crore grouping (e.g. `৳১,২৫,০০০`).
- User preference: Toggle between Bangla digits (`১২৩`) and English digits (`123`).
- Numeric alignment: Always use `tabular-nums` (`font-variant-numeric: tabular-nums`) for currency amounts to prevent horizontal jitter during updates.
- Timezone: Strictly `Asia/Dhaka` (`src/utils/dhakaDate.ts`).

---

## 4. Component Geometry, Radii & Spacing

### 4.1 8px Spacing Grid
- Micro-spacing: 4px (`p-1`, `gap-1`), 8px (`p-2`, `gap-2`), 12px (`p-3`, `gap-3`).
- Standard spacing: 16px (`p-4`, `gap-4`), 20px (`p-5`, `gap-5`), 24px (`p-6`, `gap-6`).
- Macro spacing: 32px (`p-8`), 72px (Bottom dock clearance `pb-24` to `pb-28`).

### 4.2 Corner Radii Standards
- **Hero Financial Card**: 24px – 28px (`rounded-3xl`).
- **Standard Card / Container**: 20px (`rounded-2xl`).
- **Small Card / Action Tile**: 16px (`rounded-xl`).
- **Form Input / Select**: 14px – 16px (`rounded-xl` / squircle).
- **Dialog Sheet / Modal**: 24px (`rounded-t-[28px]` on mobile sheet; `rounded-3xl` on desktop).
- **Pill Button / Nav Dock / Status Chip**: 9999px (`rounded-full`).

---

## 5. Iconography & Visual Assets

1. **Icon Library**: Exclusively `lucide-react`. No random SVG drops or emoji icons in production UI.
2. **Standard Sizes**:
   - Micro / Inline Icon: 14px (`w-3.5 h-3.5`).
   - Standard Button / Field Icon: 18px (`w-4.5 h-4.5` or `w-4 h-4`).
   - Navigation Dock Icon: 20px – 22px (`w-5 h-5`).
   - Hero / Stat Icon: 24px (`w-6 h-6`).
   - Empty State Icon: 48px – 64px (`w-12 h-12` or `w-16 h-16`).
3. **Aspect Ratios**:
   - Property preview: 16:9 fixed ratio with loading skeleton fallback.
   - Tenant avatar / photo: 1:1 circle (`rounded-full`) or squircle (`rounded-2xl`).
   - Payment receipt: 3:4 aspect container.
4. **Brand Asset**: Use canonical `public/brand/anwar-bhuiyan-property.svg` exclusively.

---

## 6. Navigation, Dock & Application Shell

### 6.1 Mobile Dock (Viewport < 1024px)
- **Component**: `FloatingPillNav` (`src/components/ui/hyperos/FloatingPillNav.tsx`).
- **Dimensions**: Height ~64px, Width `min(94%, 440px)`, Bottom offset `12px` + `env(safe-area-inset-bottom)`.
- **Five Primary Tabs**:
  1. `হোম` (Home) — `#22B84A`
  2. `হিসাব` (Accounts / Ledger) — `#1685E8`
  3. `নতুন খরচ` (Add Expense) — `#F28A24` (Action shortcut)
  4. `ভাড়া জমা` (Collect Rent) — `#22B84A` (Action shortcut)
  5. `প্রোফাইল` (Profile & Settings) — `#7655E8`
- **Active State Rule**: The active tab uses the smooth sliding indicator pill or clean accent glow. No permanent continuous pulsating loops.
- **Focus Mode**: When full-page forms (`RentDepositPage`, `AddExpensePage`) or virtual keyboard opens, the floating dock hides or docks cleanly to prioritize the sticky action button.

### 6.2 Desktop Shell (Viewport >= 1024px)
- Floating mobile dock is **hidden** (`lg:hidden`).
- Desktop Header and Sidebar / Navigation Rail are displayed (`hidden lg:flex`).
- Zero duplicate navigation bars.

### 6.3 Android Back Button Hierarchy
1. If any modal / bottom sheet is open -> Dismiss modal.
2. If custom select / popover is open -> Dismiss popover.
3. If inside a drill-down view (e.g. Accounts view, Property details) -> Navigate back to Home.
4. If on Home tab -> Trigger safe double-tap exit or confirm exit.

### 6.4 Sprint S2 Shell Requirements & Gap Additions
- **Role-Aware Navigation Dock**: Dock items must reflect actual authorization: Family Viewers (read-only) see Home, Accounts, and Profile only. Managers and Master Admins see all 5 tabs.
- **Dynamic Theme-Color Meta**: Dynamically synchronize `<meta name="theme-color">` and Capacitor status bar color on theme toggle (`#F2F3F5` for Light, `#0B0D10` for Dark).
- **System Back-Stack Integration**: Leverage `useAppNavigation().registerBackGuard` across all modals, sheets, and popups before triggering route changes.
- **Storage Labels**: Describe uploaded files as private Cloudflare R2 storage; never show an obsolete provider choice.

---

## 7. Financial UX & Integrity Rules

1. **Status Invariant**: Status must ALWAYS include Color + Icon + Label:
   - `✓ পরিশোধিত` (Paid): Green tint + Green ink + `CheckCircle`
   - `⏳ বকেয়া` (Due): Red tint + Red ink + `AlertCircle` / `Clock`
   - `◐ আংশিক` (Partial): Orange tint + Orange ink + `Clock`
   - `↩ রিভার্সড` (Reversed): Gray tint + Slate ink + `RotateCcw`
2. **Financial Privacy**: Dashboard includes a "Hide / Show Balances" (`eye` / `eye-off`) toggle stored in local user preferences (`localStorage`), leaving raw financial state untouched.
3. **Receipt Presentation**: Standard 3:4 printable receipt layout with Property, Flat, Tenant, Amount, Billing Month, Date, Transaction ID, and Provider-neutral cloud backup status.
4. **Safety Enforcement**:
   - `DISABLE_FINANCIAL_WRITES=true` is strictly maintained on staging.
   - UI testing must NEVER trigger unapproved live mutations.
   - Irreversible actions require an explicit two-step confirmation dialog with impact summary.

---

## 8. Motion & Performance Budgets

1. **Default Motion**:
   - Page view transition: 300ms Fade + Slide (`cubic-bezier(0.2, 0.8, 0.2, 1)`).
   - Modal sheet entrance: 180ms – 200ms Fade + Scale.
   - Button tap feedback: `active:scale-[0.97]` with 120ms release.
2. **Accessibility**: Strictly honor `prefers-reduced-motion` (disable scale, 3D flips, and slide animations).
3. **Low-End Android Optimization**:
   - Limit `backdrop-filter: blur(...)` to max 2 simultaneous layers.
   - Never apply animated transitions directly to `backdrop-filter`.
   - Use CSS `will-change: transform, opacity` sparingly and remove when idle.
   - Avoid infinite CSS keyframe pulses.

---

## 9. Non-Negotiable Protection Boundaries

- **DO NOT MODIFY**: `firestore.rules`, `firestore.indexes.json`, `src/services/*`, financial calculation functions, backend APIs, or Capacitor native identities.
- **DO NOT TOUCH**: Production Firebase project `bhuiya-property-manager`.
- **PRESERVE**: All uncommitted offline-first changes (`offlineDb.ts`, `syncEngine.ts`, `SyncStatusBar.tsx`, etc.).
- **NO DEPLOY / NO PUSH**: Do not push to GitHub, deploy to Cloudflare, or publish APK without explicit user authorization.

---

## 10. Sprint S1 Sub-Phasing & Quality Gates

### 10.1 Sub-Sprint S1a (Tokens & Formatting Foundation)
- Centralized semantic color tokens (Fill & Ink pairs for all 6 semantic roles).
- Default `#0B0D10` Dark Theme canvas and `#F2F3F5` Light Theme canvas.
- Typography setup with Noto Sans Bengali (`font-display: swap`, minimum 1.5 line-height).
- Centralized `formatMoney`, `formatDate`, `formatMonth`, `formatNumber` supporting `bn-BD` lakh/crore grouping (`৳১,২৫,০০০`) with numeral toggle preference.
- Dev-only `/gallery` shell (`?preview=components`) isolated from production.

### 10.2 Sub-Sprint S1b (Core Primitives Library)
- `StatusBadge` supporting all status states including `pending-sync` offline variant.
- `Field` & `Input` with squircle geometry and accessible focus rings.
- `BottomSheet` component with touch drag and backdrop management.
- `ToastProvider` / global feedback system.
- `Skeleton` loading placeholders matching card geometries.
- `EmptyState` component.
- `ConfirmationDialog` for irreversible operations.

### 10.3 Quality & Lint Gates
- **Zero New ESLint Errors**: Any file touched must have its pre-existing lint issues cleanly addressed without `@ts-ignore`, `@ts-nocheck`, or broad `any`.
- **Untouched File Integrity**: Do not perform sweeping auto-fixes on files outside current sprint scope.
- **Dependency Freeze**: Strictly zero new npm packages without prior explicit approval.
