# Zettelkasten Branch Tracker - Claude Development Guide

## Overview
This is an Obsidian plugin that visualizes Zettelkasten note hierarchies in a graph-like interface. The plugin parses Zettelkasten ID numbering systems and displays branching relationships across multiple tiers.

## Project Structure

```
zettelkasten-branch-tracker/
├── main.ts                 # Main plugin logic and UI view
├── types.ts                # TypeScript interfaces and types
├── manifest.json           # Plugin metadata
├── package.json            # Node.js dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── esbuild.config.mjs      # Build configuration
├── version-bump.mjs        # Version management script
├── versions.json           # Version history
├── README.md               # User documentation
└── data.json               # Plugin data (if any)
```

## Build System

### Commands
- `npm run dev` - Development build with file watching
- `npm run build` - Production build (TypeScript check + esbuild bundle)
- `npm run version` - Bump version and update manifest/versions files

### Configuration
- **TypeScript**: Configured for ES2018 target, strict mode enabled
- **esbuild**: Bundles to `main.js`, includes Obsidian externals
- **Dependencies**: Uses Obsidian API, TypeScript, esbuild for building

## Core Architecture

### Main Classes

1. **ZettelkastenBranchTracker** (main.ts:11-809)
   - Main plugin class extending Obsidian's Plugin
   - Handles plugin lifecycle, settings, and navigation commands
   - Contains Zettelkasten ID parsing logic

2. **ZettelkastenBranchView** (main.ts:811-1693)
   - ItemView subclass for the graph visualization
   - Canvas-based rendering with interactive controls
   - Handles mouse events, animations, and UI updates

3. **ZettelkastenSettingTab** (main.ts:1695-1753)
   - Plugin settings interface
   - Configures default depth, branches, and spacing

### Key Methods

#### ID Parsing & Hierarchy
- `parseZettelId()` (main.ts:110) - Extracts Zettelkasten ID from filename
- `findParentId()` (main.ts:115) - Determines parent ID based on notation patterns
- `buildZettelNetwork()` (main.ts:145) - Builds complete node/edge network
- `compareZettelIds()` (main.ts:628) - Sorts IDs alphanumerically

#### Network Building
- `addParentTier()` (main.ts:358) - Adds parent and sibling nodes
- `addGrandparentTier()` (main.ts:281) - Adds grandparent and aunt/uncle nodes
- `addCurrentNoteTier()` (main.ts:424) - Adds current note and linear continuations
- `addChildrenTier()` (main.ts:453) - Adds child nodes with dot notation

#### Navigation
- `navigateToSibling()` (main.ts:648) - Navigate between siblings
- `navigateToParent()` (main.ts:703) - Navigate to parent note
- `navigateToFirstChild()` (main.ts:732) - Navigate to first child
- `navigateToContinuation()` (main.ts:764) - Navigate linear sequences

### Data Structures

#### Types (types.ts)
```typescript
interface ZettelNode {
    id: string;
    title: string;
    level: number;           // -4 to 1 (great-grandparent to child)
    isCenter: boolean;
    position: { x: number; y: number };
    subnotesCount?: number;  // For node sizing
    depthScore?: number;     // Normalized depth (0-1)
}

interface ZettelEdge {
    from: string;
    to: string;
    type: 'parent-child' | 'linear-continuation' | 'sequence-link';
}

interface ZettelNetwork {
    nodes: Map<string, ZettelNode>;
    edges: ZettelEdge[];
}
```

## Zettelkasten ID Parsing

### Supported Formats
- Basic sequences: `1114`, `1114a`, `1114b`
- Branching: `1114.1`, `1114.2`, `1114.1.1`
- Mixed notation: `2311.4b1.1b1.2.4`
- Linear continuations: `1114a1`, `1114a2`

### Parsing Logic
The plugin uses regex patterns to identify:
- **Parent relationships**: Remove trailing letters/numbers/dots
- **Linear continuations**: Same base + letter or number suffix
- **True children**: Base + dot notation (`.1`, `.2`, etc.)

### Hierarchy Levels
- **Level -4**: Great-grandparents
- **Level -3**: Grandparents  
- **Level -2**: Parents and aunts/uncles
- **Level -1**: Siblings
- **Level 0**: Current note and linear continuations
- **Level 1**: Children

## UI Components

### Controls Section
- **Depth slider**: 1-3 levels of hierarchy
- **Branch slider**: 1-10 max branches per level
- **Spacing slider**: 50%-200% layout spacing
- **Checkboxes**: Toggle subnote counts and auto-update

### Canvas Rendering
- **Nodes**: Colored circles with size based on subnote count
- **Edges**: Solid lines (hierarchy) or dashed (linear sequences)
- **Labels**: Node IDs positioned below nodes
- **Animations**: Smooth hover effects and scaling

### Interaction
- **Click**: Navigate to note
- **Ctrl/Cmd+Click**: Open in new tab
- **Mouse wheel**: Zoom in/out
- **Click+drag**: Pan around view
- **Hover**: Highlight nodes with scaling effect

## Settings & Configuration

### Default Settings (main.ts:4-9)
```typescript
const DEFAULT_SETTINGS: PluginSettings = {
    showDepth: 2,
    horizontalSpacing: 150,
    verticalSpacing: 100,
    maxBranches: 5
};
```

### Settings Panel
Available in Obsidian Settings → Community Plugins → Zettelkasten Branch Tracker:
- Default maximum depth (1-3)
- Default maximum branches (1-10)  
- Horizontal/vertical spacing values

## Development Notes

### Key Features
1. **Smart node sizing**: Nodes scale based on number of subnotes
2. **Depth scoring**: Normalizes subnote counts for visual scaling
3. **Animation system**: Uses requestAnimationFrame for smooth interactions
4. **Memory efficient**: Clears and rebuilds node maps on updates
5. **Responsive**: Adapts to Obsidian's sidebar resizing

### Performance Considerations
- Canvas rendering for smooth graphics
- Animation loop with needsRender flag to minimize redraws
- ResizeObserver for efficient layout updates
- Map-based node storage for O(1) lookups

### Error Handling
- Graceful handling of missing parent notes
- Fallback to synthetic parents for sequences
- Empty state rendering when no Zettelkasten ID found

## Testing & Debugging

### Development Setup
1. Install dependencies: `npm install`
2. Build in development mode: `npm run dev`
3. Enable Developer Console in Obsidian
4. Check browser console for any errors

### Common Issues
- **ID parsing**: Check regex patterns in `parseZettelId()` and `findParentId()`
- **Rendering**: Canvas context issues, check `resizeCanvas()` method
- **Navigation**: File not found errors in navigation methods
- **Performance**: Animation loop efficiency, check `needsRender` flag usage

### Build Process
The plugin uses esbuild for fast bundling:
1. TypeScript compilation with `tsc -noEmit -skipLibCheck`
2. Bundle with esbuild targeting ES2018
3. Output to `main.js` (49.7kb in production)

## Commands Available

### Plugin Commands (registered in onload)
- `open-zettelkasten-branch-view`: Open the branch tracker view
- Navigation commands for keyboard shortcuts:
  - `navigate-to-next-sibling`
  - `navigate-to-previous-sibling`
  - `navigate-to-parent`
  - `navigate-to-first-child`
  - `navigate-to-next-continuation`
  - `navigate-to-previous-continuation`

### UI Controls
- Ribbon icon: Opens branch tracker in right pane
- Settings tab: Configure default behaviors
- Interactive canvas: Mouse-based navigation and visualization

This plugin demonstrates sophisticated graph visualization techniques while maintaining good performance and user experience within the Obsidian ecosystem.