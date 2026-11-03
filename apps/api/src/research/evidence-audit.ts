import type { CandidateClaim, ResearchRun, SourceSnapshot } from "@capela/shared";
import { z } from "zod";
import { digest, referenceValid, ResearchError } from "./provenance";
import type { OtariGatewayService, SaveRun } from "./otari-gateway.service";

export const AUDIT_VERSION = "span-audit-v1";
// Only data is interpolated, as a JSON string decoded by json.loads. No data becomes Python syntax.
export const AUDIT_PROGRAM = String.raw`import json, hashlib
p = json.loads(INPUT_JSON)
sources = {s['id']: s for s in p['sources']}
invalid = []
distribution = {}
used = set()
for c in p['claims']:
    s = sources.get(c['snapshotId'])
    valid = bool(s and s['paperId'] == c['paperId'] and s['hash'] == c['snapshotHash'] and hashlib.sha256(s['text'].encode('utf-8')).hexdigest() == s['hash'] and c['spans'])
    if valid:
        encoded = s['text'].encode('utf-16-le')
        for span in c['spans']:
            start, end = span['start'], span['end']
            try:
                valid = valid and span['blockId'] == 'abstract' and span['convention'] == 'utf16-zero-based-end-exclusive' and 0 <= start < end <= len(encoded)//2 and encoded[start*2:end*2].decode('utf-16-le') == span['quote']
            except (UnicodeError, ValueError):
                valid = False
    if not valid:
        invalid.append(c['id'])
    else:
        used.add(c['paperId'])
        t = c['proposedClass']
        distribution[t] = distribution.get(t, 0) + 1
print(json.dumps({'valid': not invalid, 'accepted': len(p['claims'])-len(invalid), 'sources': len(used), 'distribution': distribution, 'invalidIds': invalid}, sort_keys=True))
`;
export const AuditOutput = z
  .object({
    valid: z.boolean(),
    accepted: z.number().int().min(0),
    sources: z.number().int().min(0),
    distribution: z.record(z.string(), z.number().int().min(0)),
    invalidIds: z.array(z.string()).max(60),
  })
  .strict();
export function localAudit(claims: CandidateClaim[], sources: SourceSnapshot[]) {
  const valid = claims.filter((c) => referenceValid(c, sources));
  const distribution: Record<string, number> = {};
  valid.forEach((c) => {
    distribution[c.proposedClass] = (distribution[c.proposedClass] ?? 0) + 1;
  });
  return {
    valid: valid.length === claims.length,
    accepted: valid.length,
    sources: new Set(valid.map((c) => c.paperId)).size,
    distribution,
    invalidIds: claims.filter((c) => !referenceValid(c, sources)).map((c) => c.id),
  };
}
export function auditCode(claims: CandidateClaim[], sources: SourceSnapshot[]) {
  const payload = JSON.stringify({ claims, sources });
  return `INPUT_JSON = ${JSON.stringify(payload)}\n${AUDIT_PROGRAM}`;
}
export async function remoteAudit(
  gateway: OtariGatewayService,
  claims: CandidateClaim[],
  run: ResearchRun,
  save: SaveRun,
) {
  const local = localAudit(claims, run.snapshots);
  const { data, event } = await gateway.request(
    "/code/execute",
    { code: auditCode(claims, run.snapshots), timeout_seconds: 10 },
    "sandbox_audit",
    run,
    save,
  );
  if (data.return_code !== 0 || data.stderr !== "" || typeof data.stdout !== "string" || data.stdout.length > 12000)
    throw new ResearchError("AUDIT_EXECUTION_FAILED", "Sandbox audit failed or exceeded its output bound.");
  const remote = AuditOutput.parse(JSON.parse(data.stdout));
  const equal =
    remote.valid === local.valid &&
    remote.accepted === local.accepted &&
    remote.sources === local.sources &&
    JSON.stringify([...remote.invalidIds].sort()) === JSON.stringify([...local.invalidIds].sort()) &&
    JSON.stringify(Object.entries(remote.distribution).sort()) ===
      JSON.stringify(Object.entries(local.distribution).sort());
  run.audit = {
    ...remote,
    version: AUDIT_VERSION,
    programHash: digest(AUDIT_PROGRAM),
    remote: true,
    requestId: event.requestId,
  };
  await save();
  if (!equal || !remote.valid)
    throw new ResearchError(
      "AUDIT_DISAGREEMENT",
      "Remote/local evidence audit failed. Dossier publication is blocked.",
    );
}
