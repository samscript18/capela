# Capela

Capela is an evidence-first AI molecule investigation agent built for the Orion Agents Hackathon. Give it a molecule and it produces a sourced, evidence-graded scientific dossier that keeps experiments, predictions, literature reports, and Capela inferences visibly distinct.

## Architecture

Capela is a small npm-workspace monorepo:

- `apps/web` — Next.js App Router frontend
- `apps/api` — NestJS API and investigation runner
- `packages/shared` — shared Zod schemas and DTO-friendly scientific types

The production research flow is retrieval first: PubChem molecule resolution, bounded Tavily searches over trusted scientific domains, structured Gemini evidence extraction on Google Cloud, deterministic validation, and only then synthesis. PUG REST is the primary chemical-data route, with the official NCBI Entrez `pccompound` interface as a validated outage fallback. Groq is the model fallback.

## Stack

Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Privy, NestJS, MongoDB/Mongoose, Zod, Google Gen AI, Groq, Tavily, viem, and PubChem.

## Local setup

1. Install Node.js 22.4 or newer and MongoDB.
2. Run `npm install` at the repository root.
3. Copy `.env.example` to `.env.local` and configure the required services.
4. Run `npm run dev`.

The web app uses `http://localhost:3000`; the API defaults to `http://localhost:4000`.

Capela's web scripts disable Node's experimental server-side Web Storage globals so browser-only libraries cannot accidentally share `localStorage` across requests. Restart an already-running web process after changing or pulling the package scripts.

## Commands

- `npm run dev` — start web and API together
- `npm run build` — build every workspace
- `npm run format` — format maintained project files with Prettier
- `npm run format:check` — verify project formatting without writing files
- `npm run lint` — lint the monorepo
- `npm run typecheck` — type-check every workspace
- `npm test` — run workspace tests

## Environment and integrations

See `.env.example` for the complete configuration contract. Privy is the authentication authority. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on the API before using custom profile-image uploads; uploads are validated and sent to Cloudinary only by the backend. Payments are currently disabled with `PAYMENTS_ENABLED=false`, so authenticated users receive free preview access. The dormant Base verifier remains fail-closed and is only activated when that flag is explicitly enabled. No real secrets belong in source control.

## Account security

Capela records only Privy sessions that have reached its authenticated API. Settings can list those observed devices, revoke one session, or revoke every session except the current one; the API rejects a revoked session even if its browser still holds an older access token. Capela's configured email login uses a Privy one-time code, so it creates no Capela password to change. Permanent account deletion removes the user's investigations, notifications, payment records, session registry, custom Cloudinary avatar, local profile, and Privy identity.

Logout, full investigation-history deletion, and permanent account deletion are guarded by explicit confirmation dialogs. Each completed dossier also renders a self-contained evidence brief from the stored assessment, mechanism, literature, and evidence counts; the browser can download that exact card as a high-resolution PNG.

## Evidence philosophy

Capela retrieves before it synthesizes. Citation and molecule metadata come only from external records, computational findings never become experimental evidence, and unsupported mechanisms resolve to an explicit insufficient-evidence state.

## Deployment

Deploy the repository as two services:

1. On Render, leave Root Directory blank so commands run at the repository root. Use `npm ci && npm run build:api` as the Build Command, `npm run start:prod --workspace @capela/api` as the Start Command, and `/health` as the Health Check Path. The repository root is required because the API uses the root lockfile and `packages/shared` workspace.
2. On Vercel, set the Root Directory to `apps/web`, enable **Include source files outside of the Root Directory in the Build Step**, and use the Next.js Framework Preset. [`apps/web/vercel.json`](apps/web/vercel.json) deliberately uses `.next` as the Output Directory because Vercel resolves it relative to that Root Directory; do not configure `apps/web/.next`, which would resolve to `apps/web/apps/web/.next`.
3. Configure `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`, and `NEXT_PUBLIC_PRIVY_CLIENT_ID` in the frontend host.
4. Set the API's `WEB_ORIGIN` to the production frontend URL, then register that same origin in Privy.
5. Verify `/health`, authentication, and a complete Loliolide investigation.

Production API startup fails explicitly when a critical MongoDB, Privy, Cloudinary, Tavily, Gemini, Groq fallback, or CORS variable is absent or invalid. Base configuration is required only when `PAYMENTS_ENABLED=true`.

Tavily performs four bounded searches restricted to PubMed, PMC, and Europe PMC pages. Gemini Enterprise/Vertex AI (`GEMINI_MODEL`, default `gemini-2.5-flash`) is the primary evidence-extraction model; Groq is used automatically if a Gemini batch is unavailable. Both model paths use JSON Schema output and still pass responses through Capela's independent Zod, attribution, evidence-classification, and mechanism-safety validation.

For the simplest Google Cloud setup, create a Vertex AI Express Mode API key and set `GOOGLE_CLOUD_API_KEY`; no service-account file is needed in that mode. Standard Google Cloud projects remain supported through `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and Application Default Credentials. Never expose either credential path in the frontend.

## Hackathon limitations

The runner is intentionally process-local, literature and AI analysis are bounded for latency and cost, and a server restart may leave an active investigation stale. Capela does not perform docking, ADMET prediction, experiment recommendation, or clinical/drug-development assessment.
