# AltHistoryMap · style — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The tokens and the shared styles every component stylesheet reads. **Input:** nothing; it is read by the other stylesheets and the renderer. **Output:** custom properties, the page chassis and the button styles. **Essential functions:** `tokens.css`, `page.css` and `buttons.css`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── tokens.css
├── page.css
├── buttons.css
└── favicon.svg
```

## Cross-module behaviour

**Custom properties.** Every component stylesheet reads `tokens.css` through `var(--…)` and writes no literal colour, size or duration of its own. The renderer reads its colours from the same tokens, through `theme` in `render.js`. A stylesheet that stops reading a token it needs breaks silently, so `test_guide` checks each stylesheet is linked from `index.html` and reads a token.

**Interface.** None: no other module imports from this module.

**Uses.** No other module.
