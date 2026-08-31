# Capela

![Capela mark](apps/web/src/app/icon.svg)

> **Give Capela a molecule. Get a sourced, evidence-graded scientific investigation.**
>
> Capela resolves a molecule, searches scientific literature, extracts reported findings, separates experiments from predictions, and returns a structured research dossier that keeps uncertainty visible.

[![Orion Agents Hackathon](https://img.shields.io/badge/Orion-Agents_Hackathon-788f68?style=flat-square)](https://orionagents.org/hackathon) [![API docs](https://img.shields.io/badge/API-OpenAPI_3-788f68?style=flat-square)](#api-documentation) [![Source](https://img.shields.io/badge/Source-GitHub-222725?style=flat-square)](https://github.com/samscript18/capela)

**Source code:** [github.com/samscript18/capela](https://github.com/samscript18/capela)

## Why Capela exists

Scientific knowledge about a molecule is rarely available in one coherent place. A researcher may need to resolve chemical identity in PubChem, search several literature indexes, compare study models, inspect targets and pathways, distinguish docking from direct binding, and trace every conclusion back to a publication.

That fragmentation creates a second problem: an answer can sound scientifically plausible while overstating what the retrieved evidence actually establishes. Computational predictions may be presented as experiments, pathway changes may be mistaken for direct binding, and a mechanism may be completed from model memory rather than demonstrated by the literature.

Capela is designed to close that gap. One molecule starts a bounded investigation that preserves the difference between retrieved facts, experimental findings, computational results, literature reports, and Capela's own synthesis.

## The submission in one sentence

Capela is an evidence-first AI molecule investigation agent that resolves chemical identity from authoritative data, retrieves scientific literature, extracts and validates paper-level findings, classifies the strength and type of evidence, and assembles a traceable eight-section research dossier.

## What makes Capela an agent

Capela is not a scientific chat box answering from model memory. It is a staged investigation with durable state, bounded provider use, deterministic validation, visible progress, retryable failures, and a strict retrieval-before-synthesis contract:

```text
receive a molecule
      ↓
resolve authoritative chemical identity
      ↓
build focused scientific queries
      ↓
retrieve and deduplicate literature
      ↓
rank and select the strongest studies
      ↓
extract paper-level structured evidence
      ↓
validate attribution and evidence classes
      ↓
analyze activities, targets, and mechanisms
      ↓
assess strength, consistency, conflicts, and gaps
      ↓
build a sourced scientific dossier
```

Each stage is persisted. The interface can show what Capela is doing, how many papers have been discovered or analyzed, and whether a terminal failure can be retried. Provider output is never accepted as scientific truth merely because it matches a schema; Capela applies independent attribution and classification rules before synthesis.

## The end-to-end experience

### 1. Give Capela a molecule

The user enters a molecule name or identifier once. Authentication is handled by Privy through email OTP, Google, or wallet. After authentication, the user is routed directly into the Capela workspace and the investigation continues without requiring a sequence of separate prompts.

### 2. Resolve chemical identity from authoritative records

Capela resolves the molecule through PubChem PUG REST. If that route is temporarily unavailable, it uses the official NCBI Entrez `pccompound` interface as a validated fallback. Names, CID, formula, molecular weight, SMILES, InChI, InChIKey, synonyms, description, and structure links come from retrieved chemical records—not an LLM.

Ambiguous, missing, invalid, and temporarily unavailable molecule states remain distinct. A network outage is retryable; it is not misreported as “molecule not found.”

### 3. Search scientific literature before asking a model to reason

Capela builds focused activity, target, mechanism, and source-context queries. Tavily searches are restricted to trusted scientific publication domains, including PubMed, PubMed Central, and Europe PMC. Results are normalized, deduplicated, ranked, and bounded before any AI analysis begins.

Publication titles, authors, journals, years, DOI values, PMID/PMCID values, and publication URLs are preserved only from retrieved records. Capela never asks a model to invent citation metadata.

### 4. Extract evidence paper by paper

Google Cloud Gemini is the primary structured evidence-analysis provider. Groq is the direct fallback when Gemini is unavailable. Responses must satisfy a strict JSON Schema and shared Zod contracts, then pass Capela's own validation for paper attribution, study type, directness, target relationship, and mechanism safety.

The stored evidence remains attached to the paper from which it was extracted. A review cannot become direct experimental evidence. Docking, molecular dynamics, QSAR, target prediction, and network pharmacology remain computational.

### 5. Separate what was measured from what was inferred

Capela uses six evidence classes throughout the product:

- **Direct experimental** — the relationship or effect was directly measured;
- **Indirect experimental** — an effect was observed, but the proposed molecular relationship was not directly established;
- **Computational prediction** — docking, molecular dynamics, QSAR, ML prediction, target prediction, or network pharmacology;
- **Literature reported** — reported or discussed without direct primary experimental evidence in the analyzed material;
- **Capela inference** — a visible synthesis across stored findings;
- **Insufficient** — the available evidence does not justify a reliable conclusion.

Pathway or expression changes do not automatically become direct molecular binding. Unsupported links stay unsupported.

### 6. Build only the mechanism the evidence permits

When the literature supports it, Capela constructs a traceable chain:

```text
molecule
  ↓
molecular event
  ↓
target or pathway
  ↓
cellular effect
  ↓
observed biological outcome
```

Every edge carries paper and evidence references. The mechanism status is one of `supported`, `partially_supported`, `insufficient_evidence`, or `conflicting_evidence`. If the chain cannot be established, the dossier says so rather than filling the gap with a plausible story.

### 7. Deliver the complete research dossier

Every completed investigation contains eight major sections:

1. Molecule overview
2. Common sources and context
3. Biological activity
4. Molecular targets
5. Mechanism of action
6. Literature evidence
7. Evidence versus prediction
8. Research assessment

Activities and targets retain their supporting evidence and paper IDs. Literature entries show what Capela analyzed and extracted. The final assessment explains the strongest evidence, major gaps, conflicts, consistency, and overall strength as **Strong**, **Moderate**, **Limited**, or **Insufficient**.

### 8. Reopen, retry, and export

Investigations remain attached to the authenticated owner. Completed dossiers can be reopened from history and include a polished summary card that can be downloaded as a high-resolution PNG. Failed runs retain their original entitlement and can be retried without being counted as successful investigations.

Notifications are generated only from real completed or failed investigation activity. Logout, history deletion, notification deletion, and permanent account deletion use explicit user confirmation where the action is consequential.

## Competitive advantage

### 1. Retrieval is structurally before synthesis

Capela does not produce an answer and search for supporting citations afterward. Chemical identity and literature are retrieved first; models analyze bounded retrieved material; deterministic validation runs before aggregation and dossier generation.

### 2. Evidence class is part of the data model

Experimental, indirect, computational, reported, inferred, and insufficient findings are not visual labels added at the end. They are persisted types used by target normalization, mechanism construction, evidence distribution, and the final assessment.

### 3. Every scientific conclusion remains traceable

Evidence claims reference retrieved paper IDs. Activity summaries, target summaries, mechanism edges, conflicts, literature entries, and assessment sections carry their supporting evidence and publication references. Unknown references fail closed.

### 4. Scientific restraint is a successful output

Capela can complete an investigation with limited evidence, conflicting findings, no directly confirmed target, or no supported mechanism. It assesses the record instead of converting uncertainty into a therapeutic or drug-development recommendation.

### 5. The system is agentic without being overbuilt

The investigation is implemented as a small, inspectable pipeline inside one NestJS application. It does not require microservices, Redis, Kafka, a vector database, an agent swarm, a proprietary orchestration framework, or an internal docking engine.

### 6. Provider failure is explicit and recoverable

Gemini, Groq, Tavily, PubChem, and NCBI failures map to bounded error states. Failed investigations are retryable, do not consume a successful free allowance, and do not silently fall back to unsupported model memory.

## Why this matters

A list of claims is not the same thing as a scientific investigation. The useful question is not only “what has been said about this molecule?” but “what was actually measured, in which model, by which study, with what degree of directness, and what remains unknown?”

Capela provides a calm operating layer for that question. It does not promise that a molecule is safe, effective, clinically useful, or commercially promising. It shows what the retrieved record supports and gives uncertainty a first-class place in the result.

## Technical strategy

```text
Next.js web application
        │
        │ REST / JSON + Privy bearer token
        ▼
NestJS API ───────────────────────── MongoDB
   │    │    │    │
   │    │    │    └──────── Cloudinary: managed profile images
   │    │    └───────────── Tavily: bounded scientific discovery
   │    └────────────────── PubChem PUG REST → NCBI Entrez fallback
   └─────────────────────── Google Cloud Gemini → Groq fallback
```

### AI and tool-use loop

1. **Resolve before research.** Search queries are built from a molecule identity obtained from authoritative chemical APIs.
2. **Retrieve before synthesis.** Models receive selected abstracts and stored metadata, not an invitation to answer from memory.
3. **Require structured output.** Gemini and Groq return JSON Schema-constrained evidence that is parsed with shared Zod contracts.
4. **Validate attribution independently.** Every extracted paper reference must exist in the retrieved set; invented references fail the batch.
5. **Correct unsafe classifications deterministically.** Computational methods, reviews, expression changes, and pathway associations cannot retain direct-binding or direct-experimental labels when the method does not support them.
6. **Aggregate conservatively.** Activities and targets are normalized while original terminology, conflicts, study models, and supporting IDs remain available.
7. **Build only supported mechanism edges.** Missing links produce partial or insufficient status instead of model-completed biology.
8. **Persist progress and terminal state.** The UI can poll a durable investigation record, reopen results, and retry failed provider runs.

### Scientific safety and account security

- Citation metadata comes only from retrieved literature records.
- Molecule identifiers and chemical properties come only from chemical-data APIs.
- Computational findings never become experimental findings automatically.
- Capela-generated synthesis is explicitly labeled `capela_inference`.
- Unsupported and conflicting mechanisms remain visible.
- Protected endpoints verify the Privy access token server-side.
- The API derives identity from the verified token and never accepts a client-supplied user ID.
- Investigation, notification, payment, session, profile, and deletion operations are owner-scoped.
- Profile images are signature- and size-validated by the API before server-side Cloudinary upload.
- API-observed Privy sessions can be listed and revoked.
- Permanent account deletion removes Capela data, the managed avatar, session records, and the Privy identity.
- Base payment verification fails closed and remains disabled unless explicitly enabled by configuration.

## Repository layout

```text
capela/
├── apps/
│   ├── api/                 # NestJS REST API, auth, users, investigations, research, payments
│   └── web/                 # Next.js App Router public site and authenticated workspace
├── packages/
│   └── shared/              # Shared scientific types, enums, and Zod evidence contracts
├── .env.example             # Blank environment contract; local secrets are never committed
├── package.json             # npm workspace commands
└── README.md
```

The runtime is intentionally direct: Next.js, NestJS, MongoDB, Privy, PubChem/NCBI, Tavily, Gemini, Groq, Cloudinary, and optional Base verification. It does not use queues, workers, Redis, vectors, embeddings, or microservices.

## Run locally

### Requirements

- Node.js 24
- npm
- MongoDB Atlas or a compatible MongoDB instance
- Privy application
- Tavily API key
- Google Cloud Gemini credentials
- Groq API key for model fallback
- Cloudinary account for custom profile images

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API runs at [http://localhost:4000](http://localhost:4000) by default.

Production builds:

```bash
npm run build
npm run start:api
```

## Environment

| Variable                      | Purpose                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`        | Canonical public web origin used by search and social metadata    |
| `NEXT_PUBLIC_API_URL`         | Browser-visible Nest API origin                                   |
| `NEXT_PUBLIC_PRIVY_APP_ID`    | Public Privy application identifier                               |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | Public Privy client identifier                                    |
| `MONGODB_URI`                 | Durable MongoDB connection string                                 |
| `PRIVY_APP_ID`                | Server-side Privy application identifier                          |
| `PRIVY_APP_SECRET`            | Server-only Privy application secret                              |
| `PRIVY_JWT_VERIFICATION_KEY`  | Optional Privy SPKI key; managed JWKS is used when omitted        |
| `TAVILY_API_KEY`              | Scientific literature discovery key                               |
| `GOOGLE_CLOUD_API_KEY`        | Vertex AI Express Mode API-key path for Gemini                    |
| `GOOGLE_CLOUD_PROJECT`        | Standard Vertex AI project path when not using Express Mode       |
| `GOOGLE_CLOUD_LOCATION`       | Vertex AI location; defaults to `global`                          |
| `GEMINI_MODEL`                | Primary structured evidence-analysis model                        |
| `GROQ_API_KEY`                | Fallback evidence-analysis provider key                           |
| `GROQ_MODEL`                  | First Groq fallback model                                         |
| `GROQ_FALLBACK_MODEL`         | Second Groq fallback model                                        |
| `CLOUDINARY_CLOUD_NAME`       | Cloudinary cloud name for managed avatars                         |
| `CLOUDINARY_API_KEY`          | Server-side Cloudinary API key                                    |
| `CLOUDINARY_API_SECRET`       | Server-only Cloudinary secret                                     |
| `PAYMENTS_ENABLED`            | Enables the dormant Base payment gate only when explicitly `true` |
| `PAYMENT_RECEIVER_ADDRESS`    | Configured Base recipient when payments are enabled               |
| `INVESTIGATION_PRICE_WEI`     | Per-investigation native Base amount in wei                       |
| `BASE_CHAIN_ID`               | Expected Base network chain ID                                    |
| `BASE_RPC_URL`                | RPC used for server-side transaction verification                 |
| `WEB_ORIGIN`                  | Exact frontend origin or comma-separated origins allowed by CORS  |
| `PORT`                        | Nest API port; normally `4000`                                    |

See [.env.example](.env.example) for the complete provider and tuning contract. Local `.env` files are ignored and their values must never be committed or printed.

## API documentation

The API publishes interactive Swagger documentation generated from its controllers and explicit request/response models:

- Swagger UI: [http://localhost:4000/docs](http://localhost:4000/docs)
- OpenAPI JSON: [http://localhost:4000/docs/openapi.json](http://localhost:4000/docs/openapi.json)
- OpenAPI YAML: [http://localhost:4000/docs/openapi.yaml](http://localhost:4000/docs/openapi.yaml)

The schema covers all backend operations and the complete nested dossier. In Swagger UI, select **Authorize** and paste a current Privy access token without the `Bearer` prefix; Swagger adds it automatically. `/health` is public. Account, session, investigation, notification, and payment operations require verified Privy authentication.

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
```

The build validates the shared scientific contracts, NestJS backend, generated OpenAPI decorators, and Next.js application. Provider calls remain bounded and production configuration is validated at API startup.