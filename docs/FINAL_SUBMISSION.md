# Capela submission email — prepared November 10, 2026

Draft for the participant to review and send as a reply to the original sign-up thread with marcus+wilding@mozilla.org. Nothing has been emailed or submitted. The supplied deadline is November 11, 11:59 PM; its timezone is unspecified.

## Verified packaging status

Preparation continued from clean `0c0396c` on the published `feat/otari-completion-verification` branch. The metadata follow-up was pushed with owner authorization and the remote branch tip was verified at `d81c03e` on November 10. Its actual live request remains bound to the source hashes in evaluation/hosted-guardrail-metadata-verification.json; publication does not imply deployment. Existing repository, branch and first integration links are verified.

The first integration commit exists locally and on GitHub. No participant recording link, registered Otari email, or upstream contribution link was found in the inspected submission/evidence notes. Those fields cannot be invented. The feedback below is an experience-based draft for participant approval, especially the personal decision about continued use.

## Email body

Hi Marcus,

I'm submitting **Capela**, an evidence-first molecule investigation workspace that turns scientific abstracts into sourced dossiers with exact passages, model-assisted review and visible uncertainty.

**Otari sign-up email:** [INSERT YOUR REGISTERED EMAIL]

**Public GitHub repository (hackathon implementation):** https://github.com/samscript18/capela/tree/feat/otari-completion-verification

**Hackathon branch:** `feat/otari-completion-verification` — https://github.com/samscript18/capela/tree/feat/otari-completion-verification

**Reviewed implementation:** https://github.com/samscript18/capela/commit/d81c03e7cd94b5210d1094818ec9e4e0b479376b — the published metadata follow-up. Its live verification started at `0c0396c` with exact working-source hashes recorded in `evaluation/hosted-guardrail-metadata-verification.json`.

**First Otari integration commit:** https://github.com/samscript18/capela/commit/9085c3f30003e5edab5e6dc05674052831f38c48

**Project demo, 3–5 minutes:** [INSERT YOUR SCREEN RECORDING LINK]

### What I built with Otari

Capela resolves molecule identity, executes scientific search through hosted Otari, retrieves canonical publication abstracts through authenticated remote MCP, and saves immutable source snapshots before inference. Hosted `openai/gpt-oss-20b` extracts structured findings; a distinct hosted `openai/gpt-oss-120b` independently reviews them. Both select stored passage IDs, and Capela resolves exact quotations and offsets deterministically. Publication controls preserve evidence classes, uncertainty and review provenance. A fixed hosted sandbox audit is compared with local validation before dossier assembly.

### Otari features used

- **Distinct model roles:** observed 20b extraction and 120b review in a completed authenticated local application investigation.
- **Search:** actual hosted search used to select the investigation's source.
- **MCP:** actual authenticated hosted invocation retrieved the canonical abstract used by both models.
- **Code execution:** a nonempty hosted evidence audit agreed with local validation in the original completed run.
- **Inference guardrails:** a new isolated production-adapter test returned HTTP 403, `guardrail_violation`, and a validated evaluated blocking result for the expected guardrail in the same response, directly associated with request `1c30c704-3335-4ee9-a68c-dbd60a4dfb57`. This no longer depends on manually joining the earlier vendor log. Explanations, raw profile labels, vendor payloads and private text are omitted from retained metadata. No prompt-only cause or false-positive performance is claimed.
- **Routing policies:** isolated extraction and review policies executed through Capela's production adapter with distinct resolved models. Both returned `fallback:false`; successful backup recovery remains unverified.
- **Budgets and spending limits:** an isolated workspace's finite $0.01 ceiling produced a real HTTP 403 `budget_exceeded`. Capela recorded terminal denial and blocked another dispatch before HTTP. This is separate from the completed research run and does not establish the original runtime key's ceiling.

The six selected categories are distinct model roles, search, MCP, code execution, spending limits and guardrails. Routing selection is additional evidence with recovery still unverified. The six selected categories span the completed investigation and separate isolated checks; they were not all exercised in one investigation. Judges determine credit. Detailed provenance: https://github.com/samscript18/capela/blob/feat/otari-completion-verification/docs/RUBRIC_EVIDENCE.md

### Inspectable result and limitations

The November 6 curcumin investigation completed through hosted Otari with one canonical PubMed review abstract, distinct observed extraction/review models, persisted reopening and an inspected downloaded PNG. The original models accepted two literature-reported findings. Later source inspection identified an unsupported clause in the second finding. A separately recorded publication revision now publishes **one finding and retains the second as unresolved**, preserving the original model verdicts, events and costs.

The published finding concerns reported regulation of ROS and cytosolic calcium in tumor cells. The withheld finding adds an NF-κB background clause absent from its selected passage. The original reviewer did not detect that clause. Current code automatically applies the recorded assessment to exact recurrences; this is narrow case reuse, not general entailment detection.

Sanitized sample source: https://github.com/samscript18/capela/blob/feat/otari-completion-verification/apps/web/public/samples/curcumin-2026-11-06.html

The sample opens at `/samples/curcumin-2026-11-06.html` in the running application; this GitHub link is the artifact source, not a verified hosted preview. Coverage is abstract-only and review is model-assisted. Mechanical hash, exact-passage and reference checks do not establish scientific accuracy or demonstrate that review improves correctness. The revised one-finding audit is local; the original two-record hosted audit remains separate historical provenance.

Current Node 24.22.2 release verification passed 134 unit/adapter tests, four integration checks, seven browser fixtures, formatting, lint, typecheck and production build. Hash/reference/passage checks validate mechanics, not scientific accuracy.

### Otari PRs or issues

None opened during this work. The repository contains a reproducible hosted compatibility report, but it has not been filed as an upstream issue.

### Written feedback

**When were you most tempted to skip Otari and call the provider directly? What happened?**

Hosted review timeouts and remote MCP discovery failures were the strongest pressure points. Historical compatibility runs used direct Vertex review and are explicitly labeled hybrid. The qualifying investigation excluded that fallback. After MCP became available, the hosted-only investigation completed. We did not establish the cause of the earlier MCP outage.

**What did you end up building yourself that Otari should have done for you?**

We built durable application reservations, unknown-cost accounting and checkpoints, plus a bounded verification harness that preserves requested policies, resolved models and denial metadata. Source snapshots and publication policy remain Capela-specific responsibilities. More accessible scoped configuration inspection and request-level attempted-route traces would have reduced the custom diagnostic work. We also added safe parsing of the documented guardrail refusal envelope, directly tying its evaluated blocking verdict to the Otari request ID.

**If the rules hadn't required Otari, would you have continued using Otari? Why or why not?**

[PARTICIPANT: CONFIRM OR REPLACE THIS PERSONAL ANSWER BEFORE SENDING.] I would continue evaluating it for the unified hosted inference, tools and spending controls. I would make broader production adoption conditional on reliable role completion, clearer management permissions and consistent hosted documentation. The working investigation and real budget refusal were useful; the blocked custom-endpoint recovery setup still needs operator support.

**What worked well?**

Hosted inference, scientific search, authenticated MCP and sandbox execution worked together in a real completed workflow. Policy/model response metadata and the explicit budget denial gave us inspectable evidence rather than relying only on dashboard configuration.

**What didn't work, and what would you change?**

Controlled fallback recovery remains blocked. A separate custom-base test endpoint and model were created, and a custom-prefix rate override exists, but the model remains unpriced/disabled and routing-policy creation rejects its target. Refreshing pricing did not resolve it. The November 6 hosted contract omitted the upstream-documented provider `slug` field. The November 10 contract now exposes it, superseding that schema blocker; management access and actual endpoint availability still need owner/admin inspection. The historical pricing failure's internal cause remains unconfirmed. I would improve hosted/versioned documentation alignment, selector validation, pricing diagnostics and visibility into attempted fallback routes. No working production credential or policy was disrupted to induce a failure.

Thanks,
[YOUR NAME]

## Recording and final send checks

- Record the actual application for 3–5 minutes with the participant's own screen and audio. Do not generate a submission video or narration.
- Show exact source passages, both observed models, the real publication hold, reopening/export and actual routing/denial artifacts. Do not stage a reviewer correction.
- Fill the registered email, add the accessible demo link and approve the personal feedback answer.
- Reply in the original sign-up email thread. Confirm the unspecified deadline timezone with the organizer; do not assume Africa/Lagos.
- No push, deployment, paid request or email was performed while preparing this draft.
