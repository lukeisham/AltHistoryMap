# AltHistoryMap · scenarios — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The footer's menu of the bundled scenario maps. **Input:** the bundled scenario list. **Output:** a chosen scenario passed to the actions. **Essential functions:** `bindScenarios` and `orderScenarios`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
├── scenarios.js
└── footer.css
```

## Cross-module behaviour

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `bindScenarios` | main |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| loading | `loadScenarioIndex` |
