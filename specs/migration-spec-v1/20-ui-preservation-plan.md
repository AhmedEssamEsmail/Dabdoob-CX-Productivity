# UI Preservation Plan

## Overview
This plan details how to fully preserve the original CX Productivity system's visual design, colors, and UX when migrating from Google Apps Script to Next.js.

## Original Design System Analysis

### Color Palette
Based on the original `index.html` and embedded CSS:

**Background Colors:**
- Primary background: `#f2f5f4` (light gray-green)
- Blue gradient: `#cfe4ff` (light blue)
- Pink gradient: `#fbd9e8` (light pink)
- Dark mode background: `#131b1d` (dark gray)

**Text Colors:**
- Primary text: `#4d5d63` (dark gray)
- Dark mode text: `#a9b8b5` (light gray-blue)

**Status Colors (from CSS variables):**
- Neutral: `#46546a` (fg), `#e6eaf1` (bg), `#8a96a8` (edge)
- Info: `#0f5a96` (fg), `#e3eefa` (bg), `#176aaa` (edge)
- Success: `#17744a` (fg), `#e4f4ec` (bg), `#2e9a69` (edge)
- Warning: `#7d5000` (fg), `#fdf0d6` (bg), `#c68a1a` (edge)
- Error: `#b3261e` (fg), `#fbe9e7` (bg), `#d9483f` (edge)

**Accent Colors:**
- Primary accent: Pine green tones (`--pine-2`, `--pine`)
- Focus ring: `--focus`

### Typography
**Font Families:**
- Primary: `'IBM Plex Sans', system-ui, sans-serif`
- Arabic: `'IBM Plex Sans Arabic'`
- Monospace: `'IBM Plex Mono'`

**Font Weights:**
- Regular: 400
- Medium: 500
- Strong/Semibold: 600

**Text Sizes (CSS variables):**
- `--text-xs`: Extra small
- `--text-sm`: Small
- `--text-md`: Medium
- `--text-lg`: Large
- `--text-xl`: Extra large
- `--text-2xl`: 2x large
- `--text-3xl`: 3x large

**Line Heights:**
- Latin: 1.45 (default), 1.3 (dense)
- Arabic: 1.8 (default), 1.6 (dense)

### Spacing System
Based on CSS variables:
- `--cx-space-1`: 0.25rem (4px)
- `--cx-space-2`: 0.5rem (8px)
- `--cx-space-3`: 0.75rem (12px)
- `--cx-space-4`: 1rem (16px)
- `--cx-space-5`: 1.5rem (24px)
- `--cx-space-6`: 2rem (32px)
- `--cx-space-7`: 3rem (48px)
- `--cx-space-8`: 4rem (64px)
- `--cx-gutter`: 1rem (16px)
- `--cx-target`: 2.75rem (44px - touch target)

### Border Radius
- Controls: `--cx-radius-control`: 6px
- Objects/Cards: `--cx-radius-object`: 10px
- Bars: `--cx-radius-bar`: 4px

### Shadows
- Popover/Modal: `--cx-shadow-pop`: `0 12px 32px rgba(15, 27, 45, .12)`

### Layout Dimensions
- Rail width: `--cx-rail-width`: 15rem (240px)
- Top bar height: `--cx-topbar-height`: 3.5rem (56px)

### Easing & Duration
- Ease: `--cx-ease`: standard easing curve
- Duration: `--cx-dur`: fast animation duration

## Implementation Plan

### Phase 1: Design Tokens Setup
1. **Create Tailwind CSS v4 config with custom design tokens**
   - Add custom colors for the full palette
   - Add custom font families
   - Add custom spacing scale
   - Add custom border radius values
   - Add custom shadows

2. **Create CSS variables for design system**
   - Map all `--cx-*` variables to CSS custom properties
   - Ensure dark mode support via CSS variables
   - Ensure RTL support for Arabic

### Phase 2: Component Library
Create reusable components matching the original design:

1. **Navigation Components**
   - Top bar (height: 3.5rem)
   - Side rail (width: 15rem)
   - Navigation links with hover states

2. **Status Components**
   - Status badges (neutral, info, success, warning, error)
   - Status indicators with foreground/background/edge colors

3. **Card Components**
   - Base card with border radius 10px
   - Card shadows matching `--cx-shadow-pop`
   - Surface variants (surface, surface-2, surface-sunken)

4. **Button Components**
   - Primary buttons (pine green accent)
   - Secondary buttons
   - Touch target size (2.75rem)

5. **Table Components**
   - Data tables with header rows
   - Row hover states
   - Status column styling

6. **Form Components**
   - Input fields with border radius 6px
   - Focus rings using `--cx-focus`
   - Labels and helper text

7. **Loading Components**
   - Bear-themed loading animation (hop, sway, peek scenes)
   - Boot splash with radial gradient background
   - Reduce motion support

### Phase 3: Page-Specific UI

#### Status Validation Page
- Table layout for flags
- Status badges for flag states
- Confidence score indicators
- Action buttons (accept/reject)
- TL review interface

#### My Status Page
- Productivity score display (large number)
- Interval timeline visualization
- Status color coding
- Daily layer breakdown

#### TPH Grid
- Hourly time slots (8:00-24:00)
- Channel-based columns
- Activity logging interface
- Cap indicators
- Case counts per hour

#### Admin Pages
- Configuration form
- Roster management table
- Analytics dashboards
- View-as controls

### Phase 4: Responsive Design
- Mobile-first approach
- Breakpoints matching original behavior
- Collapsible side rail on mobile
- Touch-friendly interactions

### Phase 5: Dark Mode
- Full dark mode color mapping
- Automatic system preference detection
- Manual toggle
- Persist preference in localStorage

### Phase 6: RTL/Arabic Support
- Automatic RTL layout for Arabic
- Font family switching
- Text direction handling
- Layout mirroring

### Phase 7: Accessibility
- Keyboard navigation
- Screen reader support
- Focus indicators
- Reduce motion support
- Color contrast compliance

## Design Token File Structure

```
src/
├── design/
│   ├── tokens/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   ├── borders.ts
│   │   └── shadows.ts
│   ├── tailwind.config.ts
│   └── globals.css
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── Table.tsx
│   │   ├── Input.tsx
│   │   └── Loading.tsx
│   ├── layout/
│   │   ├── TopBar.tsx
│   │   ├── SideRail.tsx
│   │   └── Navigation.tsx
│   └── pages/
│       ├── StatusValidation.tsx
│       ├── MyStatus.tsx
│       ├── TphGrid.tsx
│       └── AdminPanel.tsx
```

## Migration Checklist

- [ ] Extract all CSS variable values from original HTML
- [ ] Create Tailwind config with custom design tokens
- [ ] Set up IBM Plex Sans fonts
- [ ] Create design token CSS variables
- [ ] Build UI component library
- [ ] Implement Navigation (top bar + side rail)
- [ ] Implement Status Validation page with original layout
- [ ] Implement My Status page with original layout
- [ ] Implement TPH Grid with original layout
- [ ] Implement Admin pages with original layout
- [ ] Add dark mode support
- [ ] Add RTL/Arabic support
- [ ] Test responsive breakpoints
- [ ] Verify color contrast
- [ ] Test keyboard navigation
- [ ] Test reduce motion preference
- [ ] Cross-browser testing

## Reference Files

Original files to reference for design:
- `original_deprecated/index.html` - Design tokens, colors, fonts
- `original_deprecated/ProductivityApp.js` - UI structure
- `original_deprecated/ProdValidation.js` - Status validation UI logic
- `original_deprecated/ProdTph.js` - TPH grid UI logic
