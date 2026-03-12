# Family Tree Visualization App

Interactive family tree viewer built with React and React Flow, designed from a Figma prototype.

## Quick Start

```bash
cd family-tree-app
npm install
npm run dev
```

## Architecture

### Data Pipeline

1. **GEDCOM backup** from MyHeritage (195 individuals, 70 families)
2. **Scripts** (`../scripts/`) parse GEDCOM, sync to Obsidian vault, generate JSON
3. **`public/data.json`** — 183 people with relationships, loaded by the app

To regenerate data from Obsidian vault:
```bash
cd ../scripts
node generate-json.js
```

Key fixes in `generate-json.js`:
- Uses **filename** as person name (not H1 header) to match Obsidian `[[links]]`
- Applies `.normalize('NFC')` to fix macOS NFD-decomposed Unicode filenames
- Skips empty filenames

### Design System

Tokens defined in `src/styles/tokens.css`, sourced from Figma variables:
- **Fonts**: IBM Plex Sans (500, titles), IBM Plex Mono (400, body/labels)
- **Colors**: Highlight `#7398FF`, Accent `#0F4FFF`, High emphasis `#212121`, Medium `#666`, Low emphasis `#DCDCDC`, BG1 `#FFF`, BG2 `#FAFAFA`
- **Spacing**: 8px base scale (space-000 through space-1000)
- **No Tailwind** — plain CSS with BEM-style class names

### Component Structure

```
src/
  App.jsx                    — Main layout: canvas + sidebar + search + controls
  App.css
  styles/tokens.css          — Design tokens (CSS custom properties)
  hooks/useFamilyData.js     — Fetches /data.json
  utils/graphBuilder.js      — Custom layout engine (no dagre)
  components/
    FamilyTree.jsx           — React Flow canvas with ReactFlowProvider
    PersonNode.jsx + .css    — Person card (200x256px, photo + name + date)
    FamilyEdge.jsx           — Custom SVG edge (treeBranch, lBend, spouse, etc.)
    ExpandButton.jsx + .css  — "Expand sub-tree" pill button
    Sidebar.jsx + .css       — Right panel with person details
    SearchBar.jsx + .css     — Search with autocomplete dropdown
    ControlButtons.jsx + .css — Fullscreen, Home, Zoom in/out
```

### Layout Engine (`graphBuilder.js`)

Custom layout (replaced dagre) that shows 3-4 generations around the selected person:

- **Row -2**: Grandparents (spouse pairs, with overlap prevention)
- **Row -1**: Parents (spouse pair, centered above siblings + selected)
- **Row 0**: Siblings (left) | Selected | Partner (40px gap) | Ex-partner (96px gap)
- **Row +1**: Children (grouped by partner vs ex-partner)

**Spacing constants**: W=200, H=256, SPOUSE_GAP=40, SIBLING_GAP=80, EX_GAP=96, ROW_GAP=96

### Edge Types (`FamilyEdge.jsx`)

| Type | Color | Style | Description |
|------|-------|-------|-------------|
| `spouse` | Blue `#7398FF` | Solid | Horizontal line between partners |
| `exSpouse` | Grey `#DCDCDC` | Dashed `4 8` | Horizontal line to ex-partner |
| `treeBranch` | Blue | Solid | Trunk + rail + drops (parent→children) |
| `exTreeBranch` | Grey | Solid | Same shape for ex-partner children |
| `lBend` | Blue | Solid | L-shaped grandparent→parent connector |
| `expandTick` | Blue | Solid | Small vertical tick below expand button |

Tree branch structure: vertical trunk from couple midpoint → horizontal rail (20px below cards) → vertical drops to each child.

### Sidebar

- Width: `20vw` (min 420px, max 600px)
- Padding: 80px top/bottom, 40px left/right
- Details: CSS grid `1fr 2fr`, font 18px
- Person name links navigate to that person
- Close button hides sidebar until next card click

### Key Interactions

- **Click card** → select person, show sidebar, rebuild tree around them
- **Click expand button** → navigate to that person (expand their sub-tree)
- **Click name link in sidebar** → navigate to that person
- **Search** → fuzzy filter, click result to navigate
- **Home button** → return to root person (Alexander Kotomanov)

## Build

```bash
npm run build
# Output: dist/ — deploy to any static hosting
```

## Tech Stack

- React 19 + Vite
- React Flow 11 (canvas, nodes, edges, pan/zoom)
- No dagre, no Tailwind — custom layout + plain CSS
