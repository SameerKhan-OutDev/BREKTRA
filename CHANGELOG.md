# BREKTRA version history

Current release: **0.4.0** (major 0 · update 4 · patch 0).

Numbering uses `MAJOR.UPDATE.PATCH`. New working functionality increments UPDATE and resets PATCH; fixes, refinements, packaging, and documentation-only releases increment PATCH. Breaking releases or a deliberately validated stable milestone increment MAJOR. Major 0 is pre-release. See [working notes](docs/WORKING_NOTES.md) for the standing release rule.

## 0.4.0 — 27 October 2026

- Replaces local environment/terminal setup instructions with a guided Settings flow: key file, spreadsheet URL, read-only check and one-use connection confirmation.
- Saves setup encrypted and activates the real Sheets workspace immediately, without copying demo data or requiring a restart. Keeps target work paused, preserves uncertain intents and rejects stale requests.
- Adds installed-Ollama start, supported-model downloads with progress/cancel/retry, and installed-model selection. Google permissions/sharing and initial Ollama installation remain user actions; hosted/authenticated teams keep operator-managed configuration.
- Adds local setup documentation, meaningful mocked-provider/HTTP/encryption coverage and fresh-package setup checks. Live-provider and visual-validation limits remain explicit.

## 0.3.0 — 27 October 2026

First company-ownership preparation milestone for the twelve-shard roadmap; full multi-company operation remains unavailable.

- Adds Settings preview/apply for assigning all legacy records to one company, with backup acknowledgement, complete-state fingerprint checks and in-flight-work blockers.
- Adds company/membership/migration tables, preserved historical state, paused dispatch, immutable ownership, cross-reference checks and recoverable atomic saves. Scoped records use schema v2; app and schema versions remain separate.
- Adds tested future company-role contracts. Current workspace permissions remain in effect; the runtime blocks second/archived companies until API/worker isolation is implemented.
- Adds migration/recovery documentation and new automated coverage, bundled with fresh Windows/server distributions. Live-provider validation and browser visual verification retain their documented limits.

## 0.2.0 — 26 October 2026

Establish the first consistently numbered release of the existing outreach expansion. This is update 2, patch 0; it does not imply that live integration validation has been completed.

- Includes the existing campaign sequences, Gmail transport, inbox, sourced company enrichment, hosted team controls, persistence/recovery foundation, and opt-in AI example collection documented in ABOUT_BREKTRA.md and IMPLEMENTATION_STATUS.md.
- Adds one package-derived release number in the UI and health API, generated VERSION.txt in both distribution packages, consistent current-release document labels, and a build-time version consistency check.
- Includes the ABOUT_BREKTRA overview and version history in both distributions.
- Live LinkedIn remains unavailable. Real Gmail/Sheets/Ollama and external hosting validation retain their documented limits.

## Before consistent numbering

The package and health API previously identified the app as 0.1.0. Earlier work was recorded by date in docs/IMPLEMENTATION_STATUS.md without separate release numbers. Historical entries remain unchanged; no patch history has been invented.
