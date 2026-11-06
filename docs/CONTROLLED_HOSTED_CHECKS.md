# Hosted routing and budget verification

**Ceiling check completed:** owner created an isolated workspace/key with a $0.01/no-reset all-provider ceiling. One request returned HTTP 403 `budget_exceeded`, scope `workspace`, request `0876a3bb-e3b9-4870-9269-7dc91cfa1234`. Gateway persisted terminal denial and blocked the next dispatch locally. [Actual evidence](../evaluation/hosted-ceiling-verification.json). No inference ran; $0 reported, $0.02 reservation retained. Earlier access/readiness notes below remain historical for this completed experiment. Routing remains pending.

Earlier runtime-access follow-up: the runtime key receives **401** on policy, key, spend-ceiling, automatic-fallback and guardrail management reads; the service-key end-user-budget endpoint returns **403**. Both Bearer and the documented `Otari-Key` management authentication were checked. The owner cannot sign in to the temporary dashboard browser. No credential recovery or stored-session inspection was attempted. See [sanitized access evidence](../evaluation/hosted-capability-access.json).

An owner-supplied dashboard screenshot now confirms `capela-extraction` → DeepInfra 20b and `capela-review` → DeepInfra 120b, both with a shared Bedrock `gpt-oss-safeguard-120b` backup. That safety model is unsuitable for preserving two distinct scientific roles. The screenshot displays 0% automatic fallback for 20b and 120b. It establishes current configuration, without a historical revision or successful recovery trace. The original completed application's actual policy calls/model resolution remain evidence of routing selection.

**Controlled failure and ceiling refusal are optional strong evidence methods, not separately stated competition requirements.** Ordinary routing can be demonstrated by a real application call through a verified policy with observed resolution. Budget use can be demonstrated by a finite, non-exempt binding and real priced application request counted under it. Dashboard settings alone prove neither application use nor recovery/enforcement. Current evidence still cannot establish the runtime key's finite ceiling or successful fallback execution.

**For automated management the access blocker is an authenticated Otari owner/admin context** (normal dashboard session or locally configured management credential). The runtime key cannot grant itself that authority. No paid check or allocation was started during that earlier preparation. The owner subsequently used their existing dashboard to configure the isolated workspace ceiling; the actual enforcement test is recorded above. All retained costs/reservations remain unchanged.

## Prepared configuration

[Unapplied request templates](../evaluation/hosted-capability-preparation.json) use the current hosted OpenAPI `0.39.0+8779d66` and freshly read model offerings. They prepare isolated policies with disjoint model roles:

- Extraction: `deepinfra:openai/gpt-oss-20b` → `ovhcloud:gpt-oss-20b`.
- Review: `deepinfra:openai/gpt-oss-120b` → `ovhcloud:gpt-oss-120b`.

These selectors are actually catalogued hosted offerings. Backup strict-schema behavior has not been tested. Use **Routing → Create policy**, create the two isolated names in the template and select those primary/backup offerings. Do not edit the working policies. The API equivalent is `POST /api/v1/organizations/me/routing-policies` with the recorded body after replacing the workspace placeholder with the actual visible UUID. Creation requires owner/admin access. No template was submitted.

For budgets, first inspect the working runtime key's identity, exemption flag and all applicable finite USD ceilings. Record the binding and counters before/after one explicitly allocated application request. `POST /api/v1/organizations/me/budgets` and `/organizations/me/spend-ceilings` bodies are prepared for a separate $0.01 test-key cap; this proposal is not a local spending allocation or an applied setting. Replace only actual returned IDs. A denial experiment needs a separate verified positive ceiling below one priced request hold; do not reduce the working key's ceiling or deliberately consume its balance.

Actual inference guardrails and per-user budgets were assessed as alternatives: neither has accessible configuration or an executed application event here. A per-user budget requires the documented service-key setup; `/end-user-budgets` refused the current key. Local validation and shared reservations are not substitutes.

## Optional controlled experiments

The ceiling experiment below has now executed once; routing has not. The guarded commands below deliberately demand stronger isolated setup because they are **failure/denial experiments**, not a universal rubric eligibility gate.

Primary contracts were inspected November 6 at upstream [`bc43068`](https://github.com/mozilla-ai/otari/tree/bc43068f7a06470f65a812b8f0d1fd9a335b87ec): [routing](https://github.com/mozilla-ai/otari/blob/bc43068f7a06470f65a812b8f0d1fd9a335b87ec/docs/routing.md#in-the-dashboard), [budget holds/refusals](https://github.com/mozilla-ai/otari/blob/bc43068f7a06470f65a812b8f0d1fd9a335b87ec/docs/budgets.md#reservations-are-taken-up-front). A configured fallback alone does not prove recovery. An application cap or insufficient account funds is not a hosted monetary-ceiling denial.

## Owner/operator dashboard setup

Use isolated test configuration; leave `capela-extraction`, `capela-review`, their production credentials and working ceilings unchanged.

- **Routing → Create policy → Fallback**: create a test-only policy, choose a primary and a distinct working backup under **If unavailable, use**. For this optional recovery experiment, the operator must arrange a controlled primary failure before response bytes are sent. Do not use a guessed nonexistent model or change a production provider credential. The upstream contract permits unavailable/credential-rejected candidates to fall through, but any isolated experiment must record the actual failure and successful backup result. If the hosted dashboard does not expose failure injection, ask the Otari operator for an isolated test policy. Retain its configuration revision and actual attempted-model trace. The backup must support Capela's structured extraction schema.
- **Organization → Spend & budgets**: prepare a separate finite dollar budget and bind it to a dedicated test key/scope. Upstream also documents assigning a budget directly to a key under API keys. The key must be non-exempt. With configured pricing, choose a positive ceiling below the documented hold for the single small test request. Confirm the accepted value and request hold in the hosted UI/operator trace; do not guess zero-limit behavior or prices. Keep account funds intact.
- Supply test credentials only through ignored local environment variables `OTARI_ROUTING_TEST_API_KEY` and `OTARI_CEILING_TEST_API_KEY`. Never send keys in chat or put them in the configuration metadata below.

## Concrete local execution

`node scripts/controlled-hosted-checks.cjs routing` and `... ceiling` are single-shot tools. They refuse missing isolated configuration before network access, never use the normal key as a substitute, and never edit hosted settings. Routing records one $0.01/one-call allocation; ceiling records one $0.02/one-call allocation inside the retained $20 task authorization. Existing costs/reservations/counters remain; repeated execution of the same mode is refused. Unknown costs retain reservations.

After real operator setup, write ignored `.local-evaluation/controlled-test-config.json`. Fields below are a schema example, **not usable settings**; zero holds intentionally block dispatch until replaced by verified positive micro-USD amounts:

```json
{
  "routing": {
    "isolated": true,
    "policy": "OPERATOR_SUPPLIED_TEST_POLICY",
    "configurationReference": "OPERATOR_SUPPLIED_REVISION_ID",
    "controlledFailureReference": "OPERATOR_SUPPLIED_FAILURE_SETUP_ID",
    "expectedFallbackModel": "VERIFIED_BACKUP_MODEL_ID",
    "requestHoldMicrousd": 0
  },
  "ceiling": {
    "isolated": true,
    "policy": "VERIFIED_PRICED_TEST_MODEL_OR_POLICY",
    "configurationReference": "OPERATOR_SUPPLIED_KEY_BUDGET_REFERENCE",
    "hostedLimitMicrousd": 0,
    "requestHoldMicrousd": 0,
    "nonExempt": true,
    "maxOutputTokens": 4096
  }
}
```

Nonsecret references must be short identifiers, not credential-bearing URLs. The script retains only these whitelisted metadata fields. The routing request hold must fit its $0.01 allocation. Ceiling requires a positive hosted limit below a verified hold of at most $0.02, and 16–4,096 maximum output tokens. A $0.01 hosted ceiling and $0.01 application allocation cannot satisfy this experiment; do not shrink the hosted cap or silently enlarge any existing allocation. The actual separately recorded ceiling allocation is $0.02.

```bash
npm run build:api
./node_modules/.bin/dotenv -e .env.local -- node scripts/controlled-hosted-checks.cjs routing
./node_modules/.bin/dotenv -e .env.local -- node scripts/controlled-hosted-checks.cjs ceiling
```

Routing uses the actual fixed source and production passage-selection extraction payload. Success requires an observed `Otari-Fallback: true`, the expected resolved model and valid nonempty hydrated extraction. It remains an isolated controlled role check until connected to an application demonstration; retain the actual dashboard attempted-model trace, not just setup metadata.

The ceiling request is one non-streaming chat, no tools, with an explicitly configured maximum of 16–4,096 output tokens. The actual check used 4,096 at the priced Qwen offering, so its output hold exceeded $0.01 before any generation. A qualifying refusal is HTTP 403, `Otari-Error-Code: budget_exceeded`, and recorded `Otari-Budget-Scope`, backed by the finite-dollar configuration. The adapter becomes terminal; a subsequent attempted dispatch is rejected locally before HTTP. Insufficient funds, missing pricing, 429, local allowance exhaustion or a different response do not pass. An unexpected successful call is recorded and stops; never repeat to consume the balance. A denial/uncertain charge is never bypassed or automatically retried.

No paid request or account setting change occurred during the earlier preparation. The later owner-created isolated setup and single actual denial are recorded at the top. Four capabilities retain actual hosted application evidence; finite runtime budget binding and actual fallback recovery remain unverified. Controlled experiments are optional; application routing selection already has execution evidence.
