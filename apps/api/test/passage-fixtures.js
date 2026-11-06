// Synthetic adapter fixtures for the inference-only passage-selection contract.
const { indexedSource } = require("../dist/research/passage-references");
function selectionCandidate(c, source) {
  const { snapshotId, snapshotHash, analyzedSource, spans, passageSelection, ...claim } = c;
  void snapshotId;
  void snapshotHash;
  void analyzedSource;
  void passageSelection;
  const index = indexedSource(source).passageIndex;
  return {
    ...claim,
    passageIds: spans.map((span) => {
      const p = index.passages.find(
        (p) => p.span.start === span.start && p.span.end === span.end && p.span.quote === span.quote,
      );
      if (!p) throw Error("Fixture span is not an indexed passage");
      return p.id;
    }),
  };
}
function selectionReview(r, source) {
  const { spans, revisedFinding, passageSelection, ...review } = r;
  void passageSelection;
  const index = indexedSource(source).passageIndex;
  const passageIds = spans.map(
    (span) =>
      index.passages.find((p) => p.span.quote === span.quote && p.span.start === span.start && p.span.end === span.end)
        .id,
  );
  return {
    ...review,
    passageIds,
    revisionPassageId: revisedFinding === null ? null : index.passages.find((p) => p.span.quote === revisedFinding).id,
  };
}
module.exports = { selectionCandidate, selectionReview };
