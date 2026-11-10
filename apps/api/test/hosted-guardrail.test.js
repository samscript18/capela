const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ready, observedBlock } = require("../../../scripts/verify-hosted-guardrail.cjs");
test("isolated guardrail check requires owner-confirmed free vendor quota and separate key", () => {
  const cfg = {
    isolated: true,
    ownerConfirmedActive: true,
    profile: "capela-prompt-injection-test",
    workspace: "capela-verification",
    mode: "block",
    onUnavailable: "block",
    vendorFreeQuotaNoPaidOverage: true,
  };
  assert.equal(ready(cfg, "fixture-isolated", "fixture-runtime"), true);
  assert.equal(ready(cfg, "fixture-runtime", "fixture-runtime"), false);
  for (const field of Object.keys(cfg))
    assert.equal(ready({ ...cfg, [field]: undefined }, "fixture-isolated", "fixture-runtime"), false);
});
test("guardrail demonstration requires actual violation provenance, not budget denial or unavailable service", () => {
  const run = { events: [{ httpStatus: 403, upstreamCode: "guardrail_violation", requestId: "fixture-request" }] };
  assert.equal(observedBlock(run, { code: "OTARI_GUARDRAIL_BLOCKED" }), true);
  for (const code of ["budget_exceeded", "guardrail_unavailable", undefined])
    assert.equal(
      observedBlock({ events: [{ ...run.events[0], upstreamCode: code }] }, { code: "OTARI_GUARDRAIL_BLOCKED" }),
      false,
    );
  assert.equal(
    observedBlock({ events: [{ ...run.events[0], requestId: undefined }] }, { code: "OTARI_GUARDRAIL_BLOCKED" }),
    false,
  );
  assert.equal(observedBlock(run, { code: "OTARI_PROVIDER_ERROR" }), false);
});
