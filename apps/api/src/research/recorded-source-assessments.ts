// Explicit source adjudications, not keyword rules, model verdicts or a scientific gold set.
// Origin: evaluation/publication-revision.json revision.holds[0], unchanged historical record.
export const RECORDED_SOURCE_ASSESSMENTS = [
  {
    id: "source-assessment-pmid32141677-nfkb-v1",
    recordedAt: "2026-11-06T16:17:22.789Z",
    origin: "evaluation/publication-revision.json#revision.holds[0]",
    paperId: "32141677",
    normalization: "NFC-LF-v1",
    parserVersion: "publication-abstract-v1",
    snapshotHash: "55ad5418d6f3f36bf5076b57736a93d2121b283ff0cfad67a5af0b086891ab0c",
    findingHash: "a1df0232e2603760dccdfac5ce9b7927cf63da63f880a4ef3c1ffd3549767919",
    spanHash: "fd7f9d37f02faafa19c9dc8be9e3e3b951ec65043562082310c0d02b538fcbc5",
    reason:
      "The added clause ‘a key regulator of inflammation and cell survival’ is not stated by the selected passage. Exact recurrence withheld using a recorded assistant source assessment; this concern was not detected by the model reviewer.",
  },
] as const;
