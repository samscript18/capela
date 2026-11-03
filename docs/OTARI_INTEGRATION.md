# Otari integration

Retrieved 2026-11-03. Upstream reference: [`39a2ae847c51eb2ae668bf7f8755a03d5eb7d7c8`](https://github.com/mozilla-ai/otari/tree/39a2ae847c51eb2ae668bf7f8755a03d5eb7d7c8).

Read upstream sections: [tools](https://github.com/mozilla-ai/otari/blob/39a2ae847c51eb2ae668bf7f8755a03d5eb7d7c8/docs/tools.md) (direct search/execution and workspace restrictions), [MCP](https://github.com/mozilla-ai/otari/blob/39a2ae847c51eb2ae668bf7f8755a03d5eb7d7c8/docs/mcp.md) (caller discovery/execution), [routing](https://github.com/mozilla-ai/otari/blob/39a2ae847c51eb2ae668bf7f8755a03d5eb7d7c8/docs/routing.md) (failover and observed headers), [API](https://github.com/mozilla-ai/otari/blob/39a2ae847c51eb2ae668bf7f8755a03d5eb7d7c8/docs/api-reference.md) (request IDs, costs, search, code execution).
Also inspected `access-control.md` (key ceilings and service identities), `models.md` (catalog/model spelling), `traces.md` (trace access/content), `hosted-providers.md` (hosted versus BYO), `guardrails.md` (inference checks), `code-execution-protocol.md` (sandbox transport/policy). All paths are under the pinned commit's `docs/`.

These are upstream contracts, **not evidence that hosted Otari currently exposes them for this workspace**. No configured hosted credentials or finite live-test budget were present. No hosted catalog, role call, tool execution, trace, budget denial, policy or license has been live-verified.

## Implemented wire boundary

Only `OtariGatewayService` sends hackathon inference/tool requests, to fixed `https://otari.ai/api/v1`, bearer runtime key, redirects refused. Calls have timeout/body/output/call bounds; no automatic retries or malformed-output repairs (repair count zero).

| Operation         | Documented contract used                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search            | `POST /search`: query, max_results 15, search_domain_filter, max_tokens_per_page; validated results[].url/title/snippet                                                    |
| MCP discovery     | `GET /mcp/servers/{id}/tools`: server_id, server_revision, tools[].input_schema                                                                                            |
| MCP invocation    | `POST /mcp/execute`: stored server ID, exact tool/arguments, revision, client_execution_id; complete structuredContent validated separately; never automatically replay    |
| Extraction/review | `POST /chat/completions`: configured policy in model, bounded messages/max_tokens, non-streamed; require exactly one choice and finish_reason=stop, strict JSON/Zod output |
| Audit             | `POST /code/execute`: fixed Python code plus JSON-only data, timeout_seconds=10; require return_code=0, empty stderr, strict bounded stdout JSON and local equality        |
| Observation       | Otari-Request-ID, Otari-Provider, Otari-Model, Otari-Fallback; usage.cost_usd six-decimal USD string where actually reported                                               |

Schema/prompt/engine: `otari-evidence-v1`, `extraction-v1`, `adversarial-review-v1`. Role schemas are supplied as prompt data, then enforced locally; native JSON-schema support is not assumed. No model-native tools are enabled for role calls. Resolved model names must differ before any candidate can publish. Routing fallback is entirely hosted policy behavior; only an observed true header is shown as fallback. Attempted model details are not invented.

## Source and MCP contract

The SDK-based `POST /research-mcp` exposes only `publication_abstract({url})`. It uses a separate >=32-character server token, constant-time comparison, a per-process 30/minute request ceiling, strict URL input, bounded canonical Europe PMC MED metadata lookup and redirects refused. It accepts canonical PubMed URLs only; arbitrary URLs, private IPs and tools are unavailable. Publication identity comes from the MED result and matching requested PMID, never references on a page. Text is bounded abstract material; it is not full text. External PubChem/NCBI calls do not earn tool credit.

Configure this as a **remote authenticated HTTP MCP server** in hosted Otari, with only `publication_abstract` allowlisted. A deployed reachable endpoint is required; localhost is only tested locally and does not qualify. This task does not authorize deployment. Discovery checks the input schema and pins the returned server revision. Tool annotations are descriptive, not authorization. The fixed server and allowlist define the research-only authorization.

Snapshots store NFC normalization and CRLF/CR→LF once, preserving other whitespace, punctuation and negation; hashes are SHA-256 over UTF-8. Exact source spans are zero-based UTF-16, end-exclusive. Sources are appended and persisted before inference; no update endpoint or paid retry overwrites them. Original candidates, reviews, rejections and one exact-source correction remain in the owner-scoped run record.

## Audit and spending semantics

The fixed `span-audit-v1` Python program has a recorded program hash. It validates references/content hashes, UTF-16 quote offsets, class distributions and unique source counts. It imports only standard-library JSON/hash routines, uses no files, network or generated executable instructions. JSON strings become data only. Remote output gates dossier publication and must match the local validator. The owner must enforce sandbox network/file/resource restrictions and pin the sandbox image in hosted workspace policy; application code cannot prove those settings.

Application budget amounts are integer USD micro-dollars. Every dispatch persists a conservative reservation and call count before HTTP. Reported costs replace reservations; unknown/unreported costs keep reservations. An estimate underrun stops future spending. This is **not a monetary zero-overshoot guarantee**: hosted settlement, free-model tools and unknown rates have documented exposure. Owner must configure a finite, non-exempt hosted runtime-key ceiling and appropriate priced tools. No environment label can establish hosted enforcement; verify the actual key ceiling and a real denial. 402 or budget denial is terminal; no ceiling increase or direct-provider escape occurs. Failed calls may already have been charged.

Mongo leases use atomic claim, 120-second expiry, 15-second heartbeat and token/expiry/status-fenced writes. A 30-second recovery sweep marks stale runs interrupted, retains durable checkpoints and never replays paid work. Cancellation/deletion revoke the fence and stop future dispatch. An already in-flight request can still cost money. **Selective resume is not implemented**: retries after any paid dispatch are blocked; a separately budgeted new investigation is required. Do not present this as exactly-once execution.

## Minimum owner setup (once, locally; never paste secrets in chat)

1. Use Node 24, MongoDB, existing Privy configuration; copy `.env.example` to ignored `.env.local`.
2. Set a non-exempt server-only hosted Otari runtime key with a finite key ceiling in hosted Otari. No administrative key in the API process.
3. Set finite positive `OTARI_RUN_BUDGET_MICROUSD`. The per-call reservation defaults to 10000 micro-USD; overriding it is optional. Paid evaluation separately requires a finite `OTARI_LIVE_TEST_BUDGET_MICROUSD` (absent defaults to zero).
4. Run `npm run smoke:otari` with the runtime key. Catalog-only discovery needs no role policy, MCP registration or paid-test cap; it performs no inference/tool execution and saves safe catalog fields. Confirm exact hosted endpoint contracts against that workspace's OpenAPI. Stop on unsupported features.
5. Choose two actually available open-weight models, inspect upstream model cards/licenses and structured-output performance, then configure separate extraction/review policies and safe role-preserving fallbacks. No model is preselected or license asserted here.
6. Configure the reachable MCP endpoint and token header, server ID, scientific domain policy, priced search, sandbox policy/image/resource limits and key tool scope. Verify through hosted discovery, not a local SDK call alone.
7. Run a bounded authenticated investigation. Capture sanitized run events and owner-visible traces; verify source/quote/review results. Separately exercise a controlled routing failure and real budget denial within the authorized cap. Do not spend additional funds or raise limits implicitly.
8. Human-review the evaluation pilot and execute paired baseline/two-role runs on its same fixed snapshots before any quality or submission-readiness claim.

## Minimal application environment

The Otari section of `.env.example` contains only `OTARI_API_KEY`, `OTARI_EXTRACTION_POLICY`, `OTARI_REVIEW_POLICY`, `OTARI_MCP_SERVER_ID`, `OTARI_RUN_BUDGET_MICROUSD` and `CAPELA_MCP_TOKEN`. The last is required when serving Capela's own remote MCP endpoint. Runtime credentials remain server-only. The hosted endpoint is fixed in code; Otari is the default provider.

Optional settings belong to the operation that needs them:

- Legacy compatibility only: `RESEARCH_PROVIDER=legacy` plus the legacy provider credentials.
- Reservation tuning only: `OTARI_CALL_RESERVATION_MICROUSD` (default 10000).
- Paid evaluation only: `OTARI_LIVE_TEST_BUDGET_MICROUSD`, `EVAL_SOURCE_ID` and `EVAL_MOLECULE_NAME`, described in EVALUATION. They are not needed to run the application or inspect the catalog.

`OTARI_BASE_URL` and `OTARI_BUDGET_REFERENCE` are no longer consumed. A budget reference never enforced spending; removing that label does not remove the application run cap, hosted denial handling or the requirement to configure an actual finite hosted ceiling. Existing ignored secret files are left untouched.
