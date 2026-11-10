# Participant click guide — November 10, 2026

Use the actual local Node 24 application: **http://localhost:3016** (Next.js), API **http://localhost:4016** (NestJS), existing isolated verification database on port 27944. New research is disabled in this rehearsal process; no paid operation or configuration change is needed to film. Private investigations still require normal Privy login. The API is not a filming page.

## Open these pages

| Purpose                            | Exact local URL                                           |
| ---------------------------------- | --------------------------------------------------------- |
| Six recorded capability sections   | http://localhost:3016/samples/demonstration-evidence.html |
| Authenticated saved investigations | http://localhost:3016/dashboard/investigations            |
| Read-only curcumin sample          | http://localhost:3016/samples/curcumin-2026-11-06.html    |

The exact private saved-result link was verified in the participant's signed-in browser and supplied directly in the handoff; private case IDs are omitted from this public guide. Use **Open & download** on the completed Curcumin row whose **Evidence** value is **1**. The other original completed record has two model-accepted findings; do not confuse it with the later publication revision.

## Ordered clicks in the current UI

1. Open the saved revision. Confirm **Publication revision**, one evidence claim and one candidate withheld. Stay out of **New investigation**, retry and deletion controls.
2. In **Biological activity**, click **View evidence** beside **Curcumin Regulates Ros In Tumor Cells**. The **Evidence details** panel shows **1 sourced claim**, the exact supporting quotation and **Exact passage verified**. **Open publication** links to PubMed 32141677. Close using the panel's X (**Close panel**) or Escape.
3. Scroll to **Source and review inspection → Evidence with its review trail**. Expand the **accepted** row beginning **Curcumin can regulate reactive oxygen species (ROS)…**. Expand **Inspect stored normalized abstract** to see the stored source. This is a native disclosure row, not an inference action.
4. Expand the **unresolved** row beginning **Curcumin inhibits nuclear factor kappa B…**. Show **Review verdict: supported** alongside the separate **Publication hold** and its reason. The reviewer missed the extra clause; do not describe it as an automatic reviewer rejection.
5. Return to the dossier card and click **Download dossier card**. Open the resulting **capela-curcumin-evidence-brief.png** in your image viewer. It shows one study, one evidence claim, zero experimental findings, Publication revision, one candidate withheld, abstract-only/model-assisted limits and a local revised audit. The private PNG has a case suffix; crop or avoid that footer when filming if necessary. Do not describe the export as a full dossier PDF.
6. Open the **demonstration-evidence** page. Read the six plain section labels; use the page's section links to jump. Four cards are labeled **Recorded investigation**; budget and guardrail cards are **Separate isolated check**. Expand **Request details and provenance** only when explaining identifiers; click **Open original … artifact** for the actual committed evidence.
7. Finish on the scope notice or recorded findings page. Do not run another test for the recording. Participant supplies their own screen and audio; no generated narration or staged live progress.

## Evidence-page provenance and publication

`node scripts/build-demo-evidence.cjs` generates this static page offline using explicit whitelisted fields from three existing public verification artifacts. Original links are pinned to published metadata commit **d81c03e**. No account data, credentials, raw vendor payload or private saved-result identifier is copied. The original sample/artifacts remain unchanged. The page itself is a later local addition until separately published; no deployed URL or deployment version is claimed.

The submission repository link now opens the hackathon branch directly. A read-only remote check confirmed `main` at a124872 already has an Otari architecture README, while the branch is d81c03e. No edit/push to main was necessary. Metadata publication notes are corrected; publication is not deployment.
