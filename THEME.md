# deboistech Website Theme

> Reusable design system extracted from `deboistech.in` (this repo). Use this as the single source of truth when applying the same look & feel to any new website — including the company's product sites (e.g. TenantPlane, MotoAdmin).

---

## 1. Design Tokens

All values are defined in one place and referenced everywhere. If you change a token here, it updates across the whole site.

### Brand Colors (Green — Emerald scale)

| Token            | Value       | Tailwind class      | Usage                                      |
| ---------------- | ----------- | ------------------- | ------------------------------------------ |
| `--clr-primary`  | `#059669`   | `primary-600`       | Buttons, links, icons, accents             |
| `--clr-primary-hover` | `#047857`  | `primary-700`  | Hover state for primary elements           |
| `--clr-primary-50`  | `#ecfdf5`  | `primary-50`        | Section backgrounds (`bg-primary-50/30`)   |
| `--clr-primary-100` | `#d1fae5`  | `primary-100`       | Icon chip backgrounds                      |
| `--clr-primary-900` | `#064e3b`  | `primary-900`       | Footer background                          |

Full primary palette (Tailwind):

```js
primary: {
  50:  "#ecfdf5",
  100: "#d1fae5",
  200: "#a7f3d0",
  300: "#6ee7b7",
  400: "#34d399",
  500: "#10b981",
  600: "#059669",
  700: "#047857",
  800: "#065f46",
  900: "#064e3b",
}
```

**Primary tints** (semi-transparent overlays):

| Token                   | Value                        | Usage                        |
| ----------------------- | ---------------------------- | ---------------------------- |
| `--clr-primary-tint-xs` | `rgba(5, 150, 105, 0.06)`    | Tab hover background         |
| `--clr-primary-tint-sm` | `rgba(5, 150, 105, 0.08)`    | Active tab background        |
| `--clr-primary-tint-md` | `rgba(5, 150, 105, 0.10)`    | Icon chip background         |
| `--clr-primary-tint-lg` | `rgba(5, 150, 105, 0.15)`    | Icon chip hover background   |
| `--clr-primary-border`  | `rgba(5, 150, 105, 0.30)`    | Card hover border            |

### Text Colors

| Token               | Value     | Tailwind class | Usage                        |
| ------------------- | --------- | -------------- | ---------------------------- |
| `--clr-text-heading`| `#111827` | `gray-900`     | Headings (`h1`–`h3`)         |
| `--clr-text-body`   | `#1F2937` | `gray-800`     | Body copy                    |
| `--clr-text-subtle` | `#374151` | `gray-700`     | Slightly muted text          |
| `--clr-text-muted`  | `#6B7280` | `gray-500`     | Subheadings, descriptions    |

### Surfaces & Borders

| Token              | Value     | Tailwind class | Usage                          |
| ------------------ | --------- | -------------- | ------------------------------ |
| `--clr-surface`    | `#ffffff` | `white`        | Cards, page background         |
| `--clr-surface-raised` | `#F9FAFB` | `gray-50` | Alternating section background |
| `--clr-border`     | `#E5E7EB` | `gray-200`     | Standard borders               |
| `--clr-divider`    | `#F3F4F6` | `gray-100`     | Card dividers, hairline borders|

### Shadows

| Token                  | Value                       | Usage                     |
| ---------------------- | --------------------------- | ------------------------- |
| Default                | `shadow-sm` (Tailwind)      | Cards at rest             |
| `--shadow-card-hover`  | `0 8px 32px rgba(0,0,0,0.08)` | Card on hover        |

### Typography

- **Sans:** `Inter`, `system-ui`, `sans-serif` — weights 400–800 (load from Google Fonts: `wght@400;500;600;700;800`)
- **Mono:** `JetBrains Mono`, `Fira Code`, `monospace` — used for code blocks only
- Headings: `font-bold`/`font-extrabold`, `tracking-tight`
- Body: `text-gray-800`, `antialiased`

### Border Radius

| Token              | Value    | Usage                       |
| ------------------ | -------- | --------------------------- |
| `--radius-sm`      | `8px`    | Small chips / tags          |
| `--radius-md`      | `10px`   | Icon chips, form inputs     |
| `--radius-card`    | `14px`   | Service cards               |
| `--radius-lg`      | `16px`   | CTA strips, larger cards    |
| `--radius-xl`      | `20px`   | Hero image, large surfaces  |
| `--radius-pill`    | `9999px` | Buttons, navbar pill        |

### Transitions

| Token                    | Value          | Usage                          |
| ------------------------ | -------------- | ------------------------------ |
| `--transition-fast`      | `0.2s ease`    | Hover color/opacity changes    |
| `--transition-base`      | `0.25s ease`   | Card hover (shadow/border)     |
| `--transition-reveal`    | `0.6s ease-out`| Scroll-reveal animation        |

### Layout / Spacing

- Max content width: `max-w-7xl` (`1280px`), centered with `mx-auto`
- Horizontal padding: `px-4` mobile → `sm:px-6` → `lg:px-8`
- Section vertical padding: `py-20` mobile → `sm:py-28` (large sections)
- Card grids: `gap-1.5rem` (`gap-6`), responsive 3 → 2 → 1 columns

---

## 2. Tailwind Setup

### `tailwind.config.js`

```js
module.exports = {
  content: ["./*.{html,js}", "./lib/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
```

### Next.js (Tailwind v4) — `globals.css` `@theme`

```css
@theme {
  --color-primary-50: #ecfdf5;
  --color-primary-100: #d1fae5;
  /* ... primary-200..900 as above ... */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}
```

---

## 3. Core UI Components (CSS Classes)

Define these once in the CSS `@layer components` (or as Tailwind utilities) and reuse everywhere.

### Buttons

```css
/* Pill-shaped primary button */
.btn-primary {
  @apply inline-flex items-center justify-center gap-2 rounded-full
         bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm
         transition-all hover:bg-primary-700
         focus-visible:outline focus-visible:outline-2
         focus-visible:outline-offset-2 focus-visible:outline-primary-600;
}

/* Outlined secondary button */
.btn-secondary {
  @apply inline-flex items-center justify-center gap-2 rounded-full
         border-2 border-gray-300 bg-white px-6 py-3 text-sm font-semibold
         text-gray-700 shadow-sm transition-all hover:border-primary-600
         hover:text-primary-600 focus-visible:outline focus-visible:outline-2
         focus-visible:outline-offset-2 focus-visible:outline-primary-600;
}
```

### Typography Helpers

```css
/* Small uppercase kicker above headings — e.g. "OUR TEAM & CULTURE" */
.eyebrow {
  @apply mb-4 inline-block text-xs font-bold uppercase tracking-widest text-primary-600;
}

.section-heading {
  @apply text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl;
}

.section-subheading {
  @apply mt-4 max-w-2xl text-lg leading-8 text-gray-500;
}
```

### Cards

```css
/* Generic card */
.card {
  @apply rounded-xl border border-gray-100 bg-white p-6 shadow-sm
         transition-shadow hover:shadow-md;
}

/* Check-list item with green ✓ circle */
.check-item {
  @apply flex items-start gap-2 text-sm text-gray-600;
}
.check-item::before {
  content: "✓";
  @apply mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center
         rounded-full bg-primary-100 text-xs font-bold text-primary-600;
}
```

### Service / Solution Card (`svc-card`)

Card with a 3px accent stripe that slides in on hover + lift effect.

```
┌─────────────────────────────────────────────┐
│  [icon]  Service Name                       │  ← header (icon chip + title)
│  ─────────────────────────────────────────── │  ← divider
│  "Problem…"  (italic, muted)                │
│  → Solution… (body)                         │
│                                             │
│  Talk to us about [X] →  (primary, bottom)  │
└─────────────────────────────────────────────┘
```

- Background `--clr-surface`, border `--clr-border`, radius `--radius-card`, padding `1.75rem`
- Hover: shadow `--shadow-card-hover`, border `--clr-primary-border`, lift `translateY(-2px)`, top stripe opacity 1
- Icon chip: `44px` square, `--radius-md`, `--clr-primary-tint-md` bg, `--clr-primary` icon (22px)
- Problem line: `0.8125rem` italic, `--clr-text-muted`
- Solution line: `0.875rem`, `--clr-text-body`, prefixed with `→`
- CTA: `0.8125rem` semibold, `--clr-primary`, pinned to bottom (`margin-top: auto`)
- Grid: 3 cols desktop → 2 tablet → 1 mobile, `gap: 1.5rem`

### Tier Tabs (`svc-tier-tabs`)

Used on the services page for Build / Scale / Accelerate:

- Tab bar: horizontal, `border-bottom: 1px solid var(--clr-border)`, `gap: 0.75rem`
- Inactive tab: `opacity: 0.5`
- Active tab: `opacity: 1`, `border-bottom: 3px solid var(--clr-primary)`, `background: var(--clr-primary-tint-sm)`, label turns `--clr-primary`
- Hover: `opacity: 0.85`, `background: var(--clr-primary-tint-xs)`
- Mobile: tabs stay side-by-side in a horizontal scroll, hooks hidden
- Panel transition: `tier-fade-in` keyframe — fade in + `translateY(10px)`

---

## 4. Section Patterns

Standard rhythm for every page (top → bottom):

1. **Page hero** — `bg-white`, grid `lg:grid-cols-2` (image + text), `pt-20`
2. **Featured product** — `bg-gray-50`, 2-col grid, eyebrow + heading + `✓` feature list + primary CTA
3. **Tech marquee** — `border-y border-gray-100`, infinite horizontal scroll of tech logos (grayscale, 55% opacity, 120×48px), 40s linear animation
4. **Solutions / services** — `bg-white`, `svc-card` grid
5. **Process steps** — numbered cards `01, 02, 03…` (`text-sm font-bold text-primary-600`), `card` class
6. **Team / culture** — `bg-primary-50/30`, feature list with green icon chips
7. **Contact / CTA** — `bg-white`, split form + trust indicators
8. **Footer** — `bg-primary-900`, white headings, `gray-400` links → white on hover, `border-t border-primary-700` above copyright

**Alternating backgrounds** create the visual rhythm: `white` → `gray-50` → `white` → `primary-50/30` → `white`.

### Hero Pattern

```
┌─────────────────────────────────────────────────────┐
│  [eyebrow / badge]                                   │
│  Heading  — extrabold, tracking-tight, gray-900      │
│  Accent phrase — text-primary-600                    │
│  Subhead — text-lg, leading-relaxed, gray-500        │
│  [btn-primary]  [btn-secondary]                      │
└─────────────────────────────────────────────────────┘
```

- `h1`: `text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl`
- Accent span: `text-primary-600`
- Page content offset for fixed navbar: `<main class="pt-20">`

### Navbar

Floating pill navbar — fixed, centered, detached from viewport top:

- `fixed left-1/2 top-6 z-50 w-full max-w-4xl -translate-x-1/2 px-4`
- Inner: `rounded-2xl border border-gray-100 bg-white/95 px-5 py-3.5 shadow-lg backdrop-blur`
- Logo: `h-9 w-auto`
- Links: `text-sm font-medium text-gray-600 hover:text-gray-900`
- CTA: `rounded-full bg-primary-700 text-white hover:bg-primary-800` ("Let's Talk →")
- Mobile: hamburger → dropdown panel, `rounded-xl border border-gray-100 bg-white shadow-lg`

### Footer

- Background: `bg-primary-900`, padding `px-4 py-16 sm:px-6 lg:px-8`
- Grid: `lg:grid-cols-[2fr_3fr]` (brand + link columns)
- Brand heading: `text-2xl font-bold text-white`
- Link headings: `text-sm font-bold text-white`
- Links: `text-sm text-gray-400 hover:text-white`
- Bottom bar: `border-t border-primary-700`, copyright `text-xs text-gray-500`

---

## 5. Motion & Effects

### Scroll Reveal

Elements start hidden (`opacity: 0`, `translateY(24px)`) and animate in when scrolled into view (0.6s ease-out). Add `.reveal` to any section; JS adds `.revealed` on intersection.

### Infinite Logo Marquee

- Track: `scroll-track` — flex, `width: max-content`, animation `scroll-x 40s linear infinite`
- Reverse option: `scroll-track-reverse`
- Item: 120×48px, `margin-right: 4rem`, logos `grayscale(100%)` + `opacity: 0.55`
- Keyframes translate track `0 → -50%` (duplicate the logo list for a seamless loop)

### Mobile Snap-Scroll

On screens < 768px, card rows convert to horizontal swipe with snap:

```css
.mobile-scroll {
  display: flex; overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 2rem;               /* hide scrollbar */
}
.mobile-scroll > * { width: 85vw; flex-shrink: 0; scroll-snap-align: center; }
```

### Card Hover

Shadow deepens (`0 8px 32px rgba(0,0,0,0.08)`), border tints to primary (30%), card lifts `2px`, accent stripe fades in.

---

## 6. Component Inventory

| Component                 | Key classes / structure                                     |
| ------------------------- | ---------------------------------------------------------- |
| `FeaturedProduct`         | `bg-gray-50`, 2-col grid, image + `✓` list + `btn-primary` |
| `SolutionCard`            | `svc-card` (problem → solution → CTA)                      |
| `ProjectCard` / `ProductCard` | `card`, icon chip, tech tags (`bg-gray-100 rounded-full`), image, link |
| `ProcessSteps`            | `card` grid, `text-primary-600` step number `01…`          |
| `TechMarquee`             | `scroll-track` infinite scroll                             |
| `CardSection`             | `.card` grid for general use                                |
| `Careers`                 | card-based job listing                                     |
| Blog cards / detail       | `card` + article prose styles (see `style.css` §6)         |

---

## 7. Applying to a New (Product) Site

1. **Copy the design tokens** (§1) into the new project's CSS `:root` and Tailwind `theme.extend.colors.primary`.
2. **Load Inter** font in the `<head>` (or `@import`): `Inter:wght@400;500;600;700;800`.
3. **Bring over the shared classes**: `btn-primary`, `btn-secondary`, `eyebrow`, `section-heading`, `section-subheading`, `card`, `check-item`, `reveal`, `scroll-track`, `svc-card` (§3).
4. **Reuse the layout shells**: floating pill navbar, section rhythm with alternating backgrounds, dark `primary-900` footer (§4).
5. **Swap brand**: replace logo, name, and copy; keep the green/white/gray palette unless the product has its own accent — if so, update the single `primary` palette in Tailwind and the `:root` tokens.
6. **Wire the section order** to your product's content: Hero → Featured product → Feature list → How it works → Pricing/Cards → Testimonials → CTA → Footer.

---

## 8. Quick Reference — Most-Used Classes

| Purpose                | Classes                                              |
| ---------------------- | ---------------------------------------------------- |
| Page section           | `px-4 py-20 sm:px-6 sm:py-28 lg:px-8`                 |
| Content container      | `mx-auto max-w-7xl`                                   |
| Primary CTA            | `btn-primary`                                         |
| Secondary CTA          | `btn-secondary`                                       |
| Section kicker         | `eyebrow`                                             |
| Section title          | `section-heading`                                     |
| Section subtitle       | `section-subheading`                                  |
| Generic card           | `card`                                                |
| Service card           | `svc-card` (+ `__header`, `__divider`, `__cta`)        |
| Icon chip              | `flex h-10 w-10 rounded-full bg-primary-100 text-primary-600` |
| Hero image             | `rounded-xl shadow-lg`                                |

---

_Generated from the deboistech website source (`index.html`, `css/style.css`, `tailwind.config.js`, `deboistech-next/src/app/globals.css`)._
