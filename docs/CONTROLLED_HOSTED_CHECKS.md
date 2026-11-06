# Two remaining hosted checks

**Neither test has executed.** The normal Capela API key can run research, but it cannot create/manage the separate Otari test settings required here. No dedicated test keys/policies or administrative access are configured locally. The readiness commands returned `blocked`, zero requests; the spending ledger is unchanged. See [controlled-check-readiness.json](../evaluation/controlled-check-readiness.json).

In plain terms, we need:

1. A separate test route whose first model is made to fail before replying, so Otari demonstrably switches to its backup.
2. A separate test key with a small finite dollar ceiling that rejects one priced request before execution. We must not drain the account or lower/change the working production key's limit.

Primary contracts were inspected November 6 at upstream [`bc43068`](https://github.com/mozilla-ai/otari/tree/bc43068f7a06470f65a812b8f0d1fd9a335b87ec): [routing](https://github.com/mozilla-ai/otari/blob/bc43068f7a06470f65a812b8f0d1fd9a335b87ec/docs/routing.md#in-the-dashboard), [budget holds/refusals](https://github.com/mozilla-ai/otari/blob/bc43068f7a06470f65a812b8f0d1fd9a335b87ec/docs/budgets.md#reservations-are-taken-up-front). A configured fallback alone does not prove recovery. An application cap or insufficient account funds is not a hosted monetary-ceiling denial.

## Owner/operator dashboard setup

Use isolated test configuration; leave `capela-extraction`, `capela-review`, their production credentials and working ceilings unchanged.

- **Routing → Create policy → Fallback**: create a test-only policy, choose a primary and a distinct working backup under **If unavailable, use**. The operator must arrange a controlled transient primary failure before response bytes are sent. Do not use a guessed nonexistent model or assume that disabling a provider/using a bad credential produces the required failure. If the hosted dashboard does not expose failure injection, ask the Otari operator for an isolated test policy. Retain its configuration revision and actual attempted-model trace. The backup must support Capela's structured extraction schema.
- **Organization → Spend & budgets**: prepare a separate finite dollar budget and bind it to a dedicated test key/scope. Upstream also documents assigning a budget directly to a key under API keys. The key must be non-exempt. With configured pricing, choose a positive ceiling below the documented hold for the single small test request. Confirm the accepted value and request hold in the hosted UI/operator trace; do not guess zero-limit behavior or prices. Keep account funds intact.
- Supply test credentials only through ignored local environment variables `OTARI_ROUTING_TEST_API_KEY` and `OTARI_CEILING_TEST_API_KEY`. Never send keys in chat or put them in the configuration metadata below.

## Concrete local execution

`node scripts/controlled-hosted-checks.cjs routing` and `... ceiling` are single-shot tools. They refuse missing isolated configuration before network access, never use the normal key as a substitute, and never edit hosted settings. Each records at most one $0.01/one-call allocation inside the retained $20 task authorization. Existing costs/reservations/counters remain; repeated execution of the same mode is refused. Unknown costs retain reservations.

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
    "nonExempt": true
  }
}
```

Nonsecret references must be short identifiers, not credential-bearing URLs. The script retains only these whitelisted metadata fields. The routing request hold must fit its $0.01 allocation; the ceiling test limit must be positive and below its verified hold.

```bash
npm run build:api
./node_modules/.bin/dotenv -e .env.local -- node scripts/controlled-hosted-checks.cjs routing
./node_modules/.bin/dotenv -e .env.local -- node scripts/controlled-hosted-checks.cjs ceiling
```

Routing uses the actual fixed source and production passage-selection extraction payload. Success requires an observed `Otari-Fallback: true`, the expected resolved model and valid nonempty hydrated extraction. It remains an isolated controlled role check until connected to an application demonstration; retain the actual dashboard attempted-model trace, not just setup metadata.

The ceiling request is one non-streaming 16-output-token chat, no tools. A qualifying refusal is HTTP 403, `Otari-Error-Code: budget_exceeded`, and recorded `Otari-Budget-Scope`, backed by the finite-dollar configuration. The adapter becomes terminal; a subsequent attempted dispatch is rejected locally before HTTP. Insufficient funds, missing pricing, 429, local allowance exhaustion or a different response do not pass. An unexpected successful call is recorded and stops; never repeat to consume the balance. A denial/uncertain charge is never bypassed or automatically retried.

No additional paid request, account setting change or credit purchase occurred during preparation. Four capabilities retain actual hosted application evidence; these two categories remain unverified until the isolated setup and executions exist.
