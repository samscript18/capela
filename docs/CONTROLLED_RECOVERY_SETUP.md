# Controlled recovery: hosted compatibility blocker

## November 10 recheck — supersedes the older schema blocker

Later owner dashboard evidence: the endpoint explicitly displays request prefix `capela-fault-primary:` and **1 of 1 serving**, with the saved input/output rate. Nonetheless, creating the isolated policy with the complete selector rejects the prefix as “neither a configured provider instance nor a known provider implementation.” This rules out the missing-prefix-field hypothesis as an explanation of the current UI state. No further pricing changes or policy retries are indicated; the current validator/configuration discrepancy needs operator inspection. A routing preview and listed automatic order do not prove a saved or executed recovery policy.

The owner also configured an Active Lakera definition and a blocking/fail-closed mandate scoped only to `capela-verification`, and confirmed free quota with no paid overage. One production-adapter injection test was dispatched under a new $0.005/one-call allocation. It returned HTTP 403 without a recognized reason; this remains **inconclusive**, not demonstrated guardrail detection. No retry. See `evaluation/hosted-guardrail-verification.json`; dashboard request detail is needed to distinguish actual violation from an unavailable check or other refusal. The earlier “no configured guardrail” reads below precede this owner configuration.

Read-only hosted inspection now reports **0.42.0+259b65d**, and `OrgProviderKeyCreateRequest` now exposes `slug`. The historical absence of that field is no longer a current advertised-contract blocker. This does not prove the existing endpoint has a slug, pricing or serving enabled: the runtime keys still cannot read organization configuration (401), and the isolated model catalog still exposes only the two previously verified normal policies, not `capela-extraction-recovery-v1`.

The next concrete action is an authenticated owner/admin inspection of the existing isolated endpoint on the updated hosted build: verify its actual prefix, model price/serving state and create the isolated recovery policy once its target is available. Do not repeat rate creation blindly or change working providers/defaults. Operator support is needed if the endpoint still cannot be made available. No recovery allocation or paid request was started on November 10.

The alternative guardrail check returns HTTP 200 with `available:false`, no profiles and reason **“No guardrails service is configured, so its profiles cannot be listed.”** The built-in catalog lists classes, not configured runnable checks; using one requires authorized organization definition/mandate configuration. Those management reads are 401. Per-user-budget reads remain 403 for both available keys; a service key is required. One authenticated Otari owner/admin session is the common access prerequisite for these paths; do not paste credentials into chat.

Sanitized current evidence: [November 10 recheck](../evaluation/hosted-capability-recheck-2026-11-10.json). All requests were read-only; paid requests and configuration changes were zero. The sections below preserve the November 6 observations and operator report as history.

**Stop the custom-prefix setup on the current hosted build.** The upstream instructions used for it are not established by the advertised hosted contract. No further rates, guessed identifiers, default changes or paid requests should be made to force it through.

## Observed hosted mismatch

- Hosted public OpenAPI, reread November 6: **0.39.0+8779d66**. `OrgProviderKeyCreateRequest` has provider, name, api_key, api_base, client_args and zero_data_retention. Neither it nor `OrgProviderKeyPublic` exposes a `slug`/request-prefix field.
- Pinned upstream `bc43068` explicitly exposes `slug` on both request and response and uses the key's `selector_prefix` for pricing. Its own-endpoint documentation therefore cannot be treated as proof of this hosted build's support.
- Owner created a separate endpoint named `capela-fault-primary`, OpenAI-compatible protocol, official DeepInfra API base, intentionally invalid nonsecret dummy credential, and the real model `openai/gpt-oss-20b`.
- Owner UI confirms a rate override for `capela-fault-primary:openai/gpt-oss-20b` already exists, but the provider's model row remains **Unpriced / 0 of 1 serving** after refresh. Policy creation refuses that target as unavailable. The model-row pencil initially opens an `openai:openai/gpt-oss-20b` override.
- The isolated key's readable catalog does not expose the custom offering/recovery policy. Management APIs return 401. A provider name alone has not been verified as a dispatch prefix.

These establish an advertised-contract gap and an override/availability mismatch. The exact server implementation cause is **unconfirmed** without operator inspection; do not assert a particular code defect or deployed commit from the version string alone. No production credential was altered; leave the test endpoint disabled while blocked. Do not make it a provider default.

## Single operator action needed

Provide a **supported, isolated extraction test policy with a controlled pre-response failure and working OVHcloud 20b backup**, scoped to `capela-verification`. Review remains on the separately verified 120b policy. The operator can enable compatible custom-endpoint prefix support or provision a separate named fault instance directly. Existing working providers, policies and ceilings must remain unchanged.

Ready-to-copy operator report (participant sends it; the assistant has not contacted anyone):

> On hosted OpenAPI 0.39.0+8779d66, the provider-key schemas omit the `slug` field documented in upstream bc43068. A separate custom-base endpoint has an existing custom-prefix rate override, but its offered gpt-oss-20b model remains unpriced/disabled and policy creation rejects the target. Refreshing pricing does not resolve it. Please inspect custom-endpoint selector/pricing compatibility or supply an isolated policy whose registered 20b primary fails before output and recovers to OVHcloud 20b. Keep our normal policies and finite test-workspace ceiling unchanged. We need the policy/configuration reference and actual attempted-provider trace, without credentials.

## Local verification prepared

`verify-credential-recovery.cjs` is a one-shot production-adapter check: two calls under a newly recorded $0.01 maximum inside the existing $20 authorization. It refuses missing owner-confirmed isolated settings before HTTP, requires observed OVHcloud fallback/20b identity, then distinct 120b review, applies recorded source assessments automatically and publishes nothing. Native and canonical model spellings are matched only through exact known provider/model pairs; observed headers remain unchanged. No allocation or inference for this check has occurred.

It stays blocked until the operator-supported setting exists and its availability/pricing is verified. No local switch bypasses hosted availability, pricing or budget enforcement.

## Earlier failed control preserved

The November 6 output-limit probe did not induce a failure: DeepInfra accepted `max_tokens:20000`, despite the catalog's advertised 16,384 maximum. The experiment stopped after one HTTP 200 request, reported $0.000193; no fallback/review call followed. Do not replay it or try more guessed parameters. See [actual failed experiment](../evaluation/controlled-recovery-attempt.json). Its unexpected completion body was not retained; later offline diagnostic code fixes that omission, without reconstructing the missing output.

Primary sources: [upstream schema](https://github.com/mozilla-ai/otari/blob/bc43068f7a06470f65a812b8f0d1fd9a335b87ec/src/gateway/schemas/providers.py), [upstream own-endpoint prefixes](https://github.com/mozilla-ai/otari/blob/bc43068f7a06470f65a812b8f0d1fd9a335b87ec/docs/provider-keys.md#add-a-key-for-your-own-endpoint), [routing credential failures](https://github.com/mozilla-ai/otari/blob/bc43068f7a06470f65a812b8f0d1fd9a335b87ec/docs/routing.md#selection-and-failure-are-separate), [DeepInfra official API base](https://github.com/deepinfra/docs/blob/main/quickstart.mdx). Contract and sanitized observations: [hosted-prefix-compatibility.json](../evaluation/hosted-prefix-compatibility.json).
