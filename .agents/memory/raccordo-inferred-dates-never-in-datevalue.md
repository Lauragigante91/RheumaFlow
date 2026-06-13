---
name: Inferred dates never in date_value
description: Hard product rule on the raccordo timeline parser — back-computed/estimated dates must stay out of date_value.
---

# Inferred/estimated dates must never be written into `date_value`

Even when a start date is *derivable* (e.g. an explicit duration "per circa un anno" plus a dated stop in the same sentence makes the start year computable as stopYear-1), the parser must NOT put that computed value into `date_value`. Leave the event undated.

**Why:** The user (clinician) rejected back-inference of dates into `date_value` because it blurs the line between observed and reconstructed data, and it contradicted an existing guard test. The parser's invariant is "nessun anno inventato" — a date in `date_value` must be one the text states, not one the parser reasoned out. An estimated start, if ever wanted, must live in a SEPARATE explicit field (proposed name `approx_inferred_date`) as its own feature, never inside `date_value`.

**How to apply:** If asked to "infer"/"back-calculate"/"estimate" a start/stop/onset date, do not modify `date_value`. Keep the event undated (or propose a dedicated approx field). The guard test `RACC-START-NOSTOPDATE-1` in `parser_regression.js` protects this: MTX "assunto per circa un anno poi sospeso a gennaio 2022" must yield a dated stop (2022) and an UNDATED start. Do not "fix" that test to assert a computed start year.

**Related:** the stop `reason` may still fall back to a no-digit parenthetical "(motivo)" after the stop keyword (helper `extractParenReason`) — extracting a stated reason is fine; inventing a date is not.
