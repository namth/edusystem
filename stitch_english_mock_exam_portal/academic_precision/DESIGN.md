---
name: Academic Precision
colors:
  surface: '#fff8f5'
  surface-dim: '#e5d8d0'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1e9'
  surface-container: '#f9ebe4'
  surface-container-high: '#f3e6de'
  surface-container-highest: '#ede0d9'
  on-surface: '#211a16'
  on-surface-variant: '#52443a'
  inverse-surface: '#362f2a'
  inverse-on-surface: '#fceee7'
  outline: '#857469'
  outline-variant: '#d8c2b6'
  surface-tint: '#8a501f'
  primary: '#6d3807'
  on-primary: '#ffffff'
  primary-container: '#8a4f1e'
  on-primary-container: '#ffceac'
  inverse-primary: '#ffb782'
  secondary: '#785840'
  on-secondary: '#ffffff'
  secondary-container: '#fdd1b4'
  on-secondary-container: '#795841'
  tertiary: '#004d5e'
  on-tertiary: '#ffffff'
  tertiary-container: '#00677c'
  on-tertiary-container: '#98e3fb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdcc5'
  primary-fixed-dim: '#ffb782'
  on-primary-fixed: '#301400'
  on-primary-fixed-variant: '#6e3908'
  secondary-fixed: '#ffdcc5'
  secondary-fixed-dim: '#e8bea1'
  on-secondary-fixed: '#2c1605'
  on-secondary-fixed-variant: '#5e402a'
  tertiary-fixed: '#b2ebff'
  tertiary-fixed-dim: '#86d1e9'
  on-tertiary-fixed: '#001f27'
  on-tertiary-fixed-variant: '#004e5e'
  background: '#fff8f5'
  on-background: '#211a16'
  surface-variant: '#ede0d9'
typography:
  display-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max-width: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

This design system is built for a high-performance educational environment, focusing on the rigorous needs of English mock testing and classroom management. The brand personality is **Trustworthy, Sophisticated, and Academic**, prioritizing cognitive ease and clarity over decorative elements.

The visual style is **Minimalist with Modern/Classic influences**. It leverages heavy whitespace to reduce "test anxiety" and uses a structured grid to organize complex data such as analytics and test results. The aesthetic is clean and professional, utilizing a warm, organic color palette to create a sense of established academic authority and focused calm.

## Colors

The palette is anchored by **Burnished Sienna** (Primary) to evoke a sense of tradition and reliability, and **Muted Oak** (Secondary) for a grounded, professional feel. 

- **Primary & Secondary:** Used for navigational elements, primary actions, and brand reinforcement, moving away from cold blues toward warmer, more inviting tones.
- **Backgrounds:** A soft stone-tinted gray (`#F8F7F6`) is used for the main workspace to reduce eye strain during long testing sessions, while pure white is reserved for cards and content containers.
- **Status Colors:** Success states utilize a gentle Mint Green, while alerts use a soft Orange/Amber. The **Ocean Blue** (Tertiary) is used for technical highlights, progress markers, and interactive feedback.
- **Text:** Almost black (`#1D1D1B`) ensures maximum contrast and legibility for long-form reading passages.

## Typography

The typography strategy prioritizes focus and reading comprehension. 

- **Headlines:** **Be Vietnam Pro** provides a contemporary, friendly yet professional look for page titles and section headers. Its slightly geometric nature keeps the UI feeling modern.
- **Body:** **Inter** is the workhorse for all test content, instructions, and data. It is chosen for its exceptional legibility and neutral character.
- **Labels & Data:** **JetBrains Mono** (monospaced) is used for word counters, timers, and technical metadata to ensure character alignment and a precise, "technical" feel during examinations.

## Layout & Spacing

The layout follows a **Fluid Grid** system within a max-width container for desktop, ensuring that reading lines do not become too long.

- **Grid:** A 12-column grid is used for dashboard views and analytics, allowing cards to span 3, 4, 6, or 12 columns.
- **Split-Screen Logic:** For mock tests, the layout utilizes a 50/50 or 60/40 split-screen. The left pane contains the stimulus (reading passage/audio player) and the right pane contains the input fields/questions. Both panes scroll independently.
- **Rhythm:** An 8px base unit governs all padding and margins. Generous vertical spacing (32px-48px) between sections is used to maintain a "spacious" and calm atmosphere.

## Elevation & Depth

To maintain a clean, professional aesthetic, this design system avoids heavy shadows in favor of tonal layering.

- **Tonal Layers:** Depth is primarily communicated through color. The main background is a warm light gray, while interactive cards and test containers are pure white (`#FFFFFF`).
- **Low-Contrast Outlines:** Interactive elements like input fields and inactive cards use a 1px border in a soft warm-gray/stone.
- **Soft Shadows:** Only the "Active" or "Hovered" states of cards and floating action buttons use a very subtle, diffused shadow (0px 4px 20px rgba(0,0,0,0.05)) to suggest interactability without cluttering the interface.

## Shapes

The shape language is defined by **Rounded** corners (8px default) to balance the professional tone with a touch of approachability. 

- **Small Components:** Checkboxes and small tags use a 4px radius.
- **Standard Components:** Buttons, input fields, and cards use an 8px radius.
- **Large Components:** Hero sections and prominent containers use a 16px radius.
- **Pill Shapes:** Used exclusively for "Status Tags" (e.g., "Completed", "In Progress") and "Word Count" badges to distinguish them from actionable buttons.

## Components

### Buttons & Inputs
- **Primary Action:** Solid Burnished Sienna with white text, 8px radius.
- **Input Fields:** 1px border, Inter font, 16px padding. During tests, the active input field gains a 2px Sienna border to clearly indicate focus.

### Specialized Media Components
- **Audio Player:** Minimalist bar with a progress line (Ocean Blue), a play/pause toggle, and a monospaced "Time Remaining" counter. No unnecessary skeuomorphism.
- **Waveform Animations:** Used during speaking tests; a simple, thin-line CSS animation in Ocean Blue to provide visual feedback that audio is being captured.
- **Word Counter:** Floating pill-shaped badge in the corner of essay inputs, using JetBrains Mono for jitter-free number updates.

### Tables & Analytics
- **Tables:** No vertical borders. Rows have a subtle hover state. Status tags (e.g., "Pass", "Fail") use the secondary palette with high-contrast text.
- **Analytics Cards:** Grid-aligned white containers. Utilize small sparkline charts (Ocean Blue) to show student progress trends.

### Test Interface
- **Split-Screen:** A vertical divider that can be adjusted by the user. Left side (Content) uses a slightly larger line-height (1.75) for long-form reading passages.