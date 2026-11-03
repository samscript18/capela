// Opt-in real service investigation. This does not authenticate a browser or publish to MongoDB.
require("reflect-metadata");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { ConfigService } = require("@nestjs/config");
const { OtariGatewayService } = require("../apps/api/dist/research/otari-gateway.service");
const { OtariRetrievalService } = require("../apps/api/dist/research/otari-retrieval.service");
const { OtariEvidenceService } = require("../apps/api/dist/research/otari-evidence.service");
const { EvidenceClassifierService } = require("../apps/api/dist/research/evidence-classifier.service");
const { PubChemService } = require("../apps/api/dist/research/pubchem.service");
const { MechanismService } = require("../apps/api/dist/research/mechanism.service");
const { ResearchAssessmentService } = require("../apps/api/dist/research/research-assessment.service");
const { DossierService } = require("../apps/api/dist/research/dossier.service");
async function main() {
  const dir = ".local-evaluation";
  const file = `${dir}/live-verification.json`;
  const auth = JSON.parse(fs.readFileSync(`${dir}/authorization.json`));
  const cap = Number(process.env.OTARI_LIVE_TEST_BUDGET_MICROUSD ?? 0);
  if (cap <= 0 || cap !== auth.capMicrousd || auth.hostedCeiling !== "owner-confirmed")
    throw new Error("Explicit finite authorization must match; no calls sent");
  const lock = fs.openSync(`${dir}/live-verification.lock`, "wx");
  try {
    const report = JSON.parse(fs.readFileSync(file));
    if (report.roleCheck.status !== "passed" || report.investigation || report.run.budget.terminal)
      throw new Error("One successful role check and an unused investigation slot are required");
    const config = new ConfigService({ ...process.env, MAX_ANALYZED_PAPERS: "1" });
    class BoundedGateway extends OtariGatewayService {
      async request(path, body, operation, run, save) {
        // Model estimates are measured; each priced tool reserves its catalog price.
        config.set("OTARI_CALL_RESERVATION_MICROUSD", path === "/chat/completions" ? "2000" : "10000");
        return super.request(path, body, operation, run, save);
      }
    }
    const gateway = new BoundedGateway(config);
    const run = gateway.createRun(crypto.randomUUID());
    // One shared task ledger: prior charges and uncertain reservations are never reset.
    run.budget = report.run.budget;
    run.budget.capMicrousd = Math.min(cap, run.budget.capMicrousd);
    const result = { status: "running", mode: "real-services; no signed-in application journey", run };
    report.investigation = result;
    const save = async () => {
      const temporary = `${file}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(report, null, 2) + "\n");
      fs.renameSync(temporary, file);
    };
    await save();
    try {
      result.molecule = await new PubChemService(config).resolve("curcumin");
      await save();
      result.literature = await new OtariRetrievalService(gateway).search(result.molecule, run, save);
      const classifier = new EvidenceClassifierService();
      result.validated = await new OtariEvidenceService(gateway, classifier).extract(
        result.literature.papers,
        result.molecule,
        run,
        save,
      );
      const { claims, analysis } = result.validated;
      const mechanism = new MechanismService().build(result.molecule, claims, result.literature.papers, analysis);
      const assessment = new ResearchAssessmentService().assess(
        claims,
        analysis,
        mechanism,
        result.literature.papers.map(() => ({ analyzedSource: "abstract" })),
      );
      assessment.majorEvidenceGaps.push("One-abstract funded verification; no exhaustive or full-text coverage.");
      result.dossier = new DossierService().build(
        result.molecule,
        result.literature.papers,
        claims,
        analysis,
        mechanism,
        assessment,
      );
      result.status = "completed";
      run.checkpoint = "completed";
    } catch (error) {
      result.status = "failed";
      result.errorCode = typeof error.code === "string" ? error.code : "VALIDATION_FAILED";
      process.exitCode = 1;
    }
    await save();
    console.log(
      JSON.stringify(
        {
          status: result.status,
          errorCode: result.errorCode,
          models: run.models,
          sources: run.snapshots.map((s) => ({ url: s.canonicalUrl, hash: s.hash })),
          events: run.events,
          decisions: run.decisions.map((d) => ({ id: d.candidate.id, status: d.status, reason: d.reason })),
          audit: run.audit,
          budget: run.budget,
        },
        null,
        2,
      ),
    );
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(`${dir}/live-verification.lock`);
  }
}
main().catch(() => {
  console.error("Investigation blocked; retained ledger unchanged. No credentials logged.");
  process.exitCode = 1;
});
