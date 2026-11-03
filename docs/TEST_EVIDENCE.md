# Verification evidence

Date: 2026-11-03. Baseline `ffab39f117aa4d07cf40417ac75b30919c500583`, clean main; implementation on `feat/mozilla-otari-capela`. Final code version and first integration commit recorded in BUILD_STATUS.

Initial `npm run format:check`: blocked (`prettier` absent). Installed dependencies, then added the MCP SDK and isolated verification tooling. Initial OpenAPI typing and test-lint failures were fixed; they were not counted as passes.

| Command                    | Recorded result                              | Scope                                                                                             |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run format:check`     | passed                                       | repository formatting                                                                             |
| `npm run lint`             | passed after fixing test globals/unused args | static checks                                                                                     |
| `npm run typecheck`        | passed                                       | shared, API, web                                                                                  |
| `npm run build`            | passed; dependency warnings below            | shared, Nest, Next production build                                                               |
| `npm test`                 | 36 passed                                    | network-disabled unit/adapter fixtures                                                            |
| `npm run test:integration` | 2 passed                                     | real isolated Mongo concurrency/owner/fencing/recovery; real SDK HTTP MCP with synthetic upstream |
| `npm run test:browser`     | 4 passed                                     | actual inspection component in separate synthetic browser harness                                 |
| `npm run evaluate`         | 30/30 fixture references and spans valid     | 10 real source records, provisional labels, 12 held-out cases                                     |
| `npm run smoke:otari`      | blocked, exit 2, zero requests               | missing hosted keys/policies/server and finite live cap                                           |

Unit fixtures cover UTF-16/non-BMP/source hash checks, strict IDs/schemas/truncation, negation, context, experimental/computational/review distinctions, no reviewer upgrades, narrow corrections, actual role metadata, denied budgets, unknown cost and save-before-dispatch fencing. Adapter fixtures exercise source-to-eight-section assembly. None are production scientific results.

Real Mongo test uses only a generated temporary database directory and dedicated loopback port 27841, never configured MONGODB_URI. It proves one lease owner, no subsequent provider stage after cancel/delete, stale-run interruption with retained checkpoints and cross-owner denial. Privy code remains unchanged; tests use isolated service identities rather than bypassing production login. Hosted/Privy signed-in end-to-end browser journeys remain blocked by missing local account configuration.

Browser setup: Browser skill read; no browser-control/Node execution tool was exposed in this session, so the standalone isolated Playwright harness was used. The first attempt could not bind a local port inside the sandbox; the authorized local-server rerun passed. This is not proof of hosted MCP or a real correction from a scientific investigation.

Build warnings observed: optional `@farcaster/mini-app-solana` resolution in Privy and viem/ox dynamic dependency. Build exits successfully. npm reports existing/transitive dependency audit findings; no broad forced upgrade was performed. Host runtime is Node 26.4.0 despite declared Node 24; repeat on Node 24 before release.

No paid network call, hosted model output, real denial, fallback trace or sandbox execution was obtained. Submission readiness is withheld.

A concurrent Next build/typecheck rerun encountered transient generated-file TS6053 errors; both were rerun sequentially. The sequential typecheck passed. Do not run those two commands concurrently against the same `.next` directory.
