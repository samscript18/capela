// Offline append-only publication revision; does not connect to providers or overwrite its input.
require("reflect-metadata");
const fs = require("node:fs"),
  crypto = require("node:crypto"),
  { execFileSync } = require("node:child_process");
const { parseStoredResearchRun } = require("@capela/shared");
const { createPublicationHold } = require("../apps/api/dist/research/publication-policy");
const { revisePublication } = require("../apps/api/dist/research/publication-revision");
function main() {
  const [input, assessmentFile, output] = process.argv.slice(2);
  if (!input || !assessmentFile || !output || input === output || fs.existsSync(output))
    throw Error(
      "Supply original record, explicit source assessment and an unused output path; input is never overwritten.",
    );
  const bytes = fs.readFileSync(input),
    original = JSON.parse(bytes),
    a = JSON.parse(fs.readFileSync(assessmentFile));
  original.research = parseStoredResearchRun(original.research);
  const at = new Date().toISOString(),
    codeCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const hold = createPublicationHold(original.research, a.claimId, a.reason, a.actor, at);
  const revision = revisePublication(original, [hold], at, codeCommit);
  const next = {
    ...original,
    ...revision,
    status: "completed",
    completedAt: at,
    createdAt: at,
    updatedAt: at,
    progress: {
      ...original.progress,
      ...revision.counts,
      message: "Publication revised after source inspection; no new inference",
    },
  };
  delete next.counts;
  // Account/record identity is intentionally removed from this intermediate file. A local persistence step
  // may attach the original owner to a NEW record, but never write the original investigation.
  delete next._id;
  delete next.userId;
  delete next.leaseToken;
  delete next.leaseExpiresAt;
  delete next.activeFreeSlot;
  next.access = { type: "free" };
  delete next.previousResearchRuns;
  delete next.retryMode;
  next.originalPrivateRecordSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  fs.writeFileSync(output, JSON.stringify(next, null, 2) + "\n", { flag: "wx" });
  if (crypto.createHash("sha256").update(fs.readFileSync(input)).digest("hex") !== next.originalPrivateRecordSha256)
    throw Error("Original record changed");
  console.log(
    JSON.stringify(
      {
        status: "revision-created",
        published: next.evidence.length,
        decisions: next.research.decisions.map((d) => ({ id: d.candidate.id, status: d.status })),
        provenance: next.research.publicationRevision.provenance,
        newPaidCalls: 0,
      },
      null,
      2,
    ),
  );
}
if (require.main === module) main();
