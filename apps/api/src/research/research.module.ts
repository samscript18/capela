import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Investigation, InvestigationSchema } from "../investigations/schemas/investigation.schema";
import { InvestigationRunnerService } from "./investigation-runner.service";
import { PubChemService } from "./pubchem.service";
import { TavilyLiteratureService } from "./tavily-literature.service";
import { AiEvidenceService } from "./ai-evidence.service";
import { EvidenceClassifierService } from "./evidence-classifier.service";
import { MechanismService } from "./mechanism.service";
import { ResearchAssessmentService } from "./research-assessment.service";
import { DossierService } from "./dossier.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Investigation.name, schema: InvestigationSchema }]),
    NotificationsModule,
  ],
  providers: [
    PubChemService,
    TavilyLiteratureService,
    AiEvidenceService,
    EvidenceClassifierService,
    MechanismService,
    ResearchAssessmentService,
    DossierService,
    InvestigationRunnerService,
  ],
  exports: [
    PubChemService,
    TavilyLiteratureService,
    AiEvidenceService,
    EvidenceClassifierService,
    MechanismService,
    ResearchAssessmentService,
    DossierService,
    InvestigationRunnerService,
  ],
})
export class ResearchModule {}
