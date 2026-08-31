"use client";

import Link from "next/link";
import { useInvestigations } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { homeStyles as styles } from "./home.styles";

export function HomeRecentInvestigations() {
  const recent = useInvestigations();

  if (recent.isPending) {
    return (
      <div className={styles.recentLoading} aria-busy="true">
        <span>Loading recent cases</span>
        {[0, 1, 2].map((item) => (
          <div key={item} />
        ))}
      </div>
    );
  }

  if (recent.isError) {
    return (
      <div className={styles.recentError} role="alert">
        <span>Recent cases unavailable</span>
        <p>{recent.error.message}</p>
        <button type="button" onClick={() => void recent.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const records = recent.data.slice(0, 5);
  if (records.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span>No investigations yet</span>
        <h2>Your evidence record starts here.</h2>
        <p>
          Create an investigation to begin a real molecule research history. Capela does not seed this workspace with
          demonstration dossiers.
        </p>
      </div>
    );
  }

  return (
    <ol className={styles.recentList}>
      {records.map((record) => (
        <li key={record._id}>
          <Link href={`/dashboard/investigations/${record._id}`}>
            <div>
              <span>Case: {record._id}</span>
              <strong>{record.molecule?.preferredName || record.originalInput}</strong>
            </div>
            <dl>
              <div>
                <dt>Input</dt>
                <dd>{record.originalInput}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd data-status={record.status}>{record.status.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{record.evidence?.length ?? 0}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatDate(record.updatedAt)}</dd>
              </div>
            </dl>
          </Link>
        </li>
      ))}
    </ol>
  );
}
