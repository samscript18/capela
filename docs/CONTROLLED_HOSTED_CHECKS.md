# Controlled hosted checks — prepared, not executed

Primary contracts rechecked November 6 at upstream [`bc43068`](https://github.com/mozilla-ai/otari/tree/bc43068f7a06470f65a812b8f0d1fd9a335b87ec): [routing](https://github.com/mozilla-ai/otari/blob/bc43068f7a06470f65a812b8f0d1fd9a335b87ec/docs/routing.md#failover), [budgets](https://github.com/mozilla-ai/otari/blob/bc43068f7a06470f65a812b8f0d1fd9a335b87ec/docs/budgets.md#reservations-are-taken-up-front). Neither local denial fixtures nor direct Vertex fallback qualifies.

No dedicated policy/key or administrative access is configured locally. Existing runtime management reads were 401. The owner/operator must prepare isolated test configuration; this document does not authorize production changes.

## Routing

Create a dedicated extraction test policy using a supported hosted `select` + `on_failure` configuration. Have the operator induce one controlled **pre-response transient failure** on its test primary, with a working extraction fallback and a different open-weight review role. Do not assume an invented unavailable model ID triggers failover. Use the real fixed source snapshot and production `extractionInput`, strict native extraction schema, 2,000-token/low-reasoning bounds.

Before execution, record policy revision, target IDs/licenses, source hash, code commit/hash and a small reservation allocated from the retained task ledger. Send once. Retain actual response IDs, `Otari-Fallback`, resolved model and operator/dashboard attempted-model trace. Validate output and use it in the investigation. A successful policy alias, application-level retry or Vertex fallback is insufficient. Stop on denial or uncertain charge; do not automatically replay.

## Finite monetary ceiling

Create a dedicated non-exempt test key with a finite dollar budget smaller than the documented priced request hold. A priced model with a tiny bounded prompt/output limit can then be refused **before dispatch**, without spending the account balance. Confirm the hosted UI accepts the chosen finite amount and that it is below the computed hold; do not guess zero-limit semantics. Ensure pricing exists and distinguish provider/account funds from the scoped cap.

Use one bounded non-streaming chat request with that key, no tools, no retry. Expect HTTP 403 and `Otari-Error-Code: budget_exceeded`; retain safe request ID and `Otari-Budget-Scope` plus scoped budget configuration. Verify Capela marks terminal denial, keeps saved partial work/uncertainty, and sends no subsequent provider request. Insufficient funds, pricing-required, a token/request limit, local allowance exhaustion or a 429 do not prove this monetary-ceiling category.

Retain existing task ledgers and reserve the smallest possible exposure before sending. If the test unexpectedly succeeds, record its actual settlement/unknown cost and stop; do not repeat until money is consumed. Never raise the main ceiling or buy credits to obtain a demonstration.
