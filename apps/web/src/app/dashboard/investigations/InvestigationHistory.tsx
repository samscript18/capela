"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useInvestigations, type ApiInvestigation } from "@/lib/api";
import NewInvestigationButton from "./NewInvestigationButton";
import { investigationHistoryStyles as styles } from "./investigations.styles";

type ArchiveStatus = "" | "PROCESSING" | "completed" | "failed";

const statusOptions: Array<{ label: string; value: ArchiveStatus }> = [
  { label: "All states", value: "" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function matchesStatus(record: ApiInvestigation, status: ArchiveStatus) {
  if (!status) return true;
  if (status === "PROCESSING") return record.status !== "completed" && record.status !== "failed";
  return record.status === status;
}

function moleculeSource(record: ApiInvestigation) {
  return record.molecule?.pubchemCid ? `PubChem ${record.molecule.pubchemCid}` : "User input";
}

export default function InvestigationHistory() {
  const [status, setStatus] = useState<ArchiveStatus>("");
  const history = useInvestigations();
  const records = history.data?.filter((record) => matchesStatus(record, status)) ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span>Investigation archive</span>
        <h1>Your evidence intelligence, organised over time.</h1>
        <p>
          Revisit every investigation, monitor live processing, and compare the evidence records that informed your
          previous research.
        </p>
      </header>

      <div className={styles.filters} style={{ marginBottom: 16 }}>
        <label htmlFor="history-status" className="my-auto">
          Status
        </label>
        <select id="history-status" value={status} onChange={(event) => setStatus(event.target.value as ArchiveStatus)}>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <NewInvestigationButton className="ml-auto" />
      </div>

      {history.isPending && (
        <div className={styles.loading} aria-busy="true">
          <span>Loading archive</span>
          {[0, 1, 2].map((item) => (
            <div key={item} />
          ))}
        </div>
      )}

      {history.isError && (
        <div className={styles.error} role="alert">
          <span>Archive unavailable</span>
          <h2>Investigations could not be loaded.</h2>
          <p className="py-4">{history.error.message}</p>
          <button type="button" onClick={() => void history.refetch()}>
            Retry
          </button>
        </div>
      )}

      {history.data && records.length === 0 && (
        <div className={styles.empty}>
          <span>No matching investigations</span>
          <h2>{status ? "No cases match this status." : "Your investigation archive is empty."}</h2>
          <p className="py-4">
            Create an investigation to begin a real evidence record. Capela does not populate this archive with
            demonstration dossiers.
          </p>
          <NewInvestigationButton label="Start an investigation" />
        </div>
      )}

      {history.data && records.length > 0 && (
        <div aria-label="Investigation history table" className={styles.list} role="region" tabIndex={0}>
          <div className={styles.listHeader}>
            <span>Case</span>
            <span>Source</span>
            <span>Status</span>
            <span>Evidence</span>
            <span>Updated</span>
            <span>Action</span>
          </div>
          {records.map((record) => (
            <article className={styles.record} key={record._id}>
              <div>
                <span>{record._id}</span>
                <strong>{record.molecule?.preferredName || record.originalInput || "Untitled investigation"}</strong>
              </div>
              <span>{moleculeSource(record)}</span>
              <span data-status={record.status}>{record.status.replaceAll("_", " ")}</span>
              <span>{record.evidence?.length ?? 0}</span>
              <span>{formatDate(record.updatedAt)}</span>
              <Link
                aria-label={`Open ${record.molecule?.preferredName || record.originalInput || "investigation"}`}
                href={`/dashboard/investigations/${record._id}`}
                className="ml-0! mr-4"
              >
                <span>View</span>
                <ArrowUpRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
