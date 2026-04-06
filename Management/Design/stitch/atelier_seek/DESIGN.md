# Design System Specification: The Tailored Digital Experience

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Atelier"**

This design system is built to mirror the experience of a high-end bespoke tailoring house. It moves away from the "template" feel of standard e-commerce by embracing **Editorial Asymmetry** and **Tonal Depth**. The goal is to make the user feel they are browsing a premium physical lookbook rather than a digital database. 

We achieve this through:
*   **Intentional Whitespace:** Using the spacing scale (e.g., `16` and `20`) to let high-quality photography breathe.
*   **Layered Sophistication:** Moving beyond flat UI by stacking surfaces of varying "weights" to create a sense of physical material.
*   **Bilingual Fluidity:** A seamless transition between English (LTR) and Hebrew (RTL) that maintains the same "Gold Ratio" balance regardless of text direction.

---

## 2. Colors & Surface Philosophy
The palette is rooted in timeless masculinity: Deep Charcoals and Crisp Whites, punctuated by a refined Amber-Gold that mimics the hardware of a luxury suit.

### The "No-Line" Rule
To maintain a premium feel, **1px solid borders are prohibited for sectioning.** Conventional lines feel "cheap" and structural. Instead:
*   Define boundaries through background shifts (e.g., a `surface-container-low` section sitting against a `surface` background).
*   Use the `16` or `20` spacing tokens to create "invisible" borders through negative space.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked fine papers.
*   **Base Layer:** `surface` (#fcf9f8) for the main body.
*   **Secondary Layer:** `surface-container-low` for large content blocks.
*   **Focus Layer:** `surface-container-highest` or `surface-lowest` for cards and interactive modules to create "lift" without heavy shadows.

### The Glass & Gradient Rule
For floating elements (Navigation bars, Quick-view modals), use **Glassmorphism**: 
*   **Fill:** `surface` at 80% opacity.
*   **Effect:** `backdrop-blur: 20px`.
*   **CTA Soul:** For primary buttons or luxury badges, use a subtle linear gradient from `tertiary_fixed` (#ffdea5) to `tertiary_fixed_dim` (#e9c176). This provides a metallic "sheen" that flat hex codes lack.

---

## 3. Typography
The type system balances the heritage of the tailoring craft with the precision of modern Israeli design.

| Level | Font Family | Usage | Personality |
| :--- | :--- | :--- | :--- |
| **Display (L/M/S)** | `notoSerif` | Hero headers, Editorial quotes | Grand, Traditional |
| **Headline (L/M/S)** | `notoSerif` | Page titles, Category headers | Authoritative |
| **Title (L/M/S)** | `manrope` | Product names, Section sub-heads | Modern, Clean |
| **Body (L/M/S)** | `manrope` | Product descriptions, UI labels | Readable, Technical |
| **Label (M/S)** | `manrope` | Micro-copy, Badges, Metadata | Functional |

**Director's Note:** For Hebrew (RTL) typesetting, increase the `line-height` by 1.2x compared to English to accommodate the visual weight of the Hebrew character set.

---

## 4. Elevation & Depth
In this system, depth is "felt" rather than "seen." 

*   **Tonal Layering:** Avoid shadows for static cards. Instead, place a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f6f3f2) background. This creates a soft, natural "step-up" effect.
*   **Ambient Shadows:** For active states (hovered cards or open menus), use an ultra-diffused shadow: `box-shadow: 0 24px 48px -12px rgba(28, 27, 27, 0.06)`. This mimics soft gallery lighting.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility in input fields, use `outline-variant` at 20% opacity. Never use 100% opaque borders.

---

## 5. Components

### Buttons & Interaction
*   **Primary:** Solid `primary` (#000000) with `on-primary` (#ffffff) text. Corners set to `md` (0.375rem). Hover state should trigger a subtle expansion of letter-spacing and a slight shift to `secondary`.
*   **Tertiary (Luxury):** For "Limited Edition" or "Bespoke" services, use the `tertiary_fixed` gradient with a subtle hover "glow."

### Inputs & Fields
*   **Styling:** Forgo the box. Use a "Bottom Line Only" approach or a very subtle `surface-container-highest` background. 
*   **Error State:** Use `error` (#ba1a1a) text only. Do not turn the entire box red; it breaks the luxury aesthetic.

### Cards & Product Grids
*   **The No-Divider Rule:** Explicitly forbid divider lines in product lists.
*   **Separation:** Use the Spacing Scale `4` (1.4rem) between items. Use `surface-variant` for image backgrounds to create a "framed" look for product photography.

### Signature Component: The "Atelier Badge"
A floating chip used for fabric quality (e.g., "Super 150s Wool").
*   **Style:** `tertiary_container` background with `on-tertiary-container` text. 
*   **Shape:** `full` (9999px) pill shape for a distinct contrast against the sharp lines of the suits.

---

## 6. Do's & Don'ts

### Do:
*   **Embrace Asymmetry:** In hero sections, align the `display-lg` text to the left/right and the supporting imagery slightly off-center to create an editorial feel.
*   **Use Generous Padding:** When in doubt, increase the padding. High-end brands do not crowd their content.
*   **RTL/LTR Harmony:** Ensure that when the layout flips for Hebrew, the "visual weight" (e.g., a large image on one side) balances the text density on the other.

### Don't:
*   **No Heavy Shadows:** Never use high-opacity or "tight" shadows. If the shadow is clearly visible, it is too heavy.
*   **No Pure Black Text:** While `primary` is #000000, use `on_surface_variant` (#444748) for long-form body text to reduce eye strain and feel more "ink-on-paper."
*   **No Standard Icons:** Avoid generic, thick-stroke icon sets. Use ultra-thin (1pt) minimalist icons that match the `manrope` font-weight.

---

## 7. Spacing & Rhythm
This system uses a custom scale to ensure "Breathing Room." 

*   **Section Gaps:** Use `20` (7rem) or `24` (8.5rem).
*   **Component Grouping:** Use `4` (1.4rem) or `5` (1.7rem).
*   **Micro-spacing:** Use `1` (0.35rem) for label-to-input relationships.

All measurements must strictly follow the Spacing Scale to maintain a mathematical harmony across the bilingual experience.