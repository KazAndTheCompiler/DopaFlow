# DopaFlow v2 Skin Editor Guide

A comprehensive guide to using the DopaFlow Skin Maker tool for creating custom themes.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Interface](#user-interface)
4. [Color Tokens](#color-tokens)
5. [Gradient Tokens](#gradient-tokens)
6. [Using Presets](#using-presets)
7. [Exporting Your Skin](#exporting-your-skin)
8. [Installing Custom Skins](#installing-custom-skins)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Introduction

The DopaFlow Skin Maker is a standalone visual editor for creating custom color themes (skins) for the DopaFlow productivity application. It provides:

- **Live Preview**: See changes in real-time on a mock application UI
- **16 Built-in Presets**: Start from professionally designed color palettes
- **Gradient Support**: Create modern gradient backgrounds with depth
- **Easy Export**: Generate ready-to-use CSS for immediate installation

### What is a Skin?

A skin in DopaFlow is a collection of CSS custom properties (variables) that define the application's visual appearance. Each skin controls:

- Background colors and gradients
- Surface (card/panel) colors
- Text colors for different hierarchy levels
- Accent colors for interactive elements
- State colors (completed, overdue, conflicts, etc.)
- Shadow definitions for depth
- Calendar and event-specific colors

---

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or bun package manager

### Starting the Skin Maker

```bash
# Navigate to the skinmaker directory
cd skinmaker

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

The Skin Maker will open in your browser at `http://localhost:5173` (or the next available port).

### Interface Overview

The Skin Maker interface consists of two main sections:

1. **Left Sidebar** - Token editing controls
   - Skin name input
   - Quick presets grid
   - Token group sections
   - Export button

2. **Right Preview Panel** - Live application preview
   - Mock sidebar navigation
   - Sample task cards
   - Calendar widget
   - Statistics display

---

## User Interface

### Left Sidebar

#### Skin Name Input
At the top of the sidebar, enter a unique identifier for your skin. This will be used as the CSS selector: `[data-skin="your-skin-name"]`.

**Naming conventions:**
- Use lowercase letters
- Use hyphens for spaces (e.g., `forest-gradient`)
- Avoid special characters
- Keep it descriptive but concise

#### Quick Presets Grid
Below the name input is a grid of preset buttons. Each shows a mini gradient preview and label. Click any preset to load its complete token set.

#### Token Groups
Tokens are organized into logical groups:

1. **Background & Surface** - Foundation colors
2. **Text & Muted** - Typography colors
3. **Accent & Interactive** - Brand and action colors
4. **States & Indicators** - Status and feedback colors
5. **Calendar & Events** - Scheduling-specific colors
6. **Gradient (Optional)** - Advanced gradient overrides

#### Export Button
At the bottom of the sidebar, click "Export Skin CSS" to generate and copy your skin's CSS.

### Right Preview Panel

The preview panel shows a mock application UI that updates in real-time as you edit tokens. It includes:

- **Sidebar** - Navigation items demonstrating `--sidebar-gradient`
- **Main Content** - Task cards showing `--card-gradient`
- **Statistics** - Sample data demonstrating state colors
- **Calendar** - Month view showing event colors

---

## Color Tokens

### Editing Color Tokens

Each color token has:
- **Preview Swatch** - Shows the current color
- **Label** - Describes the token's purpose
- **Value Display** - Shows the hex/rgba value

**To edit a color:**
1. Click the color swatch
2. Use the native color picker to select a new color
3. The preview updates immediately

### Token Reference

#### Background & Surface

| Token | Purpose | Recommendation |
|-------|---------|----------------|
| `--bg-app` | Main application background | Darkest/base color for dark themes |
| `--surface` | Card and panel backgrounds | Slightly lighter than bg-app |
| `--surface-2` | Elevated surfaces (modals, dropdowns) | Lighter than surface |
| `--border` | Default border color | Subtle contrast with surfaces |

#### Text & Muted

| Token | Purpose | Recommendation |
|-------|---------|----------------|
| `--text` | Primary text color | High contrast with background |
| `--text-muted` | Secondary/de-emphasized text | 40-60% opacity feel |
| `--text-inverted` | Text on inverted backgrounds | For dark text on light surfaces |
| `--text-link` | Hyperlink color | Should stand out, often accent hue |

#### Accent & Interactive

| Token | Purpose | Recommendation |
|-------|---------|----------------|
| `--accent` | Primary brand color | Used for focus rings, active states |
| `--accent-soft` | Soft/muted accent | For subtle highlights |
| `--focus-ring` | Focus indicator | Semi-transparent accent |
| `--shadow-soft` | Subtle drop shadow | For low elevation |
| `--shadow-elevated` | Medium elevation shadow | For cards and panels |
| `--shadow-floating` | High elevation shadow | For modals and popovers |

#### States & Indicators

| Token | Purpose | Recommendation |
|-------|---------|----------------|
| `--state-completed` | Completed tasks/items | Green hue |
| `--state-overdue` | Overdue items | Red hue |
| `--state-conflict` | Conflicts/warnings | Purple or orange |
| `--state-readonly` | Read-only indicators | Gray or muted tone |
| `--state-drag-active` | Active drag state | Accent color |
| `--state-drop-target` | Drop target highlight | Soft accent |

#### Calendar & Events

| Token | Purpose | Recommendation |
|-------|---------|----------------|
| `--timeline-now` | Current time indicator | Accent color |
| `--calendar-grid-line` | Calendar grid lines | Subtle border color |
| `--day-today-ring` | Today's day ring | Accent color |
| `--event-default` | Default event blocks | Warm or neutral |
| `--task-default` | Task blocks in calendar | Complementary to events |
| `--reminder-default` | Reminder indicators | Warning-like color |
| `--busy-block-hint` | Busy time hints | Semi-transparent |
| `--free-slot-hint` | Available time hints | Subtle, inviting |
| `--selected-range` | Selected date range | Semi-transparent accent |

---

## Gradient Tokens

### Understanding Gradients

DopaFlow v2 supports advanced gradient backgrounds for a modern, layered depth effect. Gradients are **optional** — if left empty, the skin falls back to solid colors.

### Gradient Token Types

| Token | Applied To | Recommended Angle |
|-------|-----------|-------------------|
| `--bg-gradient` | Main app background | 175° (top-to-bottom) |
| `--sidebar-gradient` | Sidebar navigation | 180° (vertical) |
| `--card-gradient` | Cards and panels | 155-160° (diagonal) |
| `--surface-gradient` | Elevated surfaces | 145° (subtle lift) |

### Using the Gradient Picker

Each gradient token has an expanded picker with:

#### Angle Slider
- Drag to adjust gradient direction (0-360°)
- Common angles: 145°, 155°, 160°, 175°, 180°
- Display shows current angle in degrees

#### Color Stops
- **Minimum 2 stops** (start and end)
- **Add stops** with "+ Add Color Stop" button
- **Remove stops** with × button (when 3+ stops exist)
- **Position control** — set percentage (0-100%)
- **Color picker** — click swatch to change color

#### Live Preview
- Small gradient bar shows current gradient
- Updates in real-time as you edit

#### Preset Gradients
Quick-apply buttons for common gradients:
- **Forest Dusk** — Dark green to sage
- **Ocean Deep** — Navy to teal
- **Amber Fade** — Dark amber to gold

### Creating a Gradient

**Example: Forest Gradient Background**

1. Expand the "Gradient (Optional)" section
2. Find "App Background Gradient"
3. Click "Forest Dusk" preset OR manually:
   - Set angle to 175°
   - Stop 1: `#111e14` at 0%
   - Stop 2: `#3a5e40` at 100%
4. Preview shows the gradient in the mock UI

### Gradient Guidelines

**Do:**
- ✅ Keep luminosity shift subtle (10-15% max)
- ✅ Use angles between 145-180° for natural light
- ✅ Test gradient on large surfaces first
- ✅ Ensure text remains readable over gradients

**Don't:**
- ❌ Apply gradients to small elements (buttons, badges)
- ❌ Use dramatic color shifts (jarring transitions)
- ❌ Combine too many color stops (2-3 is ideal)
- ❌ Forget that solid colors are fallbacks

---

## Using Presets

### Quick Presets

The Skin Maker includes 16 professionally designed presets:

| Preset | Description | Best For |
|--------|-------------|----------|
| **Warm Analog** | Earthy browns and creams | Cozy, natural feel |
| **Midnight Neon** | Dark with vibrant cyan | Modern, tech aesthetic |
| **Paper Minimal** | Clean white with subtle gray | Distraction-free focus |
| **Aurora** | Soft teal and mint | Calming, fresh |
| **Glassy Modern** | Dark with transparency effects | Sleek, contemporary |
| **Soft Pastel** | Light purples and pinks | Gentle, friendly |
| **Amber Terminal** | Monospace amber on black | Developer/terminal vibe |
| **High Contrast** | Pure black and white | Accessibility |
| **Ink & Stone** | Warm gray with green accent | Professional, minimal |
| **Lush Forest** | Deep greens with mint accent | Nature-inspired |
| **Vampire Romance** | Dark reds and pinks | Dramatic, gothic |
| **Deep Ocean** | Navy blues with cyan | Calming, deep |
| **Sunset Blues** | Purple-blue gradients | Creative, artistic |
| **Classic Noir** | Black and gold | Timeless, elegant |
| **Cotton Candy** | Light purples and pinks | Playful, light |
| **Neon Punk** | Dark with neon purple | Bold, edgy |

### Applying a Preset

1. Click any preset button in the "Quick Presets" section
2. All tokens update to match the preset
3. Skin name auto-fills with preset name (editable)
4. Preview shows the complete theme

### Customizing Presets

Presets are starting points — feel free to:
1. Load a preset
2. Modify individual tokens
3. Add gradient overlays
4. Export as your own custom skin

---

## Exporting Your Skin

### Export Steps

1. **Complete your design**
   - Edit all desired tokens
   - Preview in the right panel
   - Test gradient tokens if using

2. **Click "Export Skin CSS"**
   - A modal appears with generated CSS
   - CSS includes all token definitions

3. **Copy the CSS**
   - Click "Copy to Clipboard" button
   - Or manually select and copy

4. **Save your CSS**
   - Paste into a text editor
   - Save with descriptive filename (optional)

### Export Format

Generated CSS follows this structure:

```css
[data-skin="your-skin-name"] {
  --bg-app: #1a2e1e;
  --surface: #243329;
  --surface-2: #2e4035;
  --border: #3d5c42;
  --text: #e8f0e3;
  --text-muted: #a8c4a0;
  /* ... all other tokens ... */
  --bg-gradient: linear-gradient(175deg, #111e14 0%, #1a2e1e 100%);
  --sidebar-gradient: linear-gradient(180deg, #0e1a11 0%, #1a2e1e 100%);
  --card-gradient: linear-gradient(155deg, #2e4035 0%, #243329 100%);
  --surface-gradient: linear-gradient(145deg, #2a3d2e 0%, #253a2c 100%);
}
```

---

## Installing Custom Skins

### Step 1: Add CSS to skins.css

1. Open `frontend/src/design-system/skins.css`
2. Paste your exported CSS at the end of the file
3. Save the file

### Step 2: Update manifest.json

1. Open `frontend/src/design-system/manifest.json`
2. Add your skin to the `skins` array:

```json
{
  "skins": [
    {
      "id": "your-skin-name",
      "label": "Your Skin Display Name",
      "file": "your-skin-name.json"
    }
  ]
}
```

### Step 3: Create JSON file (optional)

For PWA and dynamic loading:

1. Create `frontend/public/skins/your-skin-name.json`
2. Copy the CSS content into the file
3. The JSON structure wraps CSS in a `css` property

### Step 4: Update shared/skins.ts

If your project uses `shared/skins.ts`:

```typescript
export const SKINS = [
  { id: "your-skin-name", label: "Your Skin Display Name" },
  // ... other skins
];
```

### Step 5: Update SkinPicker.tsx

Add your skin to the picker component:

```typescript
// In frontend/src/components/SkinPicker.tsx
const skins = [
  { id: "your-skin-name", label: "Your Skin Display Name" },
  // ... other skins
];
```

### Step 6: Test Your Skin

1. Start the frontend: `npm run dev` in `frontend`
2. Open Settings → Appearance
3. Select your new skin from the picker
4. Verify all surfaces render correctly

---

## Best Practices

### Color Contrast

**WCAG AA Compliance:**
- Normal text: 4.5:1 contrast ratio minimum
- Large text: 3:1 contrast ratio minimum
- UI components: 3:1 contrast ratio

**Tools:**
- Use the Skin Maker preview to check readability
- Test with browser devtools contrast checkers
- Consider users with visual impairments

### Gradient Design

**Subtlety is Key:**
- Luminosity shift: 10-15% maximum
- Avoid rainbow effects
- Stick to analogous colors (adjacent on color wheel)

**Angle Selection:**
- 175-180°: Natural top-to-bottom light
- 145-160°: Diagonal depth for cards
- Avoid 0-90° (unnatural light direction)

### Token Consistency

**Maintain Relationships:**
- `--surface` should always be lighter than `--bg-app` (for dark themes)
- `--text-muted` should be visibly lighter than `--text`
- State colors should be semantically consistent (red = warning/bad)

**Test All States:**
- Hover states
- Focus rings
- Disabled states
- Error states

### Naming Conventions

**Skin IDs:**
- Lowercase with hyphens: `forest-gradient`
- Descriptive but concise
- Avoid version numbers in ID

**Display Names:**
- Title case: `Forest Gradient`
- Can include version: `Forest Gradient v2`
- User-friendly naming

### Performance

**CSS Efficiency:**
- Avoid overly complex gradients (4+ stops)
- Use hex colors over rgba when alpha = 1
- Keep shadow blur radius reasonable (20-60px)

---

## Troubleshooting

### Issue: Skin doesn't appear in picker

**Solution:**
1. Verify manifest.json entry is valid JSON
2. Check that skin ID matches in all files
3. Restart the development server
4. Clear browser cache

### Issue: Gradient not showing

**Solution:**
1. Ensure gradient value is complete CSS: `linear-gradient(...)`
2. Check that angle and stops are defined
3. Verify CSS syntax (commas, parentheses)
4. Test with a preset gradient first

### Issue: Colors look wrong in app

**Solution:**
1. Check that all tokens are defined (no empty values)
2. Verify token names match exactly (case-sensitive)
3. Test in Skin Maker preview first
4. Compare with a working preset skin

### Issue: Text is hard to read

**Solution:**
1. Increase contrast between text and background
2. Use the Skin Maker to preview with sample content
3. Test with actual app content, not just preview
4. Consider accessibility guidelines

### Issue: Export button doesn't work

**Solution:**
1. Check browser console for errors
2. Ensure all required tokens have values
3. Try manual copy from preview modal
4. Restart the Skin Maker dev server

---

## Advanced Tips

### Creating a Gradient Skin from Scratch

1. Start with `Paper Minimal` preset (neutral base)
2. Define your base palette (3-5 colors)
3. Apply base colors to solid tokens
4. Create gradient variations of your base colors
5. Apply gradients to large surfaces only
6. Test in actual application

### Matching Brand Colors

1. Get your brand hex codes
2. Apply primary brand color to `--accent`
3. Create softer variant for `--accent-soft`
4. Use brand neutrals for backgrounds
5. Ensure state colors complement (not clash with) brand

### Seasonal Themes

Consider creating multiple skins for different seasons/moods:
- **Spring**: Light, fresh pastels
- **Summer**: Bright, vibrant colors
- **Autumn**: Warm, earthy tones
- **Winter**: Cool, crisp blues and grays

### Sharing Skins

To share your custom skin with the community:
1. Export CSS from Skin Maker
2. Create a README with preview screenshot
3. Share on DopaFlow forums or GitHub Discussions
4. Consider submitting to main repository

---

## Resources

### Color Tools

- [Coolors](https://coolors.co/) - Color palette generator
- [Adobe Color](https://color.adobe.com/) - Color harmony tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - Accessibility testing

### Gradient Inspiration

- [WebGradients](https://webgradients.com/) - Gradient gallery
- [UI Gradients](https://uigradients.com/) - Gradient backgrounds
- [Gradient Hunt](https://gradienthunt.com/) - Community gradients

### DopaFlow Documentation

- [File List](./filelist.md) - Complete file reference
- [API Reference](./api-reference.md) - Backend API docs
- [Structure](../STRUCTURE.md) - Architecture overview

---

*Last Updated: March 31, 2026*
*DopaFlow v2.0.0*
