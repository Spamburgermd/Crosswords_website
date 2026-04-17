@echo off
setlocal

REM Resolve repo root robustly (directory of this script), then switch to it.
pushd "%~dp0" || (
  echo [ERROR] Could not change to script directory "%~dp0"
  exit /b 1
)
set "REPO_ROOT=%CD%"

echo Starting CrosSwords services from %REPO_ROOT%...

REM ---------------- Server ----------------
set "SERVER_DIR=%REPO_ROOT%\crosswords_server"
set "SERVER_VENV=%SERVER_DIR%\.venv\Scripts\activate.bat"
set "SERVER_LOG=%SERVER_DIR%\debug.log"

echo Server dir: "%SERVER_DIR%"
if not exist "%SERVER_DIR%" (
  echo [ERROR] Server directory not found.
  goto :end
)

if exist "%SERVER_VENV%" (
  REM Use call without extra wrapping quotes to avoid double-quote issues in start/cmd.
  set "SERVER_ACT=call \"%SERVER_VENV%\" &"
  echo Using server venv at "%SERVER_VENV%"
) else (
  set "SERVER_ACT="
  echo [WARN] No server virtualenv at "%SERVER_VENV%"; running without activation.
)

type nul > "%SERVER_LOG%"
REM To see live server output in the window again, drop the redirection so uvicorn writes to the console.
REM Log file creation remains (empty) in case you still want to tail it separately.
set "DEBUG_REVEAL_SOLUTIONS=true"
start "CrosSWords Server" /D "%SERVER_DIR%" cmd /k "%SERVER_ACT% python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > debug.log 2>&1"
REM delete rem to create debug log again > debug.log 2>&1
REM ---------------- UI (Streamlit) ----------------
set "UI_DIR=%REPO_ROOT%\crosswords_ui_streamlit"
set "UI_VENV=%UI_DIR%\.venv\Scripts\activate.bat"

echo UI dir: "%UI_DIR%"
if not exist "%UI_DIR%" (
  echo [WARN] UI directory not found; skipping Streamlit launches.
  goto :end
)

if exist "%UI_VENV%" (
  set "UI_ACT=call \"%UI_VENV%\" &"
  echo Using UI venv at "%UI_VENV%"
) else (
  set "UI_ACT="
  echo [WARN] No UI virtualenv at "%UI_VENV%"; running without activation.
)

start "CrosSWords UI (P1)" /D "%UI_DIR%" cmd /k "%UI_ACT% streamlit run client_streamlit_lobby_board_v1.py --server.port 8501"
start "CrosSWords UI (P2)" /D "%UI_DIR%" cmd /k "%UI_ACT% streamlit run client_streamlit_lobby_board_v1.py --server.port 8502"

:end
echo.
echo Launch commands issued. If any window didn’t open, check the messages above.
popd
endlocal
