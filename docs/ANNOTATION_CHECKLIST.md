# Human annotation checklist

Internal development note; unfinished evaluation work is retained here for continuity and is not part of the submission narrative or a rubric requirement.

All 30 pilot labels remain AI-drafted. Do not use them as scientific gold labels. The 12 held-out cases remain frozen; no model prompt tuning against held-out outcomes.

For each case in `evaluation/pilot.json`, open its canonical source, compare the stored bounded excerpt and hash, and record separately:

- Whether the finding is entailed, overstated, unsupported, contradicted or uncertain; cite the exact stored passage and UTF-16 offsets.
- Molecule attribution, negation, species/cell model, measured outcome, primary/review/computational status and permissible evidence class. Check retraction status.
- Whether the excerpt contains enough context to judge. Abstain if it does not; do not fill gaps from memory.
- Reviewer identifier, review date, rationale and any disagreements. Retain the original provisional label alongside the adjudicated label.

For model outputs, match each candidate and published revision to the same source. Score extraction-only and reviewed output independently; include rejected and unresolved cases. Report accepted supported / all accepted scored, unsupported-or-overstated accepted / all such labeled candidates, class confusion counts, decisions, coverage and abstention. An empty acceptance denominator means precision is undefined.

No annotations have been completed by this implementation. The following records each contain three cases (source-level split is fixed):

- [pubmed-42505335](https://pubmed.ncbi.nlm.nih.gov/42505335/) — held-out; human review pending.
- [pubmed-42397814](https://pubmed.ncbi.nlm.nih.gov/42397814/) — development; human review pending.
- [pubmed-42347487](https://pubmed.ncbi.nlm.nih.gov/42347487/) — development; human review pending.
- [pubmed-42954735](https://pubmed.ncbi.nlm.nih.gov/42954735/) — held-out; human review pending.
- [pubmed-42654293](https://pubmed.ncbi.nlm.nih.gov/42654293/) — development; human review pending.
- [pubmed-42280140](https://pubmed.ncbi.nlm.nih.gov/42280140/) — development; human review pending.
- [pubmed-42792674](https://pubmed.ncbi.nlm.nih.gov/42792674/) — held-out; human review pending.
- [pubmed-42009901](https://pubmed.ncbi.nlm.nih.gov/42009901/) — development; human review pending.
- [pubmed-41859571](https://pubmed.ncbi.nlm.nih.gov/41859571/) — development; human review pending.
- [pubmed-42756119](https://pubmed.ncbi.nlm.nih.gov/42756119/) — held-out; human review pending.
