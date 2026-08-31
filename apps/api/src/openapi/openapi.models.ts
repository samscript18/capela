import { EVIDENCE_TYPES, INVESTIGATION_STATUSES, TARGET_RELATIONSHIPS } from "@capela/shared";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

const objectIdExample = "66d2e2b59d8f09f1c2a7b431";

export class ApiErrorResponseDto {
  @ApiPropertyOptional({ example: 401, description: "Present on standard Nest HTTP errors." }) statusCode?: number;
  @ApiProperty({ example: "Unauthorized" }) message!: string | string[];
  @ApiPropertyOptional({ example: "Unauthorized", description: "Present on standard Nest HTTP errors." })
  error?: string;
  @ApiPropertyOptional({ example: "PAYMENT_REQUIRED", description: "Stable machine-readable code when supplied." })
  code?: string;
}

export class HealthResponseDto {
  @ApiProperty({ enum: ["ok"], example: "ok" }) status!: "ok";
  @ApiProperty({ enum: ["capela-api"], example: "capela-api" }) service!: "capela-api";
  @ApiProperty({ enum: ["connected"], example: "connected" }) database!: "connected";
}

export class HealthUnavailableResponseDto {
  @ApiProperty({ enum: ["unavailable"] }) status!: "unavailable";
  @ApiProperty({ enum: ["capela-api"] }) service!: "capela-api";
  @ApiProperty({ enum: ["unavailable"] }) database!: "unavailable";
}

export class UserPreferencesResponseDto {
  @ApiProperty({ description: "Render evidence cards in the compact layout." }) compactEvidence!: boolean;
  @ApiProperty({ description: "Open evidence details in the dossier side drawer." }) openEvidenceInDrawer!: boolean;
}

export class UserResponseDto {
  @ApiProperty({ example: objectIdExample }) _id!: string;
  @ApiProperty({
    example: "did:privy:cm123example",
    description: "Privy identity ID; never accepted from request input.",
  })
  privyUserId!: string;
  @ApiPropertyOptional({ example: "Ada Researcher" }) displayName?: string;
  @ApiPropertyOptional({ example: "ada@example.org" }) email?: string;
  @ApiPropertyOptional({ example: "https://res.cloudinary.com/example/image/upload/avatar.webp" }) avatarUrl?: string;
  @ApiPropertyOptional({ example: "0x1234567890abcdef1234567890abcdef12345678" }) primaryWalletAddress?: string;
  @ApiProperty({ type: UserPreferencesResponseDto }) preferences!: UserPreferencesResponseDto;
  @ApiProperty({ format: "date-time", example: "2026-08-31T09:30:00.000Z" }) createdAt!: string;
  @ApiProperty({ format: "date-time", example: "2026-08-31T09:35:00.000Z" }) updatedAt!: string;
}

export class DeleteAccountResponseDto {
  @ApiProperty({ enum: [true], description: "Confirms deletion of Capela data and the Privy identity." })
  deleted!: true;
}

export class AccountSessionResponseDto {
  @ApiProperty({ example: "privy-session-id" }) id!: string;
  @ApiProperty({ description: "Whether this is the session making the request." }) current!: boolean;
  @ApiProperty({ example: "Mac" }) deviceName!: string;
  @ApiProperty({ example: "macOS" }) platform!: string;
  @ApiProperty({ example: "Chrome" }) browser!: string;
  @ApiPropertyOptional({ example: "Mozilla/5.0 ..." }) userAgentSummary?: string;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) lastUsedAt!: string;
  @ApiProperty({ format: "date-time" }) expiresAt!: string;
}

export class RevokeSessionsResponseDto {
  @ApiProperty({ minimum: 0, example: 2 }) revokedCount!: number;
}

export class AccessResponseDto {
  @ApiProperty({ description: "Whether Base payment-gated investigations are enabled." }) paymentsEnabled!: boolean;
  @ApiProperty({ description: "True during the payment-disabled preview, when investigations are unrestricted." })
  unlimitedInvestigations!: boolean;
  @ApiProperty() freeInvestigationAvailable!: boolean;
  @ApiProperty({ example: 3 }) freeInvestigationsLimit!: number;
  @ApiProperty({ minimum: 0, example: 1 }) freeInvestigationsUsedToday!: number;
  @ApiProperty({ minimum: 0, example: 2 }) freeInvestigationsRemaining!: number;
  @ApiProperty({ format: "date-time", description: "Next 00:00 UTC allowance reset." })
  freeInvestigationsResetAt!: string;
  @ApiProperty() paymentRequired!: boolean;
  @ApiProperty({ example: "0", description: "Native Base amount in wei, represented as a decimal string." })
  priceWei!: string;
  @ApiProperty({ example: 84532 }) chainId!: number;
  @ApiPropertyOptional({ example: "0x1234567890abcdef1234567890abcdef12345678" }) paymentReceiverAddress?: string;
  @ApiPropertyOptional({ example: objectIdExample }) verifiedPaymentId?: string;
}

export class MoleculeDescriptionDto {
  @ApiProperty({ example: "A PubChem-supplied chemical description." }) text!: string;
  @ApiPropertyOptional({ example: "PubChem" }) sourceName?: string;
  @ApiPropertyOptional({ format: "uri" }) sourceUrl?: string;
}

export class MoleculeSnapshotDto {
  @ApiProperty({ example: 2244 }) pubchemCid!: number;
  @ApiProperty({ example: "Aspirin" }) preferredName!: string;
  @ApiProperty({ type: [String], example: ["Acetylsalicylic acid"] }) synonyms!: string[];
  @ApiPropertyOptional({ example: "C9H8O4" }) molecularFormula?: string;
  @ApiPropertyOptional({ example: "180.16" }) molecularWeight?: string;
  @ApiPropertyOptional({ example: "CC(=O)OC1=CC=CC=C1C(=O)O" }) canonicalSmiles?: string;
  @ApiPropertyOptional() isomericSmiles?: string;
  @ApiPropertyOptional() inchi?: string;
  @ApiPropertyOptional() inchiKey?: string;
  @ApiProperty({ format: "uri" }) structure2dUrl!: string;
  @ApiProperty({ format: "uri" }) pubchemUrl!: string;
  @ApiPropertyOptional({ type: MoleculeDescriptionDto }) description?: MoleculeDescriptionDto;
}

export class PaperSnapshotDto {
  @ApiProperty({ example: "pmid:12345678" }) id!: string;
  @ApiProperty({ example: "PubMed" }) source!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: [String] }) authors!: string[];
  @ApiPropertyOptional() authorString?: string;
  @ApiPropertyOptional() journal?: string;
  @ApiPropertyOptional({ example: 2024 }) year?: number;
  @ApiPropertyOptional({ example: "10.1000/example" }) doi?: string;
  @ApiPropertyOptional() pmid?: string;
  @ApiPropertyOptional() pmcid?: string;
  @ApiPropertyOptional({ description: "Retrieved abstract used for evidence extraction when selected." })
  abstract?: string;
  @ApiProperty({ type: [String] }) publicationTypes!: string[];
  @ApiProperty({ enum: ["review", "meta_analysis", "clinical_trial", "journal_article", "unclassified"] })
  studyType!: string;
  @ApiPropertyOptional({ minimum: 0 }) citationCount?: number;
  @ApiProperty() fullTextAvailable!: boolean;
  @ApiProperty() openAccess!: boolean;
  @ApiProperty({ format: "uri" }) externalUrl!: string;
  @ApiProperty({ minimum: 0 }) relevanceScore!: number;
  @ApiProperty({ type: [String] }) relevanceReasons!: string[];
  @ApiProperty({ type: [String] }) matchedQueries!: string[];
}

export class ExtractedSourceContextDto {
  @ApiProperty() source!: string;
  @ApiProperty() context!: string;
}

export class ExtractedActivityDto {
  @ApiProperty() activity!: string;
  @ApiProperty() finding!: string;
  @ApiProperty({ nullable: true }) model!: string | null;
  @ApiProperty({ nullable: true }) measuredOutcome!: string | null;
  @ApiProperty({ enum: EVIDENCE_TYPES }) evidenceType!: string;
  @ApiProperty({ enum: ["high", "medium", "low"] }) confidence!: string;
}

export class ExtractedTargetDto {
  @ApiProperty() target!: string;
  @ApiProperty({ enum: TARGET_RELATIONSHIPS }) relationship!: string;
  @ApiProperty() finding!: string;
  @ApiProperty() directExperimentalConfirmation!: boolean;
  @ApiProperty({ enum: EVIDENCE_TYPES }) evidenceType!: string;
  @ApiProperty({ enum: ["high", "medium", "low"] }) confidence!: string;
}

export class ExtractedMechanismDto {
  @ApiProperty() finding!: string;
  @ApiProperty({ nullable: true }) pathway!: string | null;
  @ApiProperty({ nullable: true }) molecularEvent!: string | null;
  @ApiProperty({ nullable: true }) cellularEffect!: string | null;
  @ApiProperty({ nullable: true }) biologicalOutcome!: string | null;
  @ApiProperty({ enum: EVIDENCE_TYPES }) evidenceType!: string;
  @ApiProperty({ enum: ["high", "medium", "low"] }) confidence!: string;
}

export class PaperEvidenceDto {
  @ApiProperty() paperId!: string;
  @ApiProperty({ enum: ["abstract"] }) analyzedSource!: "abstract";
  @ApiProperty({ enum: ["high", "medium", "supporting", "low"] }) relevance!: string;
  @ApiProperty({
    enum: [
      "experimental_in_vitro",
      "experimental_in_vivo",
      "clinical",
      "computational",
      "review",
      "observational",
      "other",
    ],
  })
  studyType!: string;
  @ApiProperty({ type: [ExtractedSourceContextDto] }) sourceContexts!: ExtractedSourceContextDto[];
  @ApiProperty({ type: [ExtractedActivityDto] }) activities!: ExtractedActivityDto[];
  @ApiProperty({ type: [ExtractedTargetDto] }) targets!: ExtractedTargetDto[];
  @ApiProperty({ type: [ExtractedMechanismDto] }) mechanisms!: ExtractedMechanismDto[];
  @ApiProperty({ type: [String] }) limitations!: string[];
}

export class EvidenceClaimDto {
  @ApiProperty() id!: string;
  @ApiProperty() paperId!: string;
  @ApiProperty({ enum: ["source_context", "activity", "target", "mechanism"] }) kind!: string;
  @ApiProperty() finding!: string;
  @ApiProperty({ enum: EVIDENCE_TYPES }) evidenceType!: string;
  @ApiProperty({ enum: ["high", "medium", "low"] }) confidence!: string;
  @ApiProperty({
    enum: [
      "experimental_in_vitro",
      "experimental_in_vivo",
      "clinical",
      "computational",
      "review",
      "observational",
      "other",
    ],
  })
  studyType!: string;
  @ApiProperty({ enum: ["abstract"] }) analyzedSource!: "abstract";
  @ApiPropertyOptional() activity?: string;
  @ApiPropertyOptional() originalActivity?: string;
  @ApiPropertyOptional() model?: string;
  @ApiPropertyOptional() measuredOutcome?: string;
  @ApiPropertyOptional() target?: string;
  @ApiPropertyOptional() originalTarget?: string;
  @ApiPropertyOptional({ enum: TARGET_RELATIONSHIPS }) relationship?: string;
  @ApiPropertyOptional() directExperimentalConfirmation?: boolean;
  @ApiPropertyOptional() pathway?: string;
  @ApiPropertyOptional() molecularEvent?: string;
  @ApiPropertyOptional() cellularEffect?: string;
  @ApiPropertyOptional() biologicalOutcome?: string;
  @ApiPropertyOptional() source?: string;
}

export class BiologicalActivitySummaryDto {
  @ApiProperty() name!: string;
  @ApiProperty({ type: [String] }) originalNames!: string[];
  @ApiProperty() summary!: string;
  @ApiProperty({ enum: ["Strong", "Moderate", "Limited", "Insufficient"] }) strength!: string;
  @ApiProperty({ type: [String] }) supportingEvidenceIds!: string[];
  @ApiProperty({ type: [String] }) supportingPaperIds!: string[];
  @ApiProperty({ type: [String] }) studyModels!: string[];
  @ApiProperty({ minimum: 0 }) experimentalCount!: number;
  @ApiProperty({ minimum: 0 }) computationalCount!: number;
  @ApiProperty({ type: [String] }) conflicts!: string[];
}

export class TargetSummaryDto {
  @ApiProperty() target!: string;
  @ApiProperty() normalizedTarget!: string;
  @ApiProperty({ type: [String] }) originalNames!: string[];
  @ApiProperty({ enum: TARGET_RELATIONSHIPS }) relationship!: string;
  @ApiProperty() summary!: string;
  @ApiProperty() directExperimentalConfirmation!: boolean;
  @ApiProperty({ enum: ["Strong", "Moderate", "Limited", "Insufficient"] }) strength!: string;
  @ApiProperty({ enum: EVIDENCE_TYPES, isArray: true }) evidenceTypes!: string[];
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
  @ApiProperty({ type: [String] }) paperIds!: string[];
  @ApiProperty({ type: [String] }) conflicts!: string[];
}

export class SourceContextSummaryDto {
  @ApiProperty() source!: string;
  @ApiProperty({ type: [String] }) contexts!: string[];
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
  @ApiProperty({ type: [String] }) paperIds!: string[];
}

export class EvidenceConflictDto {
  @ApiProperty({ enum: ["activity", "target"] }) scope!: string;
  @ApiProperty() label!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
  @ApiProperty({ type: [String] }) paperIds!: string[];
}

export class PaperLimitationsDto {
  @ApiProperty() paperId!: string;
  @ApiProperty({ type: [String] }) items!: string[];
}

export class InvestigationAnalysisDto {
  @ApiProperty({ type: [BiologicalActivitySummaryDto] }) activities!: BiologicalActivitySummaryDto[];
  @ApiProperty({ type: [TargetSummaryDto] }) targets!: TargetSummaryDto[];
  @ApiProperty({ type: [SourceContextSummaryDto] }) sourceContexts!: SourceContextSummaryDto[];
  @ApiProperty({ type: [EvidenceConflictDto] }) conflicts!: EvidenceConflictDto[];
  @ApiProperty({ type: [PaperLimitationsDto] }) limitations!: PaperLimitationsDto[];
}

export class MechanismEdgeDto {
  @ApiProperty() id!: string;
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: EVIDENCE_TYPES }) evidenceType!: string;
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
  @ApiProperty({ type: [String] }) paperIds!: string[];
}

export class MechanismResultDto {
  @ApiProperty({ enum: ["supported", "partially_supported", "insufficient_evidence", "conflicting_evidence"] })
  status!: string;
  @ApiProperty() summary!: string;
  @ApiProperty({ type: [MechanismEdgeDto] }) edges!: MechanismEdgeDto[];
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
  @ApiProperty({ type: [String] }) paperIds!: string[];
}

export class ResearchAssessmentBasisDto {
  @ApiProperty({ minimum: 0 }) papersAnalyzed!: number;
  @ApiProperty({ minimum: 0 }) abstractOnlyPapers!: number;
  @ApiProperty({ minimum: 0 }) directExperimentalPapers!: number;
  @ApiProperty({ minimum: 0 }) indirectExperimentalPapers!: number;
  @ApiProperty({ minimum: 0 }) computationalPapers!: number;
  @ApiProperty({ minimum: 0 }) literatureReportedPapers!: number;
  @ApiProperty({ minimum: 0 }) directlyConfirmedTargets!: number;
  @ApiProperty({ enum: ["supported", "partially_supported", "insufficient_evidence", "conflicting_evidence"] })
  mechanismStatus!: string;
}

export class ResearchAssessmentDto {
  @ApiProperty({ enum: ["Strong", "Moderate", "Limited", "Insufficient"] }) overallStrength!: string;
  @ApiProperty({ minimum: 0, maximum: 100 }) score!: number;
  @ApiProperty({ enum: ["Strong", "Moderate", "Limited", "Insufficient"] }) biologicalActivityEvidence!: string;
  @ApiProperty({ enum: ["Strong", "Moderate", "Limited", "Insufficient"] }) targetEvidence!: string;
  @ApiProperty({ enum: ["Strong", "Moderate", "Limited", "Insufficient"] }) mechanisticEvidence!: string;
  @ApiProperty({ enum: ["consistent", "mixed", "conflicting", "insufficient"] }) consistency!: string;
  @ApiProperty({ type: [String] }) strongestEvidence!: string[];
  @ApiProperty({ type: [String] }) majorEvidenceGaps!: string[];
  @ApiProperty({ type: [EvidenceConflictDto] }) conflicts!: EvidenceConflictDto[];
  @ApiProperty() explanation!: string;
  @ApiProperty({ type: ResearchAssessmentBasisDto }) basis!: ResearchAssessmentBasisDto;
}

export class DossierLiteratureEntryDto extends PaperSnapshotDto {
  @ApiProperty({ enum: ["abstract", "not_analyzed"] }) analyzedSource!: string;
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
  @ApiProperty({ enum: EVIDENCE_TYPES, isArray: true }) evidenceTypes!: string[];
  @ApiProperty({ type: [String] }) extractedFindings!: string[];
}

export class DossierOverviewDto {
  @ApiProperty({ type: MoleculeSnapshotDto }) molecule!: MoleculeSnapshotDto;
}

export class DossierSourcesDto {
  @ApiProperty({ type: [SourceContextSummaryDto] }) items!: SourceContextSummaryDto[];
  @ApiProperty({ type: [String] }) paperIds!: string[];
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
}

export class DossierActivitiesDto {
  @ApiProperty({ type: [BiologicalActivitySummaryDto] }) items!: BiologicalActivitySummaryDto[];
  @ApiProperty({ type: [String] }) paperIds!: string[];
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
}

export class DossierTargetsDto {
  @ApiProperty({ type: [TargetSummaryDto] }) items!: TargetSummaryDto[];
  @ApiProperty({ type: [String] }) paperIds!: string[];
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
}

export class DossierLiteratureDto {
  @ApiProperty({ type: [DossierLiteratureEntryDto] }) items!: DossierLiteratureEntryDto[];
  @ApiProperty({ type: [String] }) paperIds!: string[];
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
}

export class EvidenceDistributionDto {
  @ApiProperty({ minimum: 0 }) direct_experimental!: number;
  @ApiProperty({ minimum: 0 }) indirect_experimental!: number;
  @ApiProperty({ minimum: 0 }) computational_prediction!: number;
  @ApiProperty({ minimum: 0 }) literature_reported!: number;
  @ApiProperty({ minimum: 0 }) capela_inference!: number;
  @ApiProperty({ minimum: 0 }) insufficient!: number;
}

export class DossierEvidenceDto {
  @ApiProperty({ type: EvidenceDistributionDto }) distribution!: EvidenceDistributionDto;
  @ApiProperty({ type: [EvidenceClaimDto] }) examples!: EvidenceClaimDto[];
  @ApiProperty({ type: [String] }) paperIds!: string[];
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
}

export class DossierAssessmentDto extends ResearchAssessmentDto {
  @ApiProperty({ type: [String] }) paperIds!: string[];
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
}

export class CapelaDossierDto {
  @ApiProperty({ format: "date-time" }) generatedAt!: string;
  @ApiProperty({ type: DossierOverviewDto }) overview!: DossierOverviewDto;
  @ApiProperty({ type: DossierSourcesDto }) sources!: DossierSourcesDto;
  @ApiProperty({ type: DossierActivitiesDto }) biologicalActivity!: DossierActivitiesDto;
  @ApiProperty({ type: DossierTargetsDto }) molecularTargets!: DossierTargetsDto;
  @ApiProperty({ type: MechanismResultDto }) mechanism!: MechanismResultDto;
  @ApiProperty({ type: DossierLiteratureDto }) literature!: DossierLiteratureDto;
  @ApiProperty({ type: DossierEvidenceDto }) evidenceVsPrediction!: DossierEvidenceDto;
  @ApiProperty({ type: DossierAssessmentDto }) researchAssessment!: DossierAssessmentDto;
}

export class InvestigationProgressResponseDto {
  @ApiProperty() message!: string;
  @ApiProperty({ minimum: 0 }) papersDiscovered!: number;
  @ApiProperty({ minimum: 0 }) papersSelected!: number;
  @ApiProperty({ minimum: 0 }) papersAnalyzed!: number;
  @ApiProperty({ minimum: 0 }) experimentalFindings!: number;
  @ApiProperty({ minimum: 0 }) computationalFindings!: number;
  @ApiProperty({ minimum: 0 }) targetsEvaluated!: number;
}

export class InvestigationAccessResponseDto {
  @ApiProperty({ enum: ["free", "paid"] }) type!: string;
  @ApiPropertyOptional({ example: objectIdExample }) paymentId?: string;
}

export class InvestigationErrorResponseDto {
  @ApiProperty({ example: "AI_UNAVAILABLE" }) code!: string;
  @ApiProperty({ example: "Scientific evidence analysis is temporarily unavailable across configured providers." })
  message!: string;
}

export class InvestigationResponseDto {
  @ApiProperty({ example: objectIdExample }) _id!: string;
  @ApiProperty({ example: objectIdExample, description: "Internal owner reference." }) userId!: string;
  @ApiProperty({ example: "aspirin" }) originalInput!: string;
  @ApiProperty({ enum: INVESTIGATION_STATUSES }) status!: string;
  @ApiProperty({ type: InvestigationProgressResponseDto }) progress!: InvestigationProgressResponseDto;
  @ApiPropertyOptional({ type: MoleculeSnapshotDto }) molecule?: MoleculeSnapshotDto;
  @ApiProperty({ type: [PaperSnapshotDto] }) papers!: PaperSnapshotDto[];
  @ApiProperty({ type: [PaperEvidenceDto], description: "Validated structured extraction grouped by retrieved paper." })
  paperEvidence!: PaperEvidenceDto[];
  @ApiProperty({ type: [EvidenceClaimDto] }) evidence!: EvidenceClaimDto[];
  @ApiPropertyOptional({ type: InvestigationAnalysisDto }) analysis?: InvestigationAnalysisDto;
  @ApiPropertyOptional({ type: MechanismResultDto }) mechanism?: MechanismResultDto;
  @ApiPropertyOptional({ type: CapelaDossierDto }) dossier?: CapelaDossierDto;
  @ApiPropertyOptional({ type: ResearchAssessmentDto }) assessment?: ResearchAssessmentDto;
  @ApiProperty({ type: InvestigationAccessResponseDto }) access!: InvestigationAccessResponseDto;
  @ApiPropertyOptional({ type: InvestigationErrorResponseDto }) error?: InvestigationErrorResponseDto;
  @ApiPropertyOptional({ format: "date-time" }) startedAt?: string;
  @ApiPropertyOptional({ format: "date-time" }) completedAt?: string;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

export class NotificationMetadataDto {
  @ApiProperty({ example: objectIdExample }) investigationId!: string;
  @ApiProperty({ example: "Aspirin" }) molecule!: string;
  @ApiPropertyOptional({ example: "AI_UNAVAILABLE" }) failureCode?: string;
}

export class NotificationResponseDto {
  @ApiProperty({ example: objectIdExample }) _id!: string;
  @ApiProperty({ enum: ["INVESTIGATION_COMPLETED", "INVESTIGATION_FAILED"] }) type!: string;
  @ApiProperty({ example: "Dossier ready" }) title!: string;
  @ApiProperty() message!: string;
  @ApiPropertyOptional({ example: `/dashboard/investigations/${objectIdExample}` }) actionUrl?: string;
  @ApiProperty({ type: NotificationMetadataDto }) metadata!: NotificationMetadataDto;
  @ApiPropertyOptional({ format: "date-time", description: "Absent until the notification has been read." })
  readAt?: string;
  @ApiProperty({ example: "NOT_CONFIGURED" }) emailStatus!: string;
  @ApiProperty({ minimum: 0 }) emailAttempts!: number;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

export class NotificationPaginationDto {
  @ApiPropertyOptional({ nullable: true, example: objectIdExample }) nextCursor!: string | null;
  @ApiPropertyOptional({ nullable: true, example: null }) previousCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty({ minimum: 1, maximum: 100, example: 20 }) limit!: number;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] }) data!: NotificationResponseDto[];
  @ApiProperty({ type: NotificationPaginationDto }) pagination!: NotificationPaginationDto;
}

export class UnreadCountResponseDto {
  @ApiProperty({ minimum: 0 }) unreadCount!: number;
}

export class UpdatedCountResponseDto {
  @ApiProperty({ minimum: 0 }) updatedCount!: number;
}

export class DeleteHistoryResponseDto {
  @ApiProperty({ minimum: 0 }) deletedCount!: number;
  @ApiProperty({ minimum: 0 }) notificationsDeletedCount!: number;
}

export class PaymentVerificationResponseDto {
  @ApiProperty({ example: objectIdExample }) id!: string;
  @ApiProperty({ pattern: "^0x[0-9a-fA-F]{64}$" }) transactionHash!: string;
  @ApiProperty({ example: 84532 }) chainId!: number;
  @ApiProperty({ example: "0x1234567890abcdef1234567890abcdef12345678" }) from!: string;
  @ApiProperty({ example: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" }) to!: string;
  @ApiProperty({ example: "100000000000000" }) amountWei!: string;
  @ApiProperty({ enum: ["verified", "consumed"] }) status!: string;
}
