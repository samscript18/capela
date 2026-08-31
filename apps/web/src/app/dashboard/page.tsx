import { Check } from "lucide-react";
import Link from "next/link";
import { HomeNewInvestigationButton } from "./HomeNewInvestigationButton";
import { HomeRecentInvestigations } from "./HomeRecentInvestigations";
import { ResearchAccessCard } from "./ResearchAccessCard";
import { homeStyles as styles } from "./home.styles";

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span>Investigation desk</span>
        <h1>Investigate a molecule before you accept the claim.</h1>
        <p>
          Give Capela a molecule. It resolves the chemical identity, reads the retrieved science, and shows what the
          evidence supports, what remains prediction, and where the gaps are.
        </p>
      </header>
      <section className={styles.composerEntry}>
        <div>
          <span>New investigation</span>
          <h2>Resolve one molecule and build its complete evidence dossier.</h2>
        </div>
        <HomeNewInvestigationButton />
      </section>
      <div className={styles.overviewGrid}>
        <section>
          <div className={styles.sectionHeader}>
            <span>Recent investigations</span>
            <Link href="/dashboard/investigations">View history</Link>
          </div>
          <HomeRecentInvestigations />
        </section>
        <aside>
          <ResearchAccessCard />
          <div className={`${styles.sectionHeader} mt-16`}>
            <span>Trust architecture</span>
          </div>
          <ul className={styles.principles}>
            <li>
              <Check aria-hidden="true" size={17} />
              Experimental evidence and prediction remain separate.
            </li>
            <li>
              <Check aria-hidden="true" size={17} />
              Missing evidence remains a limitation.
            </li>
            <li>
              <Check aria-hidden="true" size={17} />
              Capela inference is never shown as a direct experimental result.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
