# Build status — November 6, 2026

Internal development note; unfinished evaluation work is retained here for continuity and is not part of the submission narrative or a rubric requirement.

## Isolated hosted monetary ceiling — current checkpoint

Continued from clean `b71230a`; owner created `capela-verification`, configured the directed $0.01/no-reset workspace ceiling across providers, and saved a separate key locally. Existing runtime key/policies are unchanged. New isolated key catalog reads succeed; its ceiling/policy/key management reads still return 401. Owner setup is configuration provenance; the actual refusal below establishes effective enforcement without guessing an exemption flag.

Fixed the controlled test's incompatible bounds: a $0.01 hosted ceiling cannot reject a hold constrained to at most $0.01. The ceiling experiment now allows a separately recorded **$0.02 / one-call application allocation**, while routing remains $0.01/one call. Explicit bounded output and integer hold checks reject invalid/oversized settings. Focused regression passed before dispatch. No application/hosted total cap was increased; allocation stays within the retained owner-authorized $20 total.

One real production-gateway request pinned catalogued `deepinfra:Qwen/Qwen3.5-397B-A17B`, `max_tokens:4096`, with “Reply OK.” Input/output pricing was read with the test key; output reservation alone is **$0.012288**, above the $0.01 ceiling. Otari refused **HTTP 403 / `budget_exceeded` / scope `workspace`**, request **`0876a3bb-e3b9-4870-9269-7dc91cfa1234`**. No inference result/model identity is claimed. Capela persisted terminal denial; a subsequent attempted call was rejected locally with no second HTTP dispatch. No balance draining or provider bypass. The one-shot ledger prevents replay.

**Hosted spending-ceiling enforcement now has genuine isolated application-adapter evidence.** It is not a new authenticated UI investigation or proof about the original runtime key's ceiling. Four categories retain the complete research run; this budget check adds a fifth with substantive execution evidence. Routing selection also has actual policy-call/configuration evidence; successful role-preserving fallback remains unverified, so the full recovery target remains incomplete. Controlled tests are optional rubric evidence methods; judges determine credit for selection/configured fallbacks.

Reported new cost **$0.000000**; no usage settlement returned, so retain **$0.020000 unknown reservation**. Conservative cumulative exposure **$1.819451**, leaving $18.180549 under the task authorization (not account balance or further attempt permission). Original task/application counters, checkpoints, run, publication revision and sample/export remain unchanged. No further paid attempt is active or authorized implicitly.

Evidence: `evaluation/hosted-ceiling-verification.json`, including allocation, exact pre-dispatch source hashes, actual request/scope, catalog prices and no-second-dispatch proof. Single remaining configuration task: create the prepared isolated role-preserving policies in the authenticated dashboard; existing shared safeguard backup is unsuitable. No production settings changed, no push or deployment. Release checks are recorded in TEST_EVIDENCE.

## Routing/budget access follow-up — current checkpoint

Started clean at `12c21a2dfdcec3f8e74aa8faee3ee71289d6d217` on `feat/otari-completion-verification` (contains `6abdac4`). Preserved original hosted output, publication hold, public sample/export and ledger. No historical outage investigation or paid replay.

Current hosted OpenAPI is **0.39.0+8779d66** (public specification retrieved November 6). Runtime management reads with documented `Otari-Key` return 401 for policies, scoped ceilings, key identity, automatic-fallback traffic and inference guardrails. `/end-user-budgets` returns 403; this service-key alternative is unavailable with the current runtime key. No Otari connector was found. A temporary normal-login browser was offered; owner reports sign-in unavailable. No credential recovery or stored-session access.

Owner then supplied a dashboard screenshot showing actual policy primaries (DeepInfra 20b extraction/120b review) and a **shared Bedrock safeguard-120b backup**. This is current configuration evidence, not an executed backup or a policy revision tied retrospectively to the old run. The shared safety model is unsuitable for the two scientific roles. Screenshot traffic reports 0% fallback for the two role models. Actual original application calls establish routing selection; successful fallback recovery and role preservation after fallback remain unverified.

Prepared exact isolated policy bodies using freshly verified hosted catalog offerings: DeepInfra 20b → OVHcloud 20b; DeepInfra 120b → OVHcloud 120b. Prepared finite test budget/ceiling bodies using documented organization endpoints, with explicit real-ID placeholders. **Nothing applied**; no production policy/token/settings changed. See `evaluation/hosted-capability-preparation.json`. Catalog/schema checks do not establish backup output support. The single prerequisite is authenticated owner/admin Otari access; remaining $20 authorization cannot grant management authority.

Gateway now retains each role's requested policy before dispatch alongside observed model/fallback/denial metadata. Invalid credential-like policy names stop before reservation/network. Additive storage compatibility and technical run display preserve legacy events without backfilling aliases. Focused regressions verify routing provenance survives a real adapter denial and never supplies invented resolved models.

Corrected presentation: controlled fault/denial experiments are strong optional evidence methods, not extra organiser requirements. A real routed policy request demonstrates selection; a finite non-exempt binding plus counted real application spend can demonstrate budget use without deliberately exhausting it. Current runtime budget binding is still unverified. Four categories retain complete-application evidence; routing selection additionally has actual calls plus current configuration evidence, with recovery limitations. **Six fully evidenced categories: no.**

New paid calls/cost **zero**; ledger unchanged, conservative cumulative exposure **$1.799451** including retained uncertainty. No new attempt allocation while required hosted configuration is inaccessible. Public sample and original/revision artifacts retain their hashes. `evaluation/hosted-capability-access.json` records sanitized read statuses, catalog metadata and screenshot observations without account identifiers. Release checks are recorded in TEST_EVIDENCE. No push or deployment.

## Publication hold and sample revision — current checkpoint

Continued clean at `b5ac1dcf6f66a38ce4851c0ee0ce6d5b7405635f`; implementation `6abdac4`. Inspected the exact claim-2 finding, selected passage, review and final decision. The reviewer returned `supported`, all five checks true, no revised finding; there was **no failed support verdict ignored by the old policy**. The missed clause survived because the model failed to flag it and later source inspection remained commentary without a publication control.

Added `publication-hold-v1`, bound to exact original run, claim/finding hash, snapshot/hash and review hash, with assessor, timestamp and reason. Publication gates honor such holds; stale bindings fail closed. Known unsupported wording is withheld as unresolved, without pretending the original model returned a rejection or correction. No biology keyword rule is used as general entailment verification.

A separate `publication-revision-v1` local record now has **one published literature-reported finding and one unresolved candidate**. The original private DB record is unchanged by before/after hash; the original committed `evaluation/passage-live-verification.json` is byte-identical to `b5ac1dc`. Original candidate/review values, model events and cost values are preserved. Claim 2 still shows the model's supported verdict, followed by the actual dated assistant-source-inspection hold. No new inference, provider request or hosted audit occurred. Current one-record audit is local; the original two-record hosted audit remains in revision provenance.

Regenerated the public sample from that derived publication record using the backend policy/rebuilder; no manual model-output edit. Normal participant Privy login, current dossier (one evidence card), withheld candidate/provenance, sample and downloaded 1098×1834 PNG were inspected. The PNG says Publication revision, one claim/one candidate withheld, no new inference and local current audit. Unsupported claim 2 is absent from published evidence cards and dossier finding lists.

Tests reproduce the exact recorded combination, prove why old controls accepted it, and show that exact spans cannot override unsupported/uncertain model verdicts, false support checks or an explicit source-bound hold. Also cover original immutability, stale bindings, event/cost preservation and no new model correction. 109 unit/adapter and 4 isolated integration checks pass; format/lint/typecheck/build passed for the implementation. Final handoff checks recorded in TEST_EVIDENCE.

Two remaining hosted categories: prepared single-shot commands and documented plain dashboard steps in CONTROLLED_HOSTED_CHECKS. Readiness for both returns blocked/zero requests; no dedicated test keys/policy/ceiling configuration or admin access available. No normal production policy/key was substituted, no account balance was consumed, no ledger changed. New Otari paid calls/cost: **zero**; conservative prior exposure remains **$1.799451**, with all reservations retained. **All six capabilities are still not demonstrated.** Four retain original hosted application evidence; controlled routing recovery and scoped monetary denial remain blocked on isolated owner/operator setup.

Evidence: `evaluation/publication-revision.json`, `evaluation/controlled-check-readiness.json`. Original run evidence below remains historical, not rewritten. No push/deployment or production setting changes.

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

Final publication-hold handoff: 109/109 unit/adapter, 4/4 integration, 7/7 browser fixtures and format/lint/typecheck/production build pass under Node 24.22.2. Revised actual app/sample/PNG verified (one published finding, one unresolved candidate), original outputs/events/costs intact. New spending remains zero and no reservation was released. The guarded routing/ceiling commands are ready, but actual executions still require the isolated Otari setup described in CONTROLLED_HOSTED_CHECKS. Four hosted categories demonstrated; six-target completion is not claimed. No push/deployment.
