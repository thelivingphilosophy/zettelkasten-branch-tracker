# Zettelkasten Branch Tracker - Claude Development Guide

## Overview
This is an Obsidian plugin that visualizes Zettelkasten note hierarchies in a graph-like interface. The plugin parses Zettelkasten ID numbering systems and displays branching relationships across multiple tiers.

## Project Structure

```
zettelkasten-branch-tracker/
├── main.js                 # Main plugin logic and UI view (JavaScript version)
├── manifest.json           # Plugin metadata
├── styles.css              # CSS classes for theme compatibility
├── README.md               # User documentation
└── data.json               # Plugin data (if any)

TypeScript Branch Structure (typescript-conversion):
├── main.ts                 # Main plugin logic and UI view
├── types.ts                # TypeScript interfaces and types
├── package.json            # Node.js dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── esbuild.config.mjs      # Build configuration
├── version-bump.mjs        # Version management script
└── versions.json           # Version history
```

## Development Status & Issues

### ✅ Successfully Implemented
- **CSS Class Extraction**: All inline styles moved to external `styles.css` file
- **Theme Compatibility**: CSS uses Obsidian's custom properties (`var(--background-secondary)`)
- **Icon System**: Ribbon icon changed to `signpost-big` with proper view icon
- **Author Information**: Updated manifest with correct author and URL
- **Responsive Design**: Flexible layouts that work in sidebars and mobile

### ❌ Failed Attempts - Theme-Adaptive Colors

**Problem**: Canvas API incompatibility with CSS custom properties
- Canvas `fillStyle` does NOT accept CSS custom property syntax like `var(--accent-color)`
- Attempted HSL/hex color conversion system with theme detection
- Complex color parsing and adjustment functions failed to render nodes

**What We Tried**:
```javascript
// FAILED APPROACH - Canvas can't use CSS variables
this.ctx.fillStyle = 'var(--accent-color)'; // ❌ Doesn't work

// ATTEMPTED WORKAROUND - Parse computed styles
const computedStyle = getComputedStyle(document.body);
const accentColor = computedStyle.getPropertyValue('--accent-color');
this.ctx.fillStyle = accentColor; // ❌ Still failed - returns empty/invalid values

// COMPLEX HSL SYSTEM - Over-engineered
hexToHsl(), hslToHex(), getComplementaryHoverColor() // ❌ Too complex, broke rendering
```

**Root Cause**: 
1. Canvas 2D context requires actual color values (#hex, rgb(), rgba(), named colors)
2. CSS custom properties return empty strings when accessed via JavaScript in some contexts
3. Obsidian's theme system uses CSS variables that aren't easily accessible to Canvas

**Current Solution**: Hardcoded hex colors that work reliably
```javascript
// ✅ WORKING APPROACH
if (node.isCenter) {
    fillColor = '#4F8EDB'; // Blue - always works
} else {
    switch (node.level) {
        case -4: fillColor = '#7B9FA3'; break; // Gray-blue
        case -3: fillColor = '#6B9BD1'; break; // Light blue
        // ... etc
    }
}
```

### 🔄 Future Improvements
- **Simple Theme Detection**: Use `document.body.classList.contains('theme-dark')` for basic dark/light switching
- **Limited Color Adaptation**: Two color palettes (dark/light) with hardcoded hex values
- **CSS-Canvas Bridge**: Create hidden DOM elements to compute colors, then transfer to Canvas

## Core Architecture

### Main Classes

1. **ZettelkastenBranchTracker** (main.js:11-809)
   - Main plugin class extending Obsidian's Plugin
   - Handles plugin lifecycle, settings, and navigation commands
   - Contains Zettelkasten ID parsing logic

2. **ZettelkastenBranchView** (main.js:811-1693)
   - ItemView subclass for the graph visualization
   - Canvas-based rendering with interactive controls
   - Handles mouse events, animations, and UI updates

3. **ZettelkastenSettingTab** (main.js:1695-1753)
   - Plugin settings interface
   - Configures default depth, branches, and spacing

### Key Methods

#### ID Parsing & Hierarchy
- `parseZettelId()` (main.js:110) - Extracts Zettelkasten ID from filename
- `findParentId()` (main.js:115) - Determines parent ID based on notation patterns
- `buildZettelNetwork()` (main.js:145) - Builds complete node/edge network
- `compareZettelIds()` (main.js:628) - Sorts IDs alphanumerically

#### Network Building
- `addParentTier()` (main.js:358) - Adds parent and sibling nodes
- `addGrandparentTier()` (main.js:281) - Adds grandparent and aunt/uncle nodes
- `addCurrentNoteTier()` (main.js:424) - Adds current note and linear continuations
- `addChildrenTier()` (main.js:453) - Adds child nodes with dot notation

#### Navigation
- `navigateToSibling()` (main.js:648) - Navigate between siblings
- `navigateToParent()` (main.js:703) - Navigate to parent note
- `navigateToFirstChild()` (main.js:732) - Navigate to first child
- `navigateToContinuation()` (main.js:764) - Navigate linear sequences

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

## UI Components & CSS Classes

### CSS Architecture (styles.css)
All UI styling moved to external CSS for theme compatibility:

```css
/* Control Sections */
.zettelkasten-controls-section       /* Main controls container */
.zettelkasten-controls-header        /* Collapsible header */
.zettelkasten-toggle-icon            /* Collapse/expand icon */
.zettelkasten-controls-container     /* Controls content area */

/* Slider Controls */
.zettelkasten-sliders-section        /* Sliders container */
.zettelkasten-control-row           /* Individual control rows */
.zettelkasten-control-label         /* Control labels */
.zettelkasten-slider                /* Range input styling */
.zettelkasten-value-label           /* Value displays */

/* Checkboxes */
.zettelkasten-checkbox-section      /* Checkbox container */
.zettelkasten-checkbox-control      /* Individual checkbox wrapper */
.zettelkasten-checkbox              /* Checkbox styling */
.zettelkasten-checkbox-label        /* Checkbox labels */

/* Canvas */
.zettelkasten-canvas-container      /* Canvas wrapper */
.zettelkasten-canvas                /* Canvas element */
```

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

### Default Settings (main.js:4-9)
```javascript
const DEFAULT_SETTINGS = {
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
6. **Theme compatible**: CSS classes use Obsidian's design tokens

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
1. Enable Developer Console in Obsidian
2. Check browser console for any errors
3. Test with various Zettelkasten ID formats

### Common Issues
- **ID parsing**: Check regex patterns in `parseZettelId()` and `findParentId()`
- **Rendering**: Canvas context issues, check `resizeCanvas()` method
- **Navigation**: File not found errors in navigation methods
- **Performance**: Animation loop efficiency, check `needsRender` flag usage
- **Colors**: Canvas fillStyle must use actual color values, not CSS variables

### Canvas Color Constraints
⚠️ **IMPORTANT**: Canvas API limitations for theme integration
```javascript
// ❌ NEVER DO THIS - Canvas doesn't support CSS variables
ctx.fillStyle = 'var(--accent-color)';
ctx.fillStyle = getComputedStyle(el).getPropertyValue('--accent-color');

// ✅ ALWAYS USE ACTUAL COLOR VALUES
ctx.fillStyle = '#4F8EDB';           // Hex colors
ctx.fillStyle = 'rgb(79, 142, 219)'; // RGB colors
ctx.fillStyle = 'blue';              // Named colors
```

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
- Ribbon icon: Opens branch tracker in right pane (`signpost-big` icon)
- Settings tab: Configure default behaviors
- Interactive canvas: Mouse-based navigation and visualization

## Lessons Learned

1. **Canvas vs CSS**: Canvas 2D API and CSS live in separate worlds
2. **Theme Integration**: Limited options for dynamic theming with Canvas
3. **Obsidian CSS**: Custom properties work great for DOM elements, not Canvas
4. **Keep It Simple**: Hardcoded colors are more reliable than complex theme systems
5. **CSS Classes**: External stylesheets much better than inline styles for theme compatibility

This plugin demonstrates sophisticated graph visualization techniques while maintaining good performance and user experience within the Obsidian ecosystem, with important lessons about Canvas API limitations.