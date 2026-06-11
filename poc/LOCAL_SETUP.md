# POC raccordo LLM — Esecuzione locale

Guida per eseguire il confronto **parser regex vs LLM locale (Ollama)** su PC personale.  
Replit ha già generato il baseline del parser. Tu porti il codice, Ollama porta i modelli.

---

## Quale versione usare?

| | Versione standard | Versione standalone |
|---|---|---|
| **Script** | `raccordo_llm_poc.py` | `raccordo_llm_standalone.py` |
| **Launcher Windows** | `run_local_windows.bat` | `run_standalone_windows.bat` |
| **Node.js richiesto** | Si (build bundle JS) | **No** |
| **Privilegi di rete** | Ollama locale | Ollama locale |
| **Drug extraction** | Bundle esbuild | Regex Python puro |
| **Parser live** | Si (via Node.js) | No (usa baseline pre-calcolato) |
| **Dipendenze Python** | stdlib | **stdlib soltanto** |
| **Consigliata per** | Macchine sviluppo | PC con privilegi limitati / Windows corporate |

> Su macchine Windows aziendali senza accesso admin o senza Node.js installabile:
> usa la **versione standalone** — richiede solo Python 3.8+ e Ollama.

---

## Prerequisiti

| Componente | Versione minima | Note |
|-----------|----------------|------|
| Python    | 3.8+           | `python3 --version` |
| Node.js   | 18+            | `node --version` |
| npm       | 8+             | incluso con Node |
| Ollama    | 0.1.32+        | vedi sotto |
| RAM libera | 4 GB (3B) / 8 GB (7B) | la RAM occupata da altri processi conta |
| Disco     | 3 GB (3B) / 6 GB (7B) | per i modelli GGUF |

---

## 1. Installazione Ollama

### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### macOS
```bash
brew install ollama
# oppure scarica da https://ollama.com/download
```

### Windows
1. Scarica l'installer da **https://ollama.com/download** (pulsante "Download for Windows")
2. Esegui `OllamaSetup.exe` — installa Ollama e lo aggiunge al PATH automaticamente
3. Al termine apri **Prompt dei comandi** o **PowerShell** e verifica:
   ```
   ollama --version
   ```
4. Ollama si avvia come servizio in background; l'icona appare nella system tray

> **Nota GPU:** Se hai una scheda NVIDIA, Ollama la rileva in automatico.  
> Per AMD su Windows installa prima ROCm 5.7+ da https://rocm.docs.amd.com/

---

## 2. Avvio server Ollama

### Linux / macOS
```bash
ollama serve
# lascia il terminale aperto, oppure esegui in background:
nohup ollama serve &
```

### Windows
L'installer avvia Ollama come servizio automaticamente al login.  
Se il server non fosse attivo, aprilo dalla system tray o lancia:
```
ollama serve
```
in una finestra di **Prompt dei comandi separata** (lasciala aperta).

Verifica che risponda (tutti i sistemi):
```
curl http://localhost:11434/api/tags
```
Deve restituire `{"models":[...]}`.

---

## 3. Pull dei modelli

```
# Modello 3B — ~2 GB — consigliato per iniziare
ollama pull qwen2.5:3b

# Modello 7B — ~4.7 GB — confronto principale
ollama pull qwen2.5:7b

# Alternativa quantizzata leggera (se RAM < 8 GB)
ollama pull qwen2.5:7b-instruct-q2_K
```

Verifica:
```
ollama list
# NAME              ID           SIZE    MODIFIED
# qwen2.5:3b        ...          1.9 GB  ...
# qwen2.5:7b        ...          4.7 GB  ...
```

---

## 4. Installazione Python e Node.js (Windows)

### Python
1. Scarica da **https://www.python.org/downloads/** (versione 3.10+ consigliata)
2. Nell'installer attiva **"Add Python to PATH"** prima di fare clic su Install
3. Verifica: `python --version`

### Node.js
1. Scarica LTS da **https://nodejs.org/**
2. Installa con le opzioni predefinite (include npm e aggiunge al PATH)
3. Verifica: `node --version`

---

## 5. Struttura file necessaria

Lo zip scaricato da Replit contiene già tutto. Decomprimi mantenendo la struttura:
```
poc/
├── raccordo_llm_poc.py            script principale (richiede Node.js)
├── raccordo_llm_standalone.py     versione Python puro (no Node.js)
├── raccordo_parser_runner.js
├── test_texts.json                15 test case annotati
├── build.sh                       genera bundle (Linux/macOS)
├── run_local.sh                   launcher Linux/macOS (standard)
├── run_local_windows.bat          launcher Windows (standard)
├── run_standalone_windows.bat     launcher Windows (standalone, no Node.js)
├── LOCAL_SETUP.md                 questo file
└── export/                        pacchetto pre-generato da Replit
    ├── parser_baseline.csv
    ├── all_tc_data.json
    ├── tc_data/TC01.json ... TC15.json
    └── parser_baseline/TC01.json ... TC15.json
frontend/src/lib/
├── raccordoParser.js              parser regex (sorgente)
└── drugs.js                       mappa farmaci (usato da entrambe le versioni)
```

> Lo zip include `poc/export/` con il baseline pre-calcolato.
> La versione standalone lo usa direttamente — nessun build necessario.

---

## 6. Esecuzione — modo rapido

### Versione standalone (consigliata su Windows / privilegi limitati)

**Windows** — nessun Node.js richiesto:
```
poc\run_standalone_windows.bat
poc\run_standalone_windows.bat qwen2.5:3b
poc\run_standalone_windows.bat qwen2.5:3b qwen2.5:7b
poc\run_standalone_windows.bat --no-llm
```

**Linux / macOS** — standalone manuale:
```bash
python3 poc/raccordo_llm_standalone.py --compare qwen2.5:3b qwen2.5:7b
python3 poc/raccordo_llm_standalone.py --no-llm
```

Lo script standalone fa:
1. Verifica Python e Ollama (nessun Node.js)
2. Pull dei modelli se mancanti
3. Carica drug data da `drugs.js` via regex Python
4. Carica il baseline parser da `poc/export/parser_baseline/`
5. Esegue il confronto LLM vs baseline su tutti i 15 TC
6. Salva output in `poc\results\TIMESTAMP_standalone\`

---

### Versione standard (Linux/macOS con Node.js)

```bash
bash poc/run_local.sh
```

**Windows** con Node.js installato:
```
poc\run_local_windows.bat
poc\run_local_windows.bat qwen2.5:3b
poc\run_local_windows.bat --no-llm
```

Lo script standard aggiunge il parser live (esecuzione in tempo reale di `raccordoParser.js`)
oltre al confronto LLM vs baseline.

---

## 7. Comandi manuali

### Standalone (Python puro — Linux / macOS / Windows)
```bash
python3 poc/raccordo_llm_standalone.py --no-llm
python3 poc/raccordo_llm_standalone.py --model qwen2.5:3b
python3 poc/raccordo_llm_standalone.py --compare qwen2.5:3b qwen2.5:7b
python3 poc/raccordo_llm_standalone.py --compare qwen2.5:3b qwen2.5:7b --tc real
python3 poc/raccordo_llm_standalone.py --model qwen2.5:3b --tc TC01,TC06 --verbose
python3 poc/raccordo_llm_standalone.py --model qwen2.5:3b --host http://192.168.1.10:11434
```

> Su Windows usa `python` al posto di `python3` e `\` al posto di `/`.

### Standard (richiede Node.js — Linux / macOS)
```bash
bash poc/build.sh
python3 poc/raccordo_llm_poc.py --no-llm
python3 poc/raccordo_llm_poc.py --compare qwen2.5:3b qwen2.5:7b
python3 poc/raccordo_llm_poc.py --compare qwen2.5:3b qwen2.5:7b --tc real
python3 poc/raccordo_llm_poc.py --model qwen2.5:3b --tc TC01,TC06,TC15 --verbose
```

---

## 8. Output e metriche

Lo script stampa per ogni TC:

| Metrica | Significato |
|---------|------------|
| `F1` | Bilanciamento tra precisione e recall (0–1, più alto è meglio) |
| `Pre` | Precisione: eventi corretti / eventi proposti |
| `Rec` | Recall: eventi corretti / eventi attesi |
| `TP/FP/FN` | True pos / False pos / False neg |
| `FalseFarm` | Farmaci citati dall'LLM non presenti nel testo sorgente |
| `Dup` | Duplicati rimossi dalla deduplicazione |
| `RR` | Reason recall: motivi sospensione trovati / attesi |
| `EstCorr` | Tempo di correzione stimato (45s per FP o FN) |
| `conf_spread` | Range dei valori confidence (< 0.2 = overconfident) |

Confronto con baseline parser pre-calcolato:
```
poc\export\parser_baseline.csv
```

---

## 9. Variabili d'ambiente opzionali

### Linux / macOS
```bash
export OLLAMA_HOST=http://192.168.1.10:11434   # Ollama su altra macchina
export OLLAMA_MODELS=/mnt/ssd/ollama_models    # directory modelli custom
```

### Windows (Prompt dei comandi)
```
set OLLAMA_HOST=http://192.168.1.10:11434
set OLLAMA_MODELS=D:\ollama_models
python poc\raccordo_llm_poc.py --model qwen2.5:3b
```

### Windows (PowerShell)
```powershell
$env:OLLAMA_HOST = "http://192.168.1.10:11434"
$env:OLLAMA_MODELS = "D:\ollama_models"
python poc\raccordo_llm_poc.py --model qwen2.5:3b
```

---

## 10. Risoluzione problemi

### Tutti i sistemi

**`Ollama non raggiungibile`**  
Avvia il server con `ollama serve` (in una finestra separata) e riprova.

**`Modello non trovato`**
```
ollama pull qwen2.5:3b
ollama list
```

**Inferenza lenta**  
- 3B: ~5–15s per TC su CPU a 8 core  
- 7B: ~15–45s per TC su CPU  
- Con GPU NVIDIA: 5–10x più veloce  
- Modello più leggero: `ollama pull qwen2.5:7b-instruct-q2_K` (2.8 GB)

---

### Solo Windows

**`'python' non riconosciuto come comando`**  
Reinstalla Python attivando "Add Python to PATH", oppure usa il percorso completo:
```
C:\Users\TuoNome\AppData\Local\Programs\Python\Python311\python.exe poc\raccordo_llm_poc.py --no-llm
```

**`'node' non riconosciuto come comando`**  
Reinstalla Node.js e riavvia il Prompt dei comandi dopo l'installazione.

**`'ollama' non riconosciuto come comando`**  
Assicurati che `OllamaSetup.exe` sia stato eseguito, poi riavvia il Prompt dei comandi.  
In alternativa verifica il PATH: `where ollama`

**`'curl' non disponibile`**  
Su Windows 10/11 curl è incluso di default. Se manca, verifica con:
```
curl.exe http://localhost:11434/api/tags
```
oppure installa da https://curl.se/windows/

**`tee` non riconosciuto (solo Prompt dei comandi vecchi)**  
Il `.bat` usa `tee` tramite PowerShell internamente. Se fallisce, esegui lo script
da **PowerShell** invece del Prompt dei comandi classico:
```powershell
.\poc\run_local_windows.bat
```

**`llama-server binary not found`**  
Questo errore appare solo nell'ambiente Replit cloud, non sul PC locale.
L'installer Windows di Ollama include tutti i binari necessari.

**Errori di codifica caratteri (accenti/UTF-8)**  
Su Windows il Prompt dei comandi usa CP1252 di default. Per forzare UTF-8:
```
chcp 65001
poc\run_local_windows.bat
```
Oppure usa PowerShell, che gestisce UTF-8 correttamente.

---

## 11. Struttura risultati

Dopo l'esecuzione:
```
poc\results\
└── 20260604_143022\
    └── output.txt     output completo con tabelle e diff
poc\export\
├── parser_baseline.csv          baseline pre-calcolato su Replit
├── all_tc_data.json             tutti i 15 TC con expected + parser output
├── tc_data\TC01.json … TC15.json
└── parser_baseline\TC01.json … TC15.json
```

---

## Contesto del progetto

Il parser regex (`raccordoParser.js`) è già in produzione in RheumaFlow.  
Questo POC misura quanto un LLM locale (Qwen2.5) migliora l'estrazione rispetto al regex,
con metriche clinicamente rilevanti (falsi farmaci = rischio paziente, reason recall = informazione persa).

**Obiettivo**: determinare se il delta F1 LLM−parser giustifica la latenza aggiuntiva
e se il 7B offre un miglioramento significativo rispetto al 3B.
