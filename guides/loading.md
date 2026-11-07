# AltHistoryMap · loading — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

The only code that calls `fetch`, for the base map and the scenarios. **Input:** relative URLs for the base map, the scenario list and a scenario file. **Output:** the decoded base map, the scenario list and a scenario blob. **Essential functions:** `loadBasemap`, `loadScenarioIndex` and `loadScenarioBlob`.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
app/
└── api.js
```

## Cross-module behaviour

**Interface.** The names other modules import, and who imports them.

| Name | Used by |
|---|---|
| `loadBasemap` | main |
| `loadScenarioBlob` | main, saving |
| `loadScenarioIndex` | scenarios |

**Uses.** The names this module imports, by module.

| Module | Names |
|---|---|
| mapfile | `StreamLimitError`, `collectBounded` |
| model | `N` |
