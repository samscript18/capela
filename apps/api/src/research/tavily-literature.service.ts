import type { MoleculeSnapshot, PaperSnapshot } from "@capela/shared";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { tavily, type TavilyClient } from "@tavily/core";

const SCIENTIFIC_DOMAINS = ["pubmed.ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov", "europepmc.org"];
const RETRYABLE_STATUS_PATTERN = /\b(408|409|425|429|500|502|503|504)\b/;
type TavilySearchResult = Awaited<ReturnType<TavilyClient["search"]>>["results"][number];

export type LiteratureSearchResult = {
  queries: string[];
  discoveredCount: number;
  papers: PaperSnapshot[];
};

export class TavilyLiteratureError extends Error {
  constructor(
    readonly code: "TAVILY_NOT_CONFIGURED" | "TAVILY_UNAVAILABLE" | "TAVILY_INVALID_RESPONSE",
    message: string,
  ) {
    super(message);
  }
}

type TavilyCandidate = {
  result: TavilySearchResult;
  query: string;
};

@Injectable()
export class TavilyLiteratureService {
  private readonly client?: TavilyClient;
  private readonly timeoutMs: number;
  private readonly maxDiscovered: number;
  private readonly maxSelected: number;
  private readonly searchDepth: "basic" | "advanced";

  constructor(config: ConfigService) {
    const apiKey = config.get<string>("TAVILY_API_KEY")?.trim();
    if (apiKey) this.client = tavily({ apiKey, clientName: "capela" });
    this.timeoutMs = this.boundedNumber(config.get<string>("TAVILY_TIMEOUT_MS"), 20_000, 2_000, 60_000);
    this.maxDiscovered = this.boundedNumber(config.get<string>("MAX_DISCOVERED_PAPERS"), 35, 1, 40);
    this.maxSelected = this.boundedNumber(config.get<string>("MAX_ANALYZED_PAPERS"), 5, 1, 5);
    this.searchDepth =
      config.get<string>("TAVILY_SEARCH_DEPTH")?.trim().toLowerCase() === "basic" ? "basic" : "advanced";
  }

  async search(molecule: MoleculeSnapshot, originalInput: string): Promise<LiteratureSearchResult> {
    if (!this.client)
      throw new TavilyLiteratureError(
        "TAVILY_NOT_CONFIGURED",
        "Scientific literature search is not configured. Add a Tavily API key, then retry.",
      );

    const names = this.searchNames(molecule, originalInput);
    const moleculeQuery = names.map((name) => `"${this.cleanQueryValue(name)}"`).join(" OR ");
    const queries = [
      `${moleculeQuery} scientific study`,
      `${moleculeQuery} biological activity pharmacology`,
      `${moleculeQuery} molecular target pathway mechanism`,
      `${moleculeQuery} docking computational "molecular dynamics"`,
    ];
    const maxResults = Math.min(20, Math.max(5, Math.ceil(this.maxDiscovered / queries.length)));
    const attempts = await Promise.allSettled(queries.map((query) => this.fetchSearch(query, maxResults)));
    const candidates = attempts.flatMap((attempt, index) =>
      attempt.status === "fulfilled" ? attempt.value.map((result) => ({ result, query: queries[index]! })) : [],
    );
    if (!candidates.length && attempts.every((attempt) => attempt.status === "rejected")) {
      const failure = attempts.find((attempt): attempt is PromiseRejectedResult => attempt.status === "rejected");
      throw failure?.reason instanceof TavilyLiteratureError
        ? failure.reason
        : new TavilyLiteratureError(
            "TAVILY_UNAVAILABLE",
            "Scientific literature search is temporarily unavailable. Please retry this investigation.",
          );
    }

    if (!candidates.length) return { queries, discoveredCount: 0, papers: [] };

    const ranked = this.deduplicate(candidates)
      .map(({ result, matchedQueries }) => this.toSnapshot(result, matchedQueries, names))
      .filter((paper): paper is PaperSnapshot => Boolean(paper))
      .sort(
        (left, right) =>
          right.relevanceScore - left.relevanceScore ||
          Number(Boolean(right.abstract)) - Number(Boolean(left.abstract)) ||
          left.title.localeCompare(right.title),
      )
      .slice(0, this.maxDiscovered);
    const analyzable = ranked.filter((paper) => paper.abstract?.trim());

    return {
      queries,
      discoveredCount: ranked.length,
      papers: analyzable.slice(0, Math.min(this.maxSelected, analyzable.length)),
    };
  }

  private async fetchSearch(query: string, maxResults: number): Promise<TavilySearchResult[]> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.client!.search(query, {
          topic: "general",
          searchDepth: this.searchDepth,
          maxResults,
          includeAnswer: false,
          includeImages: false,
          includeRawContent: "text",
          includeDomains: SCIENTIFIC_DOMAINS,
          timeout: this.timeoutMs / 1_000,
          exactMatch: false,
        });
        if (!response || !Array.isArray(response.results))
          throw new TavilyLiteratureError(
            "TAVILY_INVALID_RESPONSE",
            "Tavily returned literature data Capela could not validate.",
          );
        return response.results.filter((result) => this.isTrustedScientificUrl(result.url));
      } catch (error) {
        if (error instanceof TavilyLiteratureError) throw error;
        if (attempt === 0 && this.isRetryable(error)) continue;
        break;
      }
    }
    throw new TavilyLiteratureError(
      "TAVILY_UNAVAILABLE",
      "Scientific literature search is temporarily unavailable. Please retry this investigation.",
    );
  }

  private deduplicate(entries: TavilyCandidate[]) {
    const unique: { result: TavilySearchResult; matchedQueries: string[] }[] = [];
    const indexes = {
      doi: new Map<string, number>(),
      pmid: new Map<string, number>(),
      pmcid: new Map<string, number>(),
      title: new Map<string, number>(),
    };
    for (const entry of entries) {
      const identifiers = this.identifiers(entry.result);
      const keys = this.identityKeys(entry.result, identifiers);
      const existing = keys.map(([kind, value]) => indexes[kind].get(value)).find((index) => index !== undefined);
      if (existing !== undefined) {
        const match = unique[existing]!;
        if (!match.matchedQueries.includes(entry.query)) match.matchedQueries.push(entry.query);
        if ((entry.result.rawContent?.length ?? 0) > (match.result.rawContent?.length ?? 0))
          match.result = entry.result;
        for (const [kind, value] of keys) indexes[kind].set(value, existing);
        continue;
      }
      const index = unique.length;
      unique.push({ result: entry.result, matchedQueries: [entry.query] });
      for (const [kind, value] of keys) indexes[kind].set(value, index);
    }
    return unique;
  }

  private toSnapshot(result: TavilySearchResult, matchedQueries: string[], names: string[]): PaperSnapshot | undefined {
    const title = this.plainText(result.title);
    if (!title) return undefined;
    const identifiers = this.identifiers(result);
    const abstract = this.extractAbstract(result.rawContent) ?? this.extractAbstract(result.content);
    const normalizedTitle = this.normalize(title);
    const normalizedAbstract = this.normalize(abstract ?? "");
    const normalizedNames = names.map((name) => this.normalize(name)).filter(Boolean);
    const hasNameInTitle = normalizedNames.some((name) => normalizedTitle.includes(name));
    const hasNameInAbstract = normalizedNames.some((name) => normalizedAbstract.includes(name));
    const activityPattern =
      /\b(activity|bioactivity|pharmacolog|antioxid|inflamm|antimicrobial|cytotoxic|anticancer|inhibit)/;
    const mechanismPattern = /\b(target|pathway|mechanism|binding|receptor|enzyme|signal)/;
    let relevanceScore = Math.round(Math.max(0, Math.min(1, result.score || 0)) * 8) + matchedQueries.length;
    const relevanceReasons: string[] = ["Ranked by Tavily scientific search"];
    if (hasNameInTitle) {
      relevanceScore += 9;
      relevanceReasons.push("Molecule named in title");
    }
    if (hasNameInAbstract) {
      relevanceScore += 4;
      relevanceReasons.push("Molecule named in retrieved abstract");
    }
    if (activityPattern.test(normalizedTitle)) {
      relevanceScore += 4;
      relevanceReasons.push("Biological activity focus in title");
    } else if (activityPattern.test(normalizedAbstract)) relevanceScore += 2;
    if (mechanismPattern.test(normalizedTitle)) {
      relevanceScore += 4;
      relevanceReasons.push("Target or mechanism focus in title");
    } else if (mechanismPattern.test(normalizedAbstract)) relevanceScore += 2;
    if (abstract) relevanceReasons.push("Abstract text retrieved from the publication page");

    const year = this.year(result.publishedDate, result.rawContent);
    const source = identifiers.pmid ? "PUBMED" : identifiers.pmcid ? "PMC" : "EUROPE_PMC";
    const id = identifiers.pmid ?? identifiers.pmcid ?? identifiers.doi ?? this.stableId(result.url);
    const publicationTypes = this.publicationTypes(result.rawContent);
    return {
      id,
      source,
      title,
      authors: [],
      year,
      doi: identifiers.doi,
      pmid: identifiers.pmid,
      pmcid: identifiers.pmcid,
      abstract,
      publicationTypes,
      studyType: this.studyType(publicationTypes, title),
      fullTextAvailable: Boolean(identifiers.pmcid),
      openAccess: Boolean(identifiers.pmcid),
      externalUrl: result.url,
      relevanceScore,
      relevanceReasons,
      matchedQueries,
    };
  }

  private identifiers(result: Pick<TavilySearchResult, "url" | "content" | "rawContent">) {
    const text = `${result.url}\n${result.content}\n${result.rawContent ?? ""}`;
    const url = new URL(result.url);
    const pubmedPath =
      url.hostname === "pubmed.ncbi.nlm.nih.gov" ? url.pathname.match(/^\/(\d{4,10})(?:\/|$)/) : undefined;
    const europePmcPath = url.pathname.match(/\/article\/(?:MED|PMC)\/(PMC)?(\d{4,10})/i);
    const pmcid =
      text.match(/\bPMC\d{4,10}\b/i)?.[0]?.toUpperCase() ?? (europePmcPath?.[1] ? `PMC${europePmcPath[2]}` : undefined);
    const pmid =
      pubmedPath?.[1] ??
      (europePmcPath && !europePmcPath[1] ? europePmcPath[2] : text.match(/\bPMID\s*:?\s*(\d{4,10})\b/i)?.[1]);
    const doiMatch = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0];
    return { pmid, pmcid, doi: doiMatch?.replace(/[.,;:)\]}]+$/g, "") };
  }

  private identityKeys(
    result: Pick<TavilySearchResult, "title">,
    identifiers: { doi?: string; pmid?: string; pmcid?: string },
  ): ["doi" | "pmid" | "pmcid" | "title", string][] {
    const keys: ["doi" | "pmid" | "pmcid" | "title", string][] = [];
    if (identifiers.doi) keys.push(["doi", identifiers.doi.toLowerCase()]);
    if (identifiers.pmid) keys.push(["pmid", identifiers.pmid.toLowerCase()]);
    if (identifiers.pmcid) keys.push(["pmcid", identifiers.pmcid.toLowerCase()]);
    const title = this.normalize(result.title);
    if (title) keys.push(["title", title]);
    return keys;
  }

  private extractAbstract(value?: string) {
    if (!value) return undefined;
    const text = value.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n");
    const heading = text.match(/(?:^|\n)\s*(?:#+\s*)?Abstract\s*(?:\n|:)\s*([\s\S]+)/i);
    if (!heading?.[1]) return undefined;
    const section = heading[1].split(
      /\n\s*(?:#+\s*)?(?:Keywords?|Publication types?|MeSH terms?|Substances?|Grants and funding|Conflict of interest|Copyright|Introduction|Figures?|References?)\b/i,
    )[0];
    const abstract = this.plainText(section ?? "")
      .slice(0, 20_000)
      .trim();
    return abstract.length >= 80 ? abstract : undefined;
  }

  private publicationTypes(rawContent?: string) {
    if (!rawContent) return [];
    const match = rawContent.match(/Publication types?\s*([\s\S]{0,300})/i)?.[1] ?? "";
    return ["Meta-Analysis", "Review", "Clinical Trial", "Journal Article"].filter((type) =>
      new RegExp(type.replace("-", "[- ]"), "i").test(match),
    );
  }

  private studyType(types: string[], title: string): PaperSnapshot["studyType"] {
    const text = `${types.join(" ")} ${title}`.toLowerCase();
    if (/meta[- ]analysis/.test(text)) return "meta_analysis";
    if (/\breview\b/.test(text)) return "review";
    if (/clinical trial/.test(text)) return "clinical_trial";
    return "journal_article";
  }

  private year(publishedDate?: string, rawContent?: string) {
    const fromDate = Number.parseInt(publishedDate?.slice(0, 4) ?? "", 10);
    if (fromDate >= 1800 && fromDate <= new Date().getUTCFullYear() + 1) return fromDate;
    const fromPage = Number.parseInt(rawContent?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? "", 10);
    return fromPage >= 1800 && fromPage <= new Date().getUTCFullYear() + 1 ? fromPage : undefined;
  }

  private searchNames(molecule: MoleculeSnapshot, originalInput: string) {
    const seen = new Set<string>();
    const names = [molecule.preferredName, originalInput, ...molecule.synonyms]
      .map((value) => value.trim())
      .filter((name) => {
        const normalized = name.toLowerCase();
        if (
          name.length < 3 ||
          name.length > 80 ||
          seen.has(normalized) ||
          /^(cid|inchi|chembl|cas)[- :]/i.test(name) ||
          /^\d{2,7}-\d{2}-\d$/.test(name)
        )
          return false;
        seen.add(normalized);
        return true;
      })
      .slice(0, 3);
    return names.length ? names : [molecule.preferredName.trim()];
  }

  private isTrustedScientificUrl(value: string) {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return SCIENTIFIC_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  }

  private cleanQueryValue(value: string) {
    return value.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
  }
  private normalize(value: string) {
    return value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }
  private plainText(value: string) {
    return value
      .replace(/<[^>]*>/g, " ")
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&nbsp;", " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  private stableId(value: string) {
    return `tavily-${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
  }
  private isRetryable(error: unknown) {
    const details = error as { status?: unknown; message?: unknown };
    return (
      (typeof details?.status === "number" && [408, 409, 425, 429, 500, 502, 503, 504].includes(details.status)) ||
      (typeof details?.message === "string" && RETRYABLE_STATUS_PATTERN.test(details.message))
    );
  }
  private boundedNumber(value: string | undefined, fallback: number, minimum: number, maximum: number) {
    const parsed = Number(value ?? fallback);
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.floor(parsed))) : fallback;
  }
}
