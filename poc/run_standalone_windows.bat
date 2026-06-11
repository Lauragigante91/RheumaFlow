@echo off
REM run_standalone_windows.bat -- POC raccordo LLM (standalone, Python puro)
REM
REM Uso (dalla cartella poc\ o da qualsiasi directory):
REM   .\run_standalone_windows.bat                        -- baseline parser + LLM 3B vs 7B
REM   .\run_standalone_windows.bat --no-llm               -- solo baseline parser (no Ollama)
REM   .\run_standalone_windows.bat qwen2.5:3b             -- solo 3B
REM   .\run_standalone_windows.bat qwen2.5:3b qwen2.5:7b  -- 3B vs 7B
REM   .\run_standalone_windows.bat qwen2.5:3b --tc TC01,TC06 --verbose
REM
REM Requisiti: Python 3.8+  (NON serve Node.js)
REM Vedere: LOCAL_SETUP.md

setlocal

REM Cartella dove risiede questo script (sempre corretta indipendentemente da dove si lancia)
set "HERE=%~dp0"

REM Salva argomenti originali prima di shift (%* non e' modificato da shift, ma lo salviamo
REM esplicitamente per chiarezza)
set "ORIG_ARGS=%*"
set "NO_LLM=0"

REM --- Scansione rapida per rilevare --no-llm ------------------------------------
:pre_parse
if "%~1"=="" goto pre_parse_end
if /I "%~1"=="--no-llm" set "NO_LLM=1"
shift
goto pre_parse
:pre_parse_end

echo.
echo ============================================================
echo   RheumaFlow -- POC raccordo LLM  (standalone, no Node.js)
echo ============================================================
echo.

REM --- 1. Verifica Python --------------------------------------------------------
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRORE] Python non trovato nel PATH.
    echo          Scarica: https://www.python.org/downloads/
    echo          Attiva "Add Python to PATH" durante l'installazione.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%V in ('python --version 2^>^&1') do echo [OK] %%V

REM --- 2. Verifica Ollama (solo se LLM e' richiesto) ----------------------------
if "%NO_LLM%"=="1" goto skip_ollama_check

echo [VERIFICA] Ollama...
curl -sf http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo [ERRORE] Ollama non risponde su localhost:11434
    echo          Apri un terminale separato e lancia: ollama serve
    echo          Oppure lancia con --no-llm per il solo benchmark parser.
    echo.
    pause
    exit /b 1
)
echo [OK] Ollama attivo

:skip_ollama_check

REM --- 3. Cartella output --------------------------------------------------------
if not exist "%HERE%results" mkdir "%HERE%results"

REM --- 4. Avvio ------------------------------------------------------------------
echo.
echo [RUN] python "%HERE%raccordo_llm_standalone.py" %ORIG_ARGS%
echo.

python "%HERE%raccordo_llm_standalone.py" %ORIG_ARGS%
set "EC=%ERRORLEVEL%"

echo.
if "%EC%"=="0" (
    echo [OK] Completato. Risultati in: %HERE%results\
) else (
    echo [ERRORE] Script terminato con codice: %EC%
    echo          Controlla l'output sopra per i dettagli.
)
echo.
pause
endlocal
