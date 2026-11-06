# Build status — November 6, 2026

Internal development note; unfinished evaluation work is retained here for continuity and is not part of the submission narrative or a rubric requirement.

Started clean on `main` at `d9cc2501f44f140097b13d62f037b5b2295ad2a2`; dedicated local branch `feat/otari-completion-verification`. First Otari integration commit: `9085c3f30003e5edab5e6dc05674052831f38c48`. No push, deployment, account change, submission, purchase or email in this follow-up.

Prioritized checklist:

- [x] Reconcile code, environment presence, task ledger and persisted investigations without paid replay.
- [x] Reconcile owner-confirmed $20 total allowance; retain prior reservations and allocate one $0.25 / five-call qualifying attempt.
- [x] Implement bounded durable hosted review batches and production-compatible paired-evaluation input; regression-test conservative decisions.
- [x] Attempt a qualifying investigation through the actual signed-in Node 24 Next/Nest app. **Stopped at remote MCP discovery, not completed.**
- [x] Diagnose the precise boundary; direct authenticated remote initialization timed out and hosted discovery remained 502. No paid replay.
- [x] Add durable validated search checkpoints and retain original retry call limits; offline verification only.
- [ ] Complete a meaningful all-Otari investigation, inspect review/passages and capture/review its export. Blocked on remote MCP availability.
- [ ] Controlled hosted routing recovery / finite monetary ceiling refusal. Blocked on dedicated owner/operator test configuration.
- [ ] Optional internal evaluation: human-score paired held-out outputs. Labels remain provisional; this is not a separately scored rubric category.
- [x] Rewrite README around current architecture; preserve original provider details separately and prepare factual participant handoff.

## Actual state

The baseline already contained substantial Otari integration, explicit `otari_web_search`, native strict role schemas, immutable UTF-16/hash provenance, conservative decisions, sandbox/local agreement, authenticated MCP, owner-scoped Mongo leases and legacy UI. Older documents incorrectly said search was unimplemented or still blocked by missing configuration.

Read-only inspection of the configured investigation database found three research records:

- November 3: completed with observed `openai/gpt-oss-20b` extraction and `openai/gpt-oss-120b` review. Actual hosted search/MCP/audit events; 0 accepted, 3 unresolved, 2 rejected candidates. This empty publication result is not selected as the meaningful demonstration.
- November 5: two completed **hybrid** dossiers using direct `gemini-3.8-flash` after hosted review HTTP 504. Newest: 8 accepted / 2 rejected candidates. Neither proves two open-weight roles through hosted Otari.

November 6 signed-in local attempt: authoritative curcumin identity, hosted search HTTP 200, then two bounded free MCP discoveries HTTP 502. Search request `30aa8bd5-b97d-4dd1-bc09-adfb6c87f673`; reported cost **$0.057036**; 1/5 paid dispatches, no unknown reservation, no extraction/review/audit. Saved partial record reopens; no completed dossier/export. Direct authenticated MCP initialization timed out after 30 seconds, and another free hosted discovery returned 502. Remote endpoint: `https://capela-zix9.onrender.com/research-mcp`. Precise registration/auth/server cause is not established. No source URLs were retained in this older-format failed run; they were not invented retrospectively.

The owner reconfirmed **$20 total** in this conversation. Conservative reconciliation summed the task ledger and each application record's cumulative reported/reserved amounts: **$1.577700** before this attempt, potentially double-counting overlaps. After the new search: **$1.634736** conservative exposure, leaving **$18.365264** under the total. This is not an account balance or a promise to spend the remainder. The original task ledger remains 21/21; the separately recorded one-attempt allocation settled failed with $0.192964 unused. No ledger/call counter was reset and no additional attempt is active.

Credentials for Otari, role policies, remote MCP token and Privy are locally present. The optional Vertex fallback is locally configured but was explicitly excluded from this attempt. Runtime management reads were historically 401; no administrative credentials, controlled-fallback policy or denial-test key were supplied. An environment value does not prove a hosted ceiling.

## Fixes and verification limits

Hosted review now handles at most two claims per call, persists each checked batch and reuses retained hosted reviews after an explicit retry. All observed extraction/review batches must preserve distinct identities. Canonical source selection reserves metadata, extraction, review and audit calls under both money/call limits. New validated search checkpoints survive MCP failure; explicit retries reuse their canonical URLs and reject molecule-query mismatch. Retry retains the original dispatch ceiling. New snapshots/fields are additive and legacy schemas remain readable.

The paired evaluator shares the production extraction payload/passage index, current prompts, strict schema, low reasoning and 2,000-token bounds. Mechanical evaluation also checks source hashes and records prompt hashes; it does not grade entailment. Final offline verification at `389e863fa8ac82081b952b463c74800a95ce94f3`: 91 unit/adapter, 4 integration, 7 synthetic browser tests; format, lint, typecheck and production build pass under Node 24.22.2. Mechanical evaluation passes 10/10 hashes and 30/30 references/passages with 0/30 human-reviewed labels. See TEST_EVIDENCE for gate scope and EVALUATION for denominators.

Local actual Next/Nest ran under Node **24.22.2**, isolated MongoDB port 27944, web 3016/API 4016, ordinary participant Privy login. Production/deployed web and API commit identities remain **unknown**; no deployment version is inferred from current local code. The live attempt used starting commit plus uncommitted batching/dispatch-limit changes; an exact pre-dispatch working-tree hash was not captured. Later discovery-checkpoint fixes were not replayed live.

**Six-capability target demonstrated: no.** Four categories have some historical hosted execution evidence; routing recovery and actual finite-ceiling denial remain unverified. A meaningful current complete qualifying dossier, public read-only sample and export remain blocked. Optional review-improvement measurement remains in the internal evaluation backlog. Submission readiness is withheld.
