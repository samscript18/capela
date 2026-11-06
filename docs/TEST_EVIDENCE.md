# Verification evidence — November 6, 2026

Implementation commit **`389e863fa8ac82081b952b463c74800a95ce94f3`**, branch `feat/otari-completion-verification`. Started clean at `d9cc2501f44f140097b13d62f037b5b2295ad2a2`. Node **24.22.2** via the existing temporary npm tool cache, placed first on PATH for npm and child processes. Gates were sequential where compilation/generated files are shared. Documentation/artifact handoff is a subsequent commit; no implementation change is hidden in its results.

| Exact command              | Result                                          | Scope                                                                                                                          |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                 | **91 passed**                                   | Network-disabled unit/adapter/lifecycle regressions; API/shared compilation                                                    |
| `npm run test:integration` | **4 passed**                                    | Isolated real Mongo concurrency/ownership/fencing/retry, SDK HTTP MCP with mocked canonical upstream, runner with mocked Otari |
| `npm run test:browser`     | **7 passed**                                    | Isolated synthetic inspection component, keyboard/mobile/legacy/hybrid diagnostics; not scientific/live hosted results         |
| `npm run evaluate`         | **10/10 hashes, 30/30 references and passages** | Fixed-source hash, reference and exact-passage checks under current normalization/payload/prompts                              |
| `npm run format:check`     | passed                                          | Whole repository Prettier                                                                                                      |
| `npm run lint`             | passed                                          | Whole repository ESLint                                                                                                        |
| `npm run typecheck`        | passed                                          | Shared/API/Next, run before build                                                                                              |
| `npm run build`            | passed                                          | Shared/Nest/Next production build                                                                                              |
| `git diff --check`         | passed before handoff                           | Whitespace/conflict-marker check                                                                                               |

Build exits successfully with existing dependency warnings: viem/ox dynamic dependency resolution and Privy's optional `@farcaster/mini-app-solana` import. No broad dependency upgrade was performed.

New regressions cover bounded hosted review batch durability/resume after later timeout, invalid batch IDs, hidden earlier model-role collapse, production extraction passage indexes/non-BMP offsets, five-dispatch ceiling, durable canonical search reuse/query mismatch/unsafe URL refusal, and refusal to extend an exhausted original retry call limit. Existing scientific/owner/budget/injection/legacy regressions remain intact. Source selection/retry reserve enough calls for the batched reviewer. No scientific check was weakened to obtain success.

Initial sandbox attempts at local Mongo/MCP/browser tests failed because listening sockets were denied. They were rerun with authorized local-network access and passed; the failed attempts are not counted as passes. Temporary actual app servers were stopped before sequential typecheck/build to avoid `.next` generation races. Next dev regenerated `apps/web/CLAUDE.md`; the original `@AGENTS.md` reference was restored, with no new instruction copy retained.

## Actual authenticated application / paid scope

The participant signed in through normal Privy UI in a temporary browser on the **actual** local Next app, Node 24.22.2, web 3016/API 4016 with isolated Mongo 27944. No production auth bypass, copied token or synthetic identity. New investigation submitted through UI; authoritative curcumin resolved; hosted search completed. Remote MCP discovery returned 502 twice within the bounded free retry. Direct authenticated endpoint initialization timed out; another read-only hosted discovery remained 502.

Actual search ID `30aa8bd5-b97d-4dd1-bc09-adfb6c87f673`; cost **$0.057036**, 1/5 paid dispatches, zero unknown cost calls. Saved partial state and retry control are visible; failed run appears in history and reopens. No extraction, review, sandbox or completed dossier/export from this attempt. No paid replay or additional provider substitution. Live fixes after that failure were tested offline only.

The owner reconfirmed $20 total. The preserved task/application ledgers give a conservative overlap-inclusive exposure of $1.634736 after the attempt; the one-attempt allocation settled failed with $0.192964 unused. This is not account balance or additional authorization. Sanitized events, historical classifications, reconciliation, source-code hashes and version limitations are in [current-verification.json](../evaluation/current-verification.json). Existing private ledger files were not committed.

Exact live code-version limitation: the attempt used starting commit plus uncommitted review-batching/call-limit changes, before the later discovery-checkpoint fix. No pre-dispatch working-tree hash manifest was captured. It is **not** evidence of live verification at the final implementation commit. Deployed web/API commits remain unknown; historical signed-in deployed legacy checks are separate in [signed-in-browser.json](../evaluation/signed-in-browser.json).

## Remaining verification

No meaningful current qualifying complete run, real current review/passages inspection, actual cancellation journey, captured/exported-file inspection or public sample. Historical hybrid completions are excluded from two-open-weight role evidence. Historical all-Otari completion had zero published claims. Controlled routing recovery and actual finite monetary-ceiling denial remain blocked on dedicated owner/operator configuration.

These checks verify source integrity and passage mechanics; they do not establish scientific accuracy or demonstrate that review improves correctness. Full submission readiness is not claimed. No push, deployment, production setting change, purchase, email or submission occurred.

Documentation presentation follow-up (November 6): public README and submission/setup narrative now emphasize completed integrity checks, tests and demonstrated hosted behavior. Experimental evaluation backlog remains in internal development/evaluation notes. Actual results, request IDs and machine-readable provenance were preserved; this documentation-only update did not rerun application tests or hosted operations.
