import { z } from "zod";

export const EVIDENCE_TYPES = [
  "direct_experimental",
  "indirect_experimental",
  "computational_prediction",
  "literature_reported",
  "capela_inference",
  "insufficient",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export const EvidenceTypeSchema = z.enum(EVIDENCE_TYPES);

export const TARGET_RELATIONSHIPS = [
  "direct_binding",
  "inhibition",
  "activation",
  "expression_increase",
  "expression_decrease",
  "pathway_association",
  "predicted_binding",
  "indirect_association",
  "unknown",
] as const;
export type TargetRelationship = (typeof TARGET_RELATIONSHIPS)[number];
export const TargetRelationshipSchema = z.enum(TARGET_RELATIONSHIPS);

export const INVESTIGATION_STATUSES = [
  "queued",
  "resolving_molecule",
  "searching_literature",
  "ranking_studies",
  "extracting_evidence",
  "classifying_evidence",
  "analyzing_findings",
  "building_assessment",
  "generating_dossier",
  "completed",
  "failed",
] as const;

export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];

export const ACTIVE_INVESTIGATION_STATUSES: InvestigationStatus[] = INVESTIGATION_STATUSES.filter(
  (status) => status !== "completed" && status !== "failed",
);

export type AccessResponse = {
  paymentsEnabled: boolean;
  unlimitedInvestigations: boolean;
  freeInvestigationAvailable: boolean;
  freeInvestigationsLimit: number;
  freeInvestigationsUsedToday: number;
  freeInvestigationsRemaining: number;
  freeInvestigationsResetAt: string;
  paymentRequired: boolean;
  priceWei: string;
  chainId: number;
  paymentReceiverAddress?: string;
  verifiedPaymentId?: string;
};

export type PaymentVerificationResponse = {
  id: string;
  transactionHash: string;
  chainId: number;
  from: string;
  to: string;
  amountWei: string;
  status: "verified" | "consumed";
};

export type UserPreferences = {
  compactEvidence: boolean;
  openEvidenceInDrawer: boolean;
};

export type MoleculeSnapshot = {
  pubchemCid: number;
  preferredName: string;
  synonyms: string[];
  molecularFormula?: string;
  molecularWeight?: string;
  canonicalSmiles?: string;
  isomericSmiles?: string;
  inchi?: string;
  inchiKey?: string;
  structure2dUrl: string;
  pubchemUrl: string;
  description?: {
    text: string;
    sourceName?: string;
    sourceUrl?: string;
  };
};

export type PaperSnapshot = {
  id: string;
  source: string;
  title: string;
  authors: string[];
  authorString?: string;
  journal?: string;
  year?: number;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  abstract?: string;
  publicationTypes: string[];
  studyType: "review" | "meta_analysis" | "clinical_trial" | "journal_article" | "unclassified";
  citationCount?: number;
  fullTextAvailable: boolean;
  openAccess: boolean;
  externalUrl: string;
  relevanceScore: number;
  relevanceReasons: string[];
  matchedQueries: string[];
};

const ConfidenceSchema = z.enum(["high", "medium", "low"]);
const EvidenceTextSchema = z.string().max(1_500);
const EvidenceListSchema = z.array(z.string().max(1_000)).max(8);

export const PaperEvidenceSchema = z
  .object({
    paperId: z.string(),
    analyzedSource: z.literal("abstract"),
    relevance: z.enum(["high", "medium", "supporting", "low"]),
    studyType: z.enum([
      "experimental_in_vitro",
      "experimental_in_vivo",
      "clinical",
      "computational",
      "review",
      "observational",
      "other",
    ]),
    sourceContexts: z.array(z.object({ source: EvidenceTextSchema, context: EvidenceTextSchema }).strict()).max(8),
    activities: z
      .array(
        z
          .object({
            activity: EvidenceTextSchema,
            finding: EvidenceTextSchema,
            model: EvidenceTextSchema.nullable(),
            measuredOutcome: EvidenceTextSchema.nullable(),
            evidenceType: EvidenceTypeSchema,
            confidence: ConfidenceSchema,
          })
          .strict(),
      )
      .max(8),
    targets: z
      .array(
        z
          .object({
            target: EvidenceTextSchema,
            relationship: TargetRelationshipSchema,
            finding: EvidenceTextSchema,
            directExperimentalConfirmation: z.boolean(),
            evidenceType: EvidenceTypeSchema,
            confidence: ConfidenceSchema,
          })
          .strict(),
      )
      .max(8),
    mechanisms: z
      .array(
        z
          .object({
            finding: EvidenceTextSchema,
            pathway: EvidenceTextSchema.nullable(),
            molecularEvent: EvidenceTextSchema.nullable(),
            cellularEffect: EvidenceTextSchema.nullable(),
            biologicalOutcome: EvidenceTextSchema.nullable(),
            evidenceType: EvidenceTypeSchema,
            confidence: ConfidenceSchema,
          })
          .strict(),
      )
      .max(8),
    limitations: EvidenceListSchema,
  })
  .strict();

export const PaperEvidenceBatchSchema = z.object({ papers: z.array(PaperEvidenceSchema) }).strict();
export type PaperEvidence = z.infer<typeof PaperEvidenceSchema>;

export type EvidenceStrength = "Strong" | "Moderate" | "Limited" | "Insufficient";

export type EvidenceClaim = {
  id: string;
  paperId: string;
  kind: "source_context" | "activity" | "target" | "mechanism";
  finding: string;
  evidenceType: EvidenceType;
  confidence: "high" | "medium" | "low";
  studyType: PaperEvidence["studyType"];
  analyzedSource: PaperEvidence["analyzedSource"];
  activity?: string;
  originalActivity?: string;
  model?: string;
  measuredOutcome?: string;
  target?: string;
  originalTarget?: string;
  relationship?: TargetRelationship;
  directExperimentalConfirmation?: boolean;
  pathway?: string;
  molecularEvent?: string;
  cellularEffect?: string;
  biologicalOutcome?: string;
  source?: string;
};

export type BiologicalActivitySummary = {
  name: string;
  originalNames: string[];
  summary: string;
  strength: EvidenceStrength;
  supportingEvidenceIds: string[];
  supportingPaperIds: string[];
  studyModels: string[];
  experimentalCount: number;
  computationalCount: number;
  conflicts: string[];
};

export type TargetSummary = {
  target: string;
  normalizedTarget: string;
  originalNames: string[];
  relationship: TargetRelationship;
  summary: string;
  directExperimentalConfirmation: boolean;
  strength: EvidenceStrength;
  evidenceTypes: EvidenceType[];
  evidenceIds: string[];
  paperIds: string[];
  conflicts: string[];
};

export type SourceContextSummary = {
  source: string;
  contexts: string[];
  evidenceIds: string[];
  paperIds: string[];
};

export type EvidenceConflict = {
  scope: "activity" | "target";
  label: string;
  description: string;
  evidenceIds: string[];
  paperIds: string[];
};

export type InvestigationAnalysis = {
  activities: BiologicalActivitySummary[];
  targets: TargetSummary[];
  sourceContexts: SourceContextSummary[];
  conflicts: EvidenceConflict[];
  limitations: { paperId: string; items: string[] }[];
};

export type MechanismEdge = {
  id: string;
  from: string;
  to: string;
  description: string;
  evidenceType: EvidenceType;
  evidenceIds: string[];
  paperIds: string[];
};

export type MechanismResult = {
  status: "supported" | "partially_supported" | "insufficient_evidence" | "conflicting_evidence";
  summary: string;
  edges: MechanismEdge[];
  evidenceIds: string[];
  paperIds: string[];
};

export type ResearchAssessment = {
  overallStrength: EvidenceStrength;
  score: number;
  biologicalActivityEvidence: EvidenceStrength;
  targetEvidence: EvidenceStrength;
  mechanisticEvidence: EvidenceStrength;
  consistency: "consistent" | "mixed" | "conflicting" | "insufficient";
  strongestEvidence: string[];
  majorEvidenceGaps: string[];
  conflicts: EvidenceConflict[];
  explanation: string;
  basis: {
    papersAnalyzed: number;
    abstractOnlyPapers: number;
    directExperimentalPapers: number;
    indirectExperimentalPapers: number;
    computationalPapers: number;
    literatureReportedPapers: number;
    directlyConfirmedTargets: number;
    mechanismStatus: MechanismResult["status"];
  };
};

export type DossierLiteratureEntry = PaperSnapshot & {
  analyzedSource: "abstract" | "not_analyzed";
  evidenceIds: string[];
  evidenceTypes: EvidenceType[];
  extractedFindings: string[];
};

export type CapelaDossier = {
  generatedAt: string;
  overview: { molecule: MoleculeSnapshot };
  sources: { items: SourceContextSummary[]; paperIds: string[]; evidenceIds: string[] };
  biologicalActivity: { items: BiologicalActivitySummary[]; paperIds: string[]; evidenceIds: string[] };
  molecularTargets: { items: TargetSummary[]; paperIds: string[]; evidenceIds: string[] };
  mechanism: MechanismResult;
  literature: { items: DossierLiteratureEntry[]; paperIds: string[]; evidenceIds: string[] };
  evidenceVsPrediction: {
    distribution: Record<EvidenceType, number>;
    examples: EvidenceClaim[];
    paperIds: string[];
    evidenceIds: string[];
  };
  researchAssessment: ResearchAssessment & { paperIds: string[]; evidenceIds: string[] };
};
