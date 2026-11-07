# AltHistoryMap · server — Module guide

For AI agents. The app's purpose and cross-app behaviour are in the app `GUIDE.md`.

## Purpose

Running the app on a Mac, read-only. **Input:** browser GET and HEAD requests. **Output:** the files of `app/`, with a strict Content-Security-Policy. **Essential functions:** `serve.py` and its launcher.

## Contents

1. [Navigation](#navigation)
2. [Cross-module behaviour](#cross-module-behaviour)

## Navigation

```
AltHistoryMap/
├── serve.py
└── Start AltHistoryMap.command
```

## Cross-module behaviour

**Launch and registration.** `serve.py` and its launcher are the app's edge with the Lukeatron files that start them; those rows are in the app `GUIDE.md` under Cross-app behaviour. Nothing in this module is used by or uses another module.

**Interface.** None: no other module imports from this module.

**Uses.** No other module in code.
