# Controlled recovery: hosted compatibility blocker

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
