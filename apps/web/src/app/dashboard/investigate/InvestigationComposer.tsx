"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Atom, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError, useAccess, useCreateInvestigation } from "@/lib/api";
import { tryNowStyles as styles } from "./try-now.styles";

type InputKind = "NAME" | "CID";

const DRAFT_KEY = "capela:investigation-draft:v1";
const examples = ["Loliolide", "Quercetin", "Caffeine", "Curcumin", "Resveratrol"];
const workflow = ["Resolve", "Search", "Read", "Classify", "Assess"];
const automaticPlan = [
  {
    label: "Identity",
    title: "PubChem resolution",
    detail: "Names, synonyms, structure, and identifiers come from chemical records.",
  },
  {
    label: "Literature",
    title: "Scientific retrieval",
    detail: "Capela discovers, deduplicates, and ranks relevant studies.",
  },
  {
    label: "Evidence",
    title: "Claim classification",
    detail: "Experiments, predictions, reports, and inference stay distinct.",
  },
  {
    label: "Output",
    title: "Complete dossier",
    detail: "The result includes source-linked findings, gaps, and assessment.",
  },
] as const;

export function InvestigationComposer({ initialMolecule = "" }: { initialMolecule?: string }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [molecule, setMolecule] = useState(initialMolecule);
  const [inputKind, setInputKind] = useState<InputKind>(/^\d+$/.test(initialMolecule.trim()) ? "CID" : "NAME");
  const [online, setOnline] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const access = useAccess();
  const createInvestigation = useCreateInvestigation();

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const initializationFrame = window.requestAnimationFrame(() => {
      setOnline(navigator.onLine);
      if (!initialMolecule.trim()) {
        try {
          const draft = window.sessionStorage.getItem(DRAFT_KEY)?.trim();
          if (draft) {
            setMolecule(draft);
            setInputKind(/^\d+$/.test(draft) ? "CID" : "NAME");
          }
        } catch {
          window.sessionStorage.removeItem(DRAFT_KEY);
        }
      }
      setDraftReady(true);
    });
    return () => {
      window.cancelAnimationFrame(initializationFrame);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [initialMolecule]);

  useEffect(() => {
    if (!draftReady) return;
    try {
      if (molecule.trim()) window.sessionStorage.setItem(DRAFT_KEY, molecule);
      else window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Draft persistence is best-effort and never blocks an investigation.
    }
  }, [draftReady, molecule]);

  const runActive = Boolean(access.data && !access.data.freeInvestigationAvailable);
  const busy = createInvestigation.isPending || access.isPending;
  const meterLimit = Math.max(access.data?.freeInvestigationsLimit ?? 3, 1);
  const meterAvailable = access.data?.unlimitedInvestigations
    ? meterLimit
    : Math.max(access.data?.freeInvestigationsRemaining ?? 0, 0);
  const resetLabel = access.data
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(
        new Date(access.data.freeInvestigationsResetAt),
      )
    : null;

  const mutationError = createInvestigation.error;
  const mutationMessage =
    mutationError instanceof ApiError
      ? mutationError.message
      : mutationError instanceof Error
        ? mutationError.message
        : "Capela could not create the investigation.";

  async function investigate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const originalInput = molecule.trim();
    if (!originalInput) {
      setValidationError("Enter a molecule name or PubChem CID.");
      return;
    }
    if (originalInput.length > 200) {
      setValidationError("Molecule input must be 200 characters or fewer.");
      return;
    }
    if (inputKind === "CID" && !/^\d+$/.test(originalInput)) {
      setValidationError("A PubChem CID contains numbers only.");
      return;
    }
    if (runActive) return;

    setValidationError(null);
    try {
      const investigation = await createInvestigation.mutateAsync({ originalInput });
      window.sessionStorage.removeItem(DRAFT_KEY);
      router.push(`/dashboard/investigations/${investigation._id}`);
    } catch {
      // The mutation state renders the API's designed error below.
    }
  }

  function chooseInputKind(kind: InputKind) {
    setInputKind(kind);
    setMolecule("");
    setValidationError(null);
    createInvestigation.reset();
  }

  function chooseExample(example: string) {
    setInputKind("NAME");
    setMolecule(example);
    setValidationError(null);
    createInvestigation.reset();
  }

  return (
    <div className={styles.page}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute -top-32 left-[5%] size-[28rem] rounded-full bg-[#9fad7c]/15 blur-[100px]"
          animate={reducedMotion ? undefined : { x: [0, 90, -20, 0], y: [0, 55, 20, 0], scale: [1, 1.15, 0.95, 1] }}
          transition={{ duration: 16, ease: "easeInOut", repeat: Infinity }}
        />
        <motion.div
          className="absolute top-[22rem] right-[-8rem] size-[30rem] rounded-full bg-[#79b493]/[.08] blur-[110px]"
          animate={reducedMotion ? undefined : { x: [0, -70, 15, 0], y: [0, -35, 45, 0], scale: [1, 0.9, 1.1, 1] }}
          transition={{ duration: 19, ease: "easeInOut", repeat: Infinity }}
        />
      </div>

      <motion.header
        className={styles.header}
        style={{ paddingBlock: 20 }}
        initial={reducedMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <span>
            <Sparkles aria-hidden="true" size={13} /> New investigation
          </span>
          <span>Evidence first</span>
        </div>
        <h1>Bring the molecule. Leave with the evidence picture.</h1>
        <p>
          Enter a name or PubChem CID. Capela resolves the chemical identity, retrieves the literature, extracts and
          validates findings, then explains what is supported, predicted, inferred, or still uncertain.
        </p>
        <div className="mt-8 flex max-w-3xl items-center gap-2 overflow-hidden" aria-label="Investigation workflow">
          {workflow.map((stage, index) => (
            <div className="flex min-w-0 flex-1 items-center gap-2" key={stage}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#c8d1aa]/20 bg-[#9fad7c]/10 text-[10px] font-semibold text-[#c8d1aa]">
                {index + 1}
              </span>
              <span className="hidden truncate text-[10px] text-white/40 md:block">{stage}</span>
              {index < workflow.length - 1 && (
                <motion.span
                  className="h-px min-w-3 flex-1 bg-gradient-to-r from-[#9fad7c]/45 to-white/[.06]"
                  animate={reducedMotion ? undefined : { opacity: [0.25, 1, 0.25] }}
                  transition={{ delay: index * 0.18, duration: 1.8, repeat: Infinity }}
                />
              )}
            </div>
          ))}
        </div>
      </motion.header>

      <div className={styles.workspace}>
        <motion.form
          className={styles.composer}
          onSubmit={(event) => void investigate(event)}
          noValidate
          initial={reducedMotion ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <section className={styles.allowance} aria-live="polite">
            <div>
              <span>{access.data?.unlimitedInvestigations ? "Preview access" : "Today’s free allowance"}</span>
              <strong>
                {access.isPending
                  ? "Checking your available investigations…"
                  : access.data?.unlimitedInvestigations
                    ? "Investigations are free during preview"
                    : access.data
                      ? `${access.data.freeInvestigationsRemaining} of ${access.data.freeInvestigationsLimit} free investigations remaining today`
                      : "Access status is temporarily unavailable"}
              </strong>
              {access.data && (
                <p>
                  {access.data.unlimitedInvestigations
                    ? "No payment prompt is shown. One investigation can run at a time."
                    : `Daily access resets at ${resetLabel}.`}
                </p>
              )}
              {access.isError && <p>Capela will still validate access securely when you submit.</p>}
            </div>
            {access.data && (
              <div
                className={styles.allowanceMeter}
                aria-label={
                  access.data.unlimitedInvestigations
                    ? "Free preview access active"
                    : `${meterAvailable} of ${meterLimit} investigations remaining`
                }
              >
                {Array.from({ length: meterLimit }, (_, index) => (
                  <span key={index} data-available={index < meterAvailable} />
                ))}
              </div>
            )}
          </section>

          {!online && (
            <p className={styles.connectionNotice} role="status">
              You are offline. This molecule draft is saved in this browser tab; reconnect before submitting.
            </p>
          )}

          <fieldset className={styles.modePicker}>
            <legend>Choose how you want to identify the molecule</legend>
            <label>
              <input
                type="radio"
                name="input-kind"
                value="NAME"
                checked={inputKind === "NAME"}
                onChange={() => chooseInputKind("NAME")}
              />
              <span>
                <strong>Molecule name</strong>
                <small>Use a common, preferred, or recognized synonym.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="input-kind"
                value="CID"
                checked={inputKind === "CID"}
                onChange={() => chooseInputKind("CID")}
              />
              <span>
                <strong>PubChem CID</strong>
                <small>Use the exact numeric compound identifier from PubChem.</small>
              </span>
            </label>
          </fieldset>

          <div className={styles.tabs} role="tablist" aria-label="Example molecules">
            {examples.map((example) => {
              const active = inputKind === "NAME" && molecule.toLocaleLowerCase() === example.toLocaleLowerCase();
              return (
                <button
                  aria-selected={active}
                  className={active ? styles.activeTab : undefined}
                  key={example}
                  onClick={() => chooseExample(example)}
                  role="tab"
                  type="button"
                >
                  <Atom aria-hidden="true" size={16} />
                  {example}
                </button>
              );
            })}
          </div>

          <input type="hidden" name="identifier-type" value={inputKind} />

          <div className={styles.primaryInput}>
            <label htmlFor="molecule-input">
              {inputKind === "CID" ? "PubChem compound identifier" : "Molecule name"}
            </label>
            <input
              autoFocus
              id="molecule-input"
              inputMode={inputKind === "CID" ? "numeric" : "text"}
              maxLength={200}
              placeholder={inputKind === "CID" ? "Enter a numeric CID, e.g. 2519" : "Enter a molecule, e.g. Loliolide"}
              value={molecule}
              aria-describedby={validationError ? "molecule-input-error" : undefined}
              aria-invalid={Boolean(validationError)}
              onChange={(event) => {
                setMolecule(event.target.value);
                setValidationError(null);
                createInvestigation.reset();
              }}
            />
            {validationError && (
              <p className={styles.fieldError} id="molecule-input-error">
                {validationError}
              </p>
            )}
          </div>

          <div className={styles.options} aria-label="Automatic investigation plan">
            {automaticPlan.map((item) => (
              <div className={styles.automaticField} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>

          {access.isError && (
            <div className={styles.errorState} role="alert">
              <strong>ACCESS_UNAVAILABLE</strong>
              <p>Capela could not load the access summary. The API will verify access again if you submit.</p>
            </div>
          )}

          {mutationError && (
            <div className={styles.errorState} role="alert">
              <strong>
                {mutationError instanceof ApiError
                  ? mutationError.code || "INVESTIGATION_FAILED"
                  : "INVESTIGATION_FAILED"}
              </strong>
              <p>{mutationMessage}</p>
            </div>
          )}

          {runActive && (
            <div className={styles.activeState} role="status">
              <strong>INVESTIGATION_ACTIVE</strong>
              <p>One investigation is already running. Open the archive to follow its progress.</p>
              <Link href="/dashboard/investigations">Follow progress →</Link>
            </div>
          )}

          <div className={styles.submitRow}>
            <span>
              {runActive
                ? "Wait for the active investigation to finish before starting another"
                : "Invalid input and pipeline failures do not count as completed investigations"}
            </span>
            <button type="submit" disabled={busy || !molecule.trim() || runActive || !online}>
              {createInvestigation.isPending ? "Creating investigation…" : "Run investigation"}
            </button>
          </div>
        </motion.form>

        <motion.aside
          className={styles.guidance}
          initial={reducedMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.22 }}
        >
          <div>
            <span>Evidence behavior</span>
            <h2>A transparent investigation from start to finish.</h2>
          </div>
          <dl>
            <div>
              <dt>Identity</dt>
              <dd>Chemical identifiers come from PubChem, never model memory.</dd>
            </div>
            <div>
              <dt>Sources</dt>
              <dd>Every scientific finding stays mapped to retrieved literature.</dd>
            </div>
            <div>
              <dt>Uncertainty</dt>
              <dd>Evidence gaps, disagreement, and unsupported mechanisms remain explicit.</dd>
            </div>
            <div>
              <dt>Classification</dt>
              <dd>Experimental evidence never collapses into computational prediction.</dd>
            </div>
          </dl>
          <div className={styles.limit}>
            <span>Input guidance</span>
            <p>Use one unambiguous molecule name or numeric PubChem CID, up to 200 characters.</p>
            <p>Capela performs one complete investigation automatically; no research prompt is required.</p>
            <p>
              Payments are disabled during preview, so Capela does not show a payment or upgrade action. Only one active
              investigation can run per account.
            </p>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
