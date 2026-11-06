# Build status — November 6, 2026

Internal development note; unfinished evaluation work is retained here for continuity and is not part of the submission narrative or a rubric requirement.

## Passage-reference contract follow-up

Continued at clean `07cfcdbbca490775fddd1104f439276450093c49`; implementation committed as `5d52208d63af74ac3942dd65e7035cc025dc7123`. New inference contract `passage-selection-v1`, prompts `extraction-v5` / `adversarial-review-v3`. Both roles select IDs from persisted `passage-index-v1` tables; backend hydration constructs spans and reviewer corrections. Source/hash/table/ID checks reject missing, stale, cross-source or altered references without fuzzy matching. Original candidates and historical explicit spans remain unchanged/readable. Fixed remote/local audit and conservative scientific decisions still gate publication.

Offline checks: 102 unit/adapter, 4 isolated integration, 7 fixture browser tests; formatting, lint, typecheck and production build pass on Node 24.22.2. The fixed-source evaluator also checks selected IDs/index hashes. No scientific-accuracy or reviewer-improvement result is inferred.

Preflight: remote health took 52 seconds then returned 200; hosted discovery during that delay returned 502. Direct authenticated initialize/list/publication then passed, and one final free hosted discovery returned 200 (`req_0a2579c30a4e4cb7b9ea0792fdaca9d1`). Both results are retained. No outage cause is asserted without logs. No paid check was sent while preflight was failing.

One $0.20/five-call application allocation completed and settled within the existing $20 total. Actual signed-in Node 24 app, one abstract, Vertex disabled, new isolated database to preserve earlier completed records/cache. Pre-dispatch commit `5d52208` and code manifest `89fc3b7fd447eb1c3c5be74393b9abf6b9b04987555633b0608a958d54c5aa1a` recorded.

**A nonempty hosted-only investigation completed.** Observed extraction `openai/gpt-oss-20b` and independent review `openai/gpt-oss-120b`; two valid passage-ID candidates, two valid reviewer selections, two literature-reported findings, no fabricated correction. Source PMID 32141677 is a review abstract; no direct experiment or human efficacy is established. Fixed hosted audit `75e1065c-5f13-436e-afa0-e4b0701163f6` matched local validation: 2 records / 1 source / 0 invalid references. Canonical snapshot, full index and hash persisted before inference. No historical rejected candidate was rewritten.

Specific support limitation found during assistant inspection: claim 2 adds “a key regulator of inflammation and cell survival”, which its selected passage does not state. The actual model verdict remains accepted in the record; the added clause is explicitly flagged as unsupported by that passage in the sample and evidence artifact. This is a real observed limitation, not a human-scored accuracy measurement. Do not describe the reviewer as universally correct or claim measured improvement.

Actual completed-dossier reopen, source-passage evidence drawer, history and PNG download/visual inspection passed. PNG shows Limited evidence, one study/two claims, zero experimental findings, abstract-only and model-assisted-review limits. Public read-only local HTML/JSON sample excludes account/record identifiers and actions; it preserves the concrete support concern. No external publication/deployment occurred.

New reported cost **$0.057506**, retained unreported tool reservations **$0.020000**, five paid dispatches, no paid replay. Conservative overlap-inclusive cumulative exposure **$1.799451** under the $20 total; unused allocation $0.122494; no new attempt active. All earlier ledgers, reservations, counters, checkpoints and artifacts remain intact.

Evidence: `evaluation/passage-live-verification.json`, sample `apps/web/public/samples/curcumin-2026-11-06.html`. Search, MCP, nonempty sandbox audit and distinct-model roles now have completed-application evidence. **Six-capability target remains undemonstrated**: controlled hosted routing recovery and finite monetary ceiling denial still require dedicated configuration. All earlier blocked/empty outcomes below are historical.

## MCP recovery follow-up

Continued at clean `99053da7a08e3060983931ee4516b6df2a2e59b2` on the same branch. **Direct and hosted MCP are now verified working.** Readiness HTTP 200/Mongo connected, unauthenticated MCP 401, authenticated SDK initialize/tools-list/publication retrieval passed. Hosted discovery `req_8356c737d4054683affabad29e32c93a`; invocation `req_31d55cb46bb4415abf23409e95c03df8`, matching canonical PMID 42505335 and source hash. No remote code, token or configuration change was made. Earlier timeout/502 root cause remains unconfirmed; do not attribute it to cold start or a token mismatch without logs.

The owner attests latest GitHub main is deployed; `git ls-remote` resolves main to `d9cc2501f44f140097b13d62f037b5b2295ad2a2`. This is owner-attested deployment provenance, not runtime-reported metadata. No Render connector/CLI credentials or service logs are available. The MCP controller is unchanged between that commit and current local code. Successful direct and hosted authenticated invocation establishes functional authorization, without revealing or comparing either secret value.

One new allocation was recorded before dispatch: $0.25 maximum across one hosted MCP check and one local application attempt, six paid calls total maximum. The signed-in Node 24 app used current clean commit `99053da`, retained source hashes before inference, excluded Vertex, selected one abstract and capped application work at $0.20/five calls. **It completed an empty dossier, not a meaningful qualifying two-model result.** Search, remote MCP, extraction and sandbox succeeded; two candidates were rejected for shortened quotes with unchanged sentence offsets. No valid candidates remained, so review was correctly not dispatched. The zero-claim remote audit agreed locally. No acceptance rule was weakened and no additional paid retry followed.

Confirmed extraction boundary: source IDs/hashes match, and quotes occur at their supplied start offsets, but `text.slice(start,end) !== quote` because the quoted strings omit text/punctuation covered by their end offsets. Saved original candidates remain rejected. Extraction-v4 now explicitly requires copying complete indexed span objects verbatim; a new synthetic regression preserves rejection of shortened quotes. This prompt fix is offline-only, with no measured live improvement claim.

Actual completed dossier/history/reopen and downloaded PNG inspection passed. Export shows one study, zero claims, insufficient evidence and abstract-only limits. A targeted card change states that no independent review completed when there is no completed review event; the updated actual downloaded PNG was inspected too. The private export contains a case suffix and is not published as a qualifying sample.

New spend: $0.057209 reported plus $0.030000 retained unknown reservations (two MCP calls and sandbox). Conservative overlap-inclusive total exposure is **$1.721945**, leaving **$18.278055** under the $20 total, not an account balance or permission for repeated attempts. Recovery allocation settled `completed_nonqualifying`, with $0.162791 unused. All original task/application budgets, call counters and checkpoints remain; no active retry allocation.

Sanitized evidence: `evaluation/mcp-recovery.json` (code/source hashes, original candidates, exact span failure, actual tool IDs, costs, audit and export hash). **Four categories have hosted execution evidence; routing recovery and finite hosted monetary-ceiling denial remain pending. Six-capability target remains undemonstrated.** A meaningful all-Otari result still needs valid candidates and a distinct observed reviewer; no new public sample is supplied. Remote deployment/configuration repair is not currently indicated by successful checks; read-only Render logs would be needed to explain the earlier outage.

The dated record below describes the earlier attempt and is retained for provenance; its MCP-unavailable state is superseded by this recovery section.

## Earlier November 6 checkpoint

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

Final recovery verification: Node 24.22.2 `npm test` 92/92; focused SDK MCP integration 1/1; format, lint, typecheck and production build pass, with existing dependency warnings. Updated actual PNG inspected. No new paid replay, push, deployment or production change. Next operational step is a separately recorded bounded attempt using extraction-v4, if authorized; controlled routing/ceiling tests still require dedicated configuration. Read-only Render logs are needed only to establish the historical outage cause, not to prove current MCP operation.

Final passage-contract handoff checks: Node 24.22.2 102/102 unit/adapter, 4/4 isolated integration, 7/7 browser fixtures; final format, lint, typecheck and production build pass. Existing dependency warnings remain. Actual completed dossier, source drawer, history/reopen, PNG and read-only sample inspected; credential/owner-ID scans pass. All new spending is settled in the retained ledger, including unreported reservations. No push, deployment, submission, account configuration change or further paid attempt occurred. Remaining owner actions are dedicated controlled routing/monetary-denial configuration and authorization for any deployment/participant recording/submission steps, not a repeat of the already successful passage-contract run.
