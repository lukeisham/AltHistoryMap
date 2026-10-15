@echo off
rem Double-click launcher for Windows.
rem Starts the read-only server, which opens the app in your browser.
rem Close this window, or press Ctrl-C, to stop it.
cd /d "%~dp0"
where py >nul 2>nul && (py -3 serve.py & goto done)
where python >nul 2>nul && (python serve.py & goto done)
echo AltHistoryMap needs Python 3, which was not found.
echo Install it from https://www.python.org/downloads/ and run this again.
:done
pause
