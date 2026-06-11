---
name: Archivio Esami — principio architetturale
description: Separazione tra repository esami, campo visita e referto. Guida il design di Archivio Esami, Import, Parser.
---

## Principio fondante

> **Nessun contenuto viene consegnato al paziente su referto senza validazione esplicita del medico.**

Tutto il design di import, parser, suggerimenti automatici e export discende da questo principio.
Qualsiasi automazione è una *proposta* — il medico ha sempre l'ultima parola prima che il testo diventi referto.

## Regola

**Archivio Esami ≠ Testo della Visita ≠ Referto**

| Layer | Ruolo |
|-------|-------|
| **Archivio Esami** | Sorgente di verità completa. Repository strutturato di tutti gli esami del paziente (lab, strumentali, imaging). |
| **Esami/Imaging della visita** | Campo editoriale controllato dal medico. Il medico seleziona e importa dall'archivio solo ciò che è clinicamente rilevante per quella visita. |
| **Referto** | Esporta **esclusivamente** il testo presente nella visita e approvato dal medico. Non attinge automaticamente all'archivio. |

## Principio chiave

Gli esami dell'Archivio **non compaiono automaticamente** nel referto.
Il medico seleziona deliberatamente quali esami importare nel campo visita ("selezione ragionata").

**Esempio:** Archivio ha PFR 2024, 2025, 2026. Il medico importa 2024 + 2026 per scrivere
"PFR stabile rispetto al 2024." → il referto mostra entrambi perché l'interpretazione dipende dal confronto.

## Pipeline futura per il parser

```
PDF / immagine
  ↓
salvataggio strutturato in Archivio Esami
  ↓
proposta di testo in Esami/Imaging della visita
  ↓
il medico decide cosa mantenere / modificare / eliminare
```

**Why:** Il medico vuole controllo editoriale pieno. L'archivio è un repository, non un template. Il referto è un documento clinico firmato dal medico, non generato automaticamente dall'archivio.

**How to apply:** Qualsiasi feature che aggiunga dati dall'archivio al referto deve passare per una selezione esplicita del medico (UI di import/selezione), mai in automatico.
