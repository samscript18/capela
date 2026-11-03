# Verification evidence

MCP diagnostic follow-up (2026-11-03), based on `71237125ff39690a73da54b437145c7485cd74f2` plus preserved local edits: `npm test` passes 52 offline tests on both Node 26.4.0 and 24.22.2, including a new HTTP-502 discovery fixture checking the specific error, durable saved search, safe metadata, unchanged budget and no replay. API/shared compilation, `npm run format:check`, `npm run lint` and `npm run typecheck` pass. Lint/typecheck used Node 26.4.0; this narrow follow-up did not repeat the full web production build or browser/integration suites. A read-only database inspection establishes search HTTP 200 followed by discovery HTTP 502 for the reported run; no new paid or live MCP request was issued. This verifies diagnosis and local handling, not remote recovery or six-capability completion.

Date: 2026-11-03. Baseline `ffab39f117aa4d07cf40417ac75b30919c500583`, clean main; implementation on `feat/mozilla-otari-capela`. First integration commit: `9085c3f30003e5edab5e6dc05674052831f38c48`. Tested implementation: `95830075f31d625f68e7e4c1320b72173f5260ad`. Final handoff commit changes evidence/docs only.

Initial `npm run format:check`: blocked (`prettier` absent). Installed dependencies, then added the MCP SDK and isolated verification tooling. Initial OpenAPI typing and test-lint failures were fixed; they were not counted as passes.

| Command                    | Recorded result                              | Scope                                                                                             |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run format:check`     | passed                                       | repository formatting                                                                             |
| `npm run lint`             | passed after fixing test globals/unused args | static checks                                                                                     |
| `npm run typecheck`        | passed                                       | shared, API, web                                                                                  |
| `npm run build`            | passed; dependency warnings below            | shared, Nest, Next production build                                                               |
| `npm test`                 | 37 passed                                    | network-disabled unit/adapter fixtures                                                            |
| `npm run test:integration` | 3 passed                                     | real isolated Mongo concurrency/owner/fencing/recovery; real SDK HTTP MCP with synthetic upstream |
| `npm run test:browser`     | 4 passed                                     | actual inspection component in separate synthetic browser harness                                 |
| `npm run evaluate`         | 30/30 fixture references and spans valid     | 10 real source records, provisional labels, 12 held-out cases                                     |
| `npm run smoke:otari`      | blocked, exit 2, zero requests               | missing hosted keys/policies/server and finite live cap                                           |

Unit fixtures cover UTF-16/non-BMP/source hash checks, strict IDs/schemas/truncation, negation, context, experimental/computational/review distinctions, no reviewer upgrades, narrow corrections, actual role metadata, denied budgets, unknown cost and save-before-dispatch fencing. Adapter fixtures exercise source-to-eight-section assembly. None are production scientific results.

Real Mongo test uses only a generated temporary database directory and dedicated loopback port 27841, never configured MONGODB_URI. It also exercises the full new-path runner with mocked Otari HTTP responses, checking source persistence before inference, the completed dossier and terminal budget denial. It proves one lease owner, no subsequent provider stage after cancel/delete, stale-run interruption with retained checkpoints and cross-owner denial. Privy code remains unchanged; tests use isolated service identities rather than bypassing production login. Hosted/Privy signed-in end-to-end browser journeys remain blocked by missing local account configuration.

Browser setup: Browser skill read; no browser-control/Node execution tool was exposed in this session, so the standalone isolated Playwright harness was used. The first attempt could not bind a local port inside the sandbox; the authorized local-server rerun passed. This is not proof of hosted MCP or a real correction from a scientific investigation.

Build warnings observed: optional `@farcaster/mini-app-solana` resolution in Privy and viem/ox dynamic dependency. Build exits successfully. npm reports existing/transitive dependency audit findings; no broad forced upgrade was performed. Host runtime is Node 26.4.0 despite declared Node 24; repeat on Node 24 before release.

No paid network call, hosted model output, real denial, fallback trace or sandbox execution was obtained. Submission readiness is withheld.

A concurrent Next build/typecheck rerun encountered transient generated-file TS6053 errors; both were rerun sequentially. The sequential typecheck passed. Do not run those two commands concurrently against the same `.next` directory.

Final fixture report regenerated at the implementation commit with `node scripts/evaluate.cjs` (same evaluator as `npm run evaluate`, without repeating the API compile). Zero-cap gates for both the catalog smoke and opt-in paired evaluator are exercised by the offline suite. CI configuration uses Node 24 but has not run remotely here.

Environment simplification follow-up (2026-11-03): `npm test` passed 37/37, including API/shared compilation; `npm run lint` passed. Fixture configs no longer supply a budget-reference label. The catalog smoke now requires only the runtime key because it performs no paid execution; the paid evaluator still requires its explicit finite live cap. Tests clear the runtime key for catalog subprocess checks so offline tests cannot send catalog requests from a configured developer shell. This follow-up used the available Node 26 runtime; Node 24 repetition remains outstanding.

## Node 24 and hosted follow-up — 2026-11-03

This section supersedes earlier statements that Node 24/credentials were unavailable or zero hosted calls occurred. Follow-up started clean at `45bba94ba0f9e06813362849c395752bd58a1aba`, branch `feat/otari-live-verification`. Node **24.22.2** was obtained in a temporary npm tool cache; its directory was prepended to PATH for npm and all child processes. `.nvmrc` now declares 24. No Node 24 runtime difference was found.

Commands repeated under that runtime: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, `npm run test:integration`, `npm run test:browser`, `npm run evaluate`. Final unit count is **45**, integration **3**, browser fixture **4**, fixed-source mechanical evaluation **30/30**. Typecheck/build are serial. Existing optional Privy and viem/ox build warnings persist. Synthetic browser checks remain separate from a signed-in Next application journey.

Read-only authenticated catalog/preflight, remote MCP initialize, hosted discovery, public OpenAPI, pricing and per-request settlement reads were performed. Management/trace reads returned 401 with the runtime key. Hosted OpenAPI version: `0.36.0+b0f74a1`.

Paid checks used one persistent shared ledger under an exclusive file lock. Owner increased total authorization from $0.01 to **$0.05**, including earlier charges/unknown reservations. A locally edited $0.10 setting was rejected as an authorization mismatch; execution explicitly retained $0.05. No automatic spending-refusal retry or provider bypass occurred.

Observed failures retained: initial insufficient funds (owner later explicitly requested retry after voucher redemption); malformed model JSON; hosted 504; JSON-object mode returning an unterminated string despite finish_reason=stop. Capela rejected all malformed results. Changes were validated with individually bounded attempts, not a repair loop.

Strict native structural JSON schema succeeded: extraction request `1377ca68-cc51-410c-ae61-ea2f17209c5f` resolved `openai/gpt-oss-20b`, $0.000102, 5938 ms; review `24ff5a0b-7aa6-477f-978d-3857046a65e9` resolved `openai/gpt-oss-120b`, $0.000134, 10673 ms. One real abstract/candidate, 1/1 exact spans/references valid, 1/1 reviews present, 0/1 published claims. Reviewer verdict supported but negation and source-limitations checks false; deterministic decision unresolved. No precision/efficacy claim follows.

Real investigation service attempt resolved curcumin through authoritative APIs, then search failed HTTP 400, request `188a5046-68d1-48dd-9f0f-1d0e13fd8d15`. Participant dashboard identifies **No search tools are configured**. Tools catalog availability was therefore insufficient. Hosted MCP discovery returned 502, then recovered; invocation returned 200, request `req_c76cdb417d724654a836fee1c8483cbe`, matching canonical PMID/hash.

Independent fixed hosted sandbox audit passed: request `91d5f6dc-36e0-4db8-97b3-4eb460159083`, 2416 ms, one mechanically valid real candidate, one source, no invalid IDs; local audit agrees. Its `accepted` field means mechanically valid audit records, not scientifically accepted/published claims. It did not change the unresolved decision. No usage cost returned, so $0.01 reservation remains. Program hash, full sanitized review, source hash, attempt IDs, budget and code hashes are in `evaluation/hosted-verification.json`.

Current total: 10 paid dispatches, $0.000805 reported model cost, $0.037000 retained unknown reservations / 5 calls, $0.012195 conservative headroom under $0.05. Costs may settle later. No actual controlled fallback, finite-ceiling denial, genuine completed dossier, signed-in browser journey, or human-reviewed paired evaluation was obtained. No deployment, new push or production settings change was performed by this follow-up.

Verified local implementation checkpoint: `5b07ebb4fc39acac0c944189d34735d08f1f8a9a` (Node 24 release gates, 45 unit/adapter, 3 integration and 4 fixture browser checks). Subsequent handoff changes contain documentation/results only. A temporary browser was opened on the actual deployed Next application; initial public landing/sign-in controls rendered, participant authentication is pending. No paid application investigation was started.

## Participant-assisted signed-in application checks — 2026-11-03

The participant completed normal Privy login in a temporary standalone Playwright browser on https://capela-three.vercel.app. The actual application loaded seven owner-visible historical investigations; one legacy dossier reopened with all eight navigation sections, explicit abstract-only/legacy verification warnings, and an evidence drawer that opened/closed correctly. Read-only notifications, profile and settings pages rendered. The export button showed pending then returned to idle without a visible error; the harness did not capture the download event/file, so PNG verification is partial. History navigation was revisited after hydration. This was a real deployed application session, not the synthetic browser fixture suite. Its deployed commit was not identified, so it does not validate deployment of the current local code.

Sanitized observations: `evaluation/signed-in-browser.json`. Raw UI text stays ignored/private; account identities, investigation IDs, tokens and full dossiers are excluded. No new investigation, paid call, delete, save, payment or notification-read mutation was triggered. New Otari source/review/partial/error journeys remain blocked by the missing hosted search backend; cross-owner isolation still has isolated integration evidence only. Earlier pending-authentication statements are superseded by this follow-up.
