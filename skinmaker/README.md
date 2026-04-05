# DopaFlow SkinMaker Pro

A professional-grade CSS skin creator for DopaFlow/ZoesTM applications.

## Features

- **Live Preview**: See your skin changes in real-time with a mock UI that includes:
  - Sidebar navigation
  - Task list with completion states
  - Calendar with events
  - Stats dashboard
  - Floating action button

- **Production skin workflow**: Build custom skins that can be promoted into the main app's JSON manifest flow.

- **Preset-driven workflow**: Start from strong base skins instead of raw token chaos:
  - Warm Analog
  - Midnight Neon
  - Paper Minimal
  - Aurora
  - Glassy Modern
  - Soft Pastel
  - Amber Terminal
  - High Contrast
  - Ink & Stone

- **Layout-aware direction**: Skin work should now be evaluated against the app's density modes (`compact`, `comfortable`, `expanded`) rather than as color only.

- **Full Token Control**: Customize every aspect:
  - Background & Surface colors
  - Text & Muted text colors
  - Accent & Interactive elements
  - State indicators (completed, overdue, conflict, etc.)
  - Calendar & Events styling
  - Shadows and elevation

- **Export Ready**: Generates production-ready CSS ready to copy into your project

## Quick Start

```bash
# Install dependencies
cd skinmaker
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

1. **Choose a preset** to start with or begin from scratch
2. **Customize colors** using the color pickers for each token
3. **Preview** changes in real-time on the mock UI
4. **Export** when done - promote the result into the DopaFlow skin JSON + manifest flow

## Integration

To use your custom skin in DopaFlow:

1. Export the token set from SkinMaker
2. Add a JSON skin file under `frontend/public/skins/`
3. Add the skin entry to `frontend/public/skins/manifest.json`
4. Use it with: `document.documentElement.setAttribute('data-skin', 'your-skin-name')`

## Minimax workflow

If Minimax is being used specifically for skin work, use:

- `skinmaker/MINIMAX_SKINMAKER_PROMPT.md`

That prompt is intended to keep skin work grounded in the actual shipped DopaFlow shell instead of isolated mockups.

## Token Reference

| Token | Description |
|-------|-------------|
| `--bg-app` | Main application background |
| `--surface` | Card/panel background |
| `--surface-2` | Elevated/highlighted surfaces |
| `--border` | Default border color |
| `--text` | Primary text color |
| `--text-muted` | Secondary/muted text |
| `--accent` | Primary accent color |
| `--accent-soft` | Soft accent for backgrounds |
| `--state-completed` | Completed task indicator |
| `--state-overdue` | Overdue task indicator |
| `--shadow-elevated` | Card shadow |
| `--shadow-floating` | FAB/modal shadow |

## Tech Stack

- React 18
- TypeScript
- Vite
- CSS Custom Properties

## License

MIT
