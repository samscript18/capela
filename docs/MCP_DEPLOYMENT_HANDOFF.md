# Remote MCP operational handoff — November 6, 2026

**Current state: direct and hosted MCP work. No deployment/configuration repair was required or performed.** The earlier initialization timeout/discovery 502 cannot be attributed to a confirmed root cause without service logs. Do not rotate matching credentials, weaken authentication or deploy speculatively.

Owner-attested deployed commit: `d9cc2501f44f140097b13d62f037b5b2295ad2a2`, the SHA returned by `git ls-remote origin refs/heads/main`. Render logs/CLI/admin connector unavailable; runtime does not expose commit identity. The MCP controller is identical locally and at that commit. Local qualifying attempt used `99053da`, which contains newer research reliability changes; those are not claimed deployed.

Verified sequence and sanitized evidence: `evaluation/mcp-recovery.json`.

- `GET /health` → 200, Mongo connected.
- `POST /research-mcp` without authentication → 401.
- Official SDK Streamable HTTP client with the locally configured bearer credential → initialize, `tools/list`, and `publication_abstract` all succeed. Returned schema, canonical PMID/URL and normalized abstract hash validate.
- Hosted registered server discovery and invocation → 200, same canonical source/hash. This verifies the stored token is functionally accepted; neither token was displayed or returned. Raw stored registration configuration remains unavailable to the runtime key.

If the outage recurs, the owner should inspect the same Render service's deploy events and request/startup logs around the recorded UTC timestamps. Capture deployed commit, successful application startup, MCP route mapping, health response, process restarts and proxy/connection errors. Redact all credentials and account identifiers. Check the existing hosted registration uses `https://capela-zix9.onrender.com/research-mcp`, Streamable HTTP, `publication_abstract` allowlist, and a bearer authorization token matching the server's `CAPELA_MCP_TOKEN`. Compare via successful authenticated initialization, never by printing secrets. A `has_token` field alone does not prove a match. Logs are needed before asserting cold start, crash, network or authentication as the historical cause.

If a future confirmed defect requires deployment, prepare the chosen commit on the authorized public branch and request deployment authorization. Repository-root commands are `npm ci`, `npm run build:api`, then `npm run start:api`, Node 24, existing injected server-only environment, Render's supplied `PORT`, readiness path `/health`. Preserve Mongo/Privy/payment settings and the hosted registration/token unless evidence specifically requires a change. These are exact repository commands, not a claim of having inspected Render's configured commands. Do not deploy the local branch or change production settings under the current authorization.

Before any paid investigation, verify direct initialization/list/publication, then free hosted discovery. Hosted invocation needs a recorded finite allocation; retain its reservation if cost is unreported. Only then use the single allocated application attempt. The earlier MCP-recovery allocation settled nonqualifying. A later separately allocated passage-reference application run completed nonempty; its evidence/accounting are in `evaluation/passage-live-verification.json`. Both allocations are settled and another attempt is not implicitly active.
