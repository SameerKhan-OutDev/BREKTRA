# Foundation status

The first milestone is a runnable local workspace with real integration adapters and a simulated outbound execution path.

## Delivered

- Six connected screens: dashboard, campaigns, leads, review queue, activity/jobs, settings.
- React frontend and Node API served from a single loopback port.
- Sample campaign flow and explicit demo-only outbound simulations.
- Google Sheets source preview/import and control persistence adapter.
- Ollama structured draft generation adapter and health checks.
- Queue eligibility, opt-outs, budgets, deduplication, intent recording, failure pause, and restart uncertainty handling.

## Next build sequence

1. Validate real Sheets credentials, source mapping, persistence, and restart recovery against a test spreadsheet.
2. Validate Ollama quality/latency on representative supplied facts; record model/prompt versions.
3. Prove local LinkedIn session reuse, profile reads, relationship checks, and outcome verification behind the isolated adapter.
4. Add mapped status writeback to source CRM tabs with stable row lookup and reconciliation.
5. Add explicitly reviewed live action experiments only after the adapter can verify outcomes; retain uncertain states instead of retrying blindly.
6. Add acceptance/reply checks, automatic follow-up stops, session-expiry handling, and account controls.
7. Strengthen schema migrations, incremental control writes, single-process locking, and workspace-size benchmarks before scaling.
8. Expand templates, reporting, message variants, prompt versions, and multiple active accounts based on measurements.

## Validation limits

The production build and 22 automated checks pass. The browser walkthrough verified campaign creation/start, queue processing, draft editing/approval, and recorded simulated delivery. The narrow local preview was visually checked. Test-created demo state was cleared by restarting the server.

A portable Windows x64 ZIP includes the app, its Node runtime, double-click start/stop launchers, and software license notices. Startup, repeat-start reuse, stopping, and standalone operation from an extracted folder outside the repository were verified. The archive was checked to exclude credentials, `.env`, sessions, and runtime logs.

Automated tests use demo data and mocked persistence failures. Live Google credentials, real spreadsheet mutation, Ollama inference, and LinkedIn browser actions require separate integration validation. No LinkedIn message or invitation is sent by this codebase.
