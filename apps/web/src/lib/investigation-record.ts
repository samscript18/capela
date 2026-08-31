import type {
  CapelaDossier,
  EvidenceClaim,
  InvestigationAnalysis,
  InvestigationStatus,
  MechanismResult,
  MoleculeSnapshot,
  PaperEvidence,
  PaperSnapshot,
  ResearchAssessment,
} from "@capela/shared";

export type ApiInvestigation = {
  _id: string;
  originalInput: string;
  status: InvestigationStatus;
  progress: {
    message: string;
    papersDiscovered: number;
    papersSelected: number;
    papersAnalyzed: number;
    experimentalFindings: number;
    computationalFindings: number;
    targetsEvaluated: number;
  };
  access: { type: "free" | "paid" };
  molecule?: MoleculeSnapshot;
  papers: PaperSnapshot[];
  paperEvidence: PaperEvidence[];
  evidence: EvidenceClaim[];
  analysis?: InvestigationAnalysis;
  mechanism?: MechanismResult;
  assessment?: ResearchAssessment;
  dossier?: CapelaDossier;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: { code: string; message: string };
};

export type ApiInvestigationPayload = Omit<ApiInvestigation, "papers" | "paperEvidence" | "evidence"> & {
  papers?: PaperSnapshot[] | null;
  paperEvidence?: PaperEvidence[] | null;
  evidence?: EvidenceClaim[] | null;
};

/**
 * Older records and investigations reset for retry can omit embedded arrays.
 * Normalize those API payloads once so every consumer receives the stable shape
 * represented by ApiInvestigation.
 */
export function normalizeApiInvestigation(record: ApiInvestigationPayload): ApiInvestigation {
  return {
    ...record,
    papers: Array.isArray(record.papers) ? record.papers : [],
    paperEvidence: Array.isArray(record.paperEvidence) ? record.paperEvidence : [],
    evidence: Array.isArray(record.evidence) ? record.evidence : [],
  };
}

export function formatInvestigationStatus(status: InvestigationStatus) {
  return status
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function formatAccessType(type: ApiInvestigation["access"]["type"]) {
  return `${type.charAt(0).toUpperCase()}${type.slice(1)} access`;
}
