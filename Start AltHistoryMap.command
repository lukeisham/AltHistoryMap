#!/bin/bash
# Double-click launcher for macOS (and Linux file managers that run .command files).
# Starts the read-only server, which opens the app in your browser.
# Close this window, or press Ctrl-C, to stop it.

cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  echo "AltHistoryMap needs Python 3, which was not found."
  echo "Install it from https://www.python.org/downloads/ and run this again."
  echo "Press Return to close."
  read -r
  exit 1
fi

python3 serve.py
status=$?
if [ "$status" -ne 0 ]; then
  echo
  echo "The server stopped with an error (above). Press Return to close."
  read -r
fi
exit "$status"
