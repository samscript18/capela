import type { MoleculeSnapshot } from "@capela/shared";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

const propertyResponseSchema = z.object({
  PropertyTable: z.object({
    Properties: z.array(
      z.object({
        CID: z.number().int().positive(),
        Title: z.string().optional(),
        MolecularFormula: z.string().optional(),
        MolecularWeight: z.union([z.string(), z.number()]).optional(),
        SMILES: z.string().optional(),
        ConnectivitySMILES: z.string().optional(),
        InChI: z.string().optional(),
        InChIKey: z.string().optional(),
      }),
    ),
  }),
});

const synonymResponseSchema = z.object({
  InformationList: z.object({
    Information: z.array(z.object({ CID: z.number(), Synonym: z.array(z.string()).optional() })),
  }),
});
const descriptionResponseSchema = z.object({
  InformationList: z.object({
    Information: z.array(
      z.object({
        CID: z.number(),
        Title: z.string().optional(),
        Description: z.string().optional(),
        DescriptionSourceName: z.string().optional(),
        DescriptionURL: z.string().optional(),
      }),
    ),
  }),
});
const entrezSearchResponseSchema = z.object({
  esearchresult: z.object({
    count: z.string().regex(/^\d+$/),
    idlist: z.array(z.string().regex(/^\d+$/)),
  }),
});
const entrezSummaryRecordSchema = z.object({
  uid: z.string().regex(/^\d+$/),
  cid: z.number().int().positive(),
  synonymlist: z.array(z.string()).optional(),
  iupacname: z.string().optional(),
  canonicalsmiles: z.string().optional(),
  isomericsmiles: z.string().optional(),
  molecularformula: z.string().optional(),
  molecularweight: z.union([z.string(), z.number()]).optional(),
  inchikey: z.string().optional(),
  inchi: z.string().optional(),
});
const entrezSummaryResponseSchema = z.object({
  result: z
    .object({
      uids: z.array(z.string().regex(/^\d+$/)),
    })
    .catchall(z.unknown()),
});

export class PubChemResolutionError extends Error {
  constructor(
    readonly code: "MOLECULE_NOT_FOUND" | "MOLECULE_AMBIGUOUS" | "PUBCHEM_UNAVAILABLE" | "PUBCHEM_INVALID_RESPONSE",
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class PubChemService {
  private readonly logger = new Logger(PubChemService.name);
  private readonly baseUrl: string;
  private readonly entrezBaseUrl: string;
  private readonly entrezApiKey?: string;
  private readonly entrezEmail?: string;
  private readonly entrezIntervalMs: number;
  private entrezQueue: Promise<unknown> = Promise.resolve();
  private nextEntrezRequestAt = 0;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>("PUBCHEM_BASE_URL") ?? "https://pubchem.ncbi.nlm.nih.gov/rest/pug").replace(
      /\/$/,
      "",
    );
    this.entrezBaseUrl = (
      config.get<string>("NCBI_EUTILS_BASE_URL") ?? "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    ).replace(/\/$/, "");
    this.entrezApiKey = config.get<string>("NCBI_API_KEY")?.trim() || undefined;
    this.entrezEmail = config.get<string>("NCBI_EMAIL")?.trim() || undefined;
    this.entrezIntervalMs = this.entrezApiKey ? 110 : 350;
    const configuredTimeout = Number(config.get<string>("PUBCHEM_TIMEOUT_MS") ?? 10_000);
    this.timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 1_000 ? configuredTimeout : 10_000;
  }

  async resolve(originalInput: string): Promise<MoleculeSnapshot> {
    const input = originalInput.trim();
    if (!input)
      throw new PubChemResolutionError("MOLECULE_NOT_FOUND", "Capela could not confidently identify this molecule.");
    try {
      return await this.resolveWithPugRest(input);
    } catch (error) {
      if (
        !(error instanceof PubChemResolutionError) ||
        (error.code !== "PUBCHEM_UNAVAILABLE" && error.code !== "PUBCHEM_INVALID_RESPONSE")
      )
        throw error;
      this.logger.warn(`PubChem PUG REST resolution failed (${error.code}); trying the official NCBI Entrez fallback`);
      try {
        return await this.resolveWithEntrez(input);
      } catch (fallbackError) {
        if (
          fallbackError instanceof PubChemResolutionError &&
          (fallbackError.code === "MOLECULE_NOT_FOUND" || fallbackError.code === "MOLECULE_AMBIGUOUS")
        )
          throw fallbackError;
        throw error;
      }
    }
  }

  private async resolveWithPugRest(input: string): Promise<MoleculeSnapshot> {
    const namespace = /^\d+$/.test(input) ? "cid" : "name";
    const encodedInput = encodeURIComponent(input);
    const propertiesUrl = `${this.baseUrl}/compound/${namespace}/${encodedInput}/property/Title,MolecularFormula,MolecularWeight,SMILES,ConnectivitySMILES,InChI,InChIKey/JSON`;
    const propertyResponse = propertyResponseSchema.safeParse(await this.fetchJson(propertiesUrl));
    if (!propertyResponse.success)
      throw new PubChemResolutionError(
        "PUBCHEM_INVALID_RESPONSE",
        "PubChem returned molecule data Capela could not validate.",
      );
    const properties = propertyResponse.data.PropertyTable.Properties;
    if (!properties.length)
      throw new PubChemResolutionError("MOLECULE_NOT_FOUND", "Capela could not confidently identify this molecule.");
    if (properties.length !== 1)
      throw new PubChemResolutionError("MOLECULE_AMBIGUOUS", "Capela could not confidently identify this molecule.");
    const property = properties[0];
    if (!property)
      throw new PubChemResolutionError("MOLECULE_NOT_FOUND", "Capela could not confidently identify this molecule.");
    const cid = property.CID;
    const [synonymResult, descriptionResult] = await Promise.allSettled([
      this.fetchJson(`${this.baseUrl}/compound/cid/${cid}/synonyms/JSON`),
      this.fetchJson(`${this.baseUrl}/compound/cid/${cid}/description/JSON`),
    ]);
    const synonyms =
      synonymResult.status === "fulfilled" ? this.parseSynonyms(synonymResult.value, property.Title) : [];
    const description =
      descriptionResult.status === "fulfilled" ? this.parseDescription(descriptionResult.value) : undefined;
    return {
      pubchemCid: cid,
      preferredName: property.Title ?? synonyms[0] ?? input,
      synonyms,
      molecularFormula: property.MolecularFormula,
      molecularWeight: property.MolecularWeight === undefined ? undefined : String(property.MolecularWeight),
      canonicalSmiles: property.ConnectivitySMILES,
      isomericSmiles: property.SMILES,
      inchi: property.InChI,
      inchiKey: property.InChIKey,
      structure2dUrl: `${this.baseUrl}/compound/cid/${cid}/PNG?record_type=2d&image_size=large`,
      pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      description,
    };
  }

  private async resolveWithEntrez(input: string): Promise<MoleculeSnapshot> {
    const numericInput = /^\d+$/.test(input);
    let ids = numericInput ? [input] : [];
    if (!numericInput) {
      const query = this.entrezQuery({
        db: "pccompound",
        term: `${input}[CompleteSynonym]`,
        retmode: "json",
        retmax: "20",
      });
      const parsedSearch = entrezSearchResponseSchema.safeParse(
        await this.fetchEntrezJson(`${this.entrezBaseUrl}/esearch.fcgi?${query}`),
      );
      if (!parsedSearch.success)
        throw new PubChemResolutionError(
          "PUBCHEM_INVALID_RESPONSE",
          "PubChem returned molecule data Capela could not validate.",
        );
      ids = parsedSearch.data.esearchresult.idlist;
      if (!ids.length)
        throw new PubChemResolutionError("MOLECULE_NOT_FOUND", "Capela could not confidently identify this molecule.");
      if (Number(parsedSearch.data.esearchresult.count) !== 1 || ids.length !== 1)
        throw new PubChemResolutionError("MOLECULE_AMBIGUOUS", "Capela could not confidently identify this molecule.");
    }

    const summaryQuery = this.entrezQuery({
      db: "pccompound",
      id: ids.join(","),
      retmode: "json",
    });
    const parsedSummary = entrezSummaryResponseSchema.safeParse(
      await this.fetchEntrezJson(`${this.entrezBaseUrl}/esummary.fcgi?${summaryQuery}`),
    );
    if (!parsedSummary.success)
      throw new PubChemResolutionError(
        "PUBCHEM_INVALID_RESPONSE",
        "PubChem returned molecule data Capela could not validate.",
      );
    const records = parsedSummary.data.result.uids.flatMap((uid) => {
      const parsedRecord = entrezSummaryRecordSchema.safeParse(parsedSummary.data.result[uid]);
      return parsedRecord.success ? [parsedRecord.data] : [];
    });
    if (!records.length)
      throw new PubChemResolutionError(
        "PUBCHEM_INVALID_RESPONSE",
        "PubChem returned molecule data Capela could not validate.",
      );
    const record = numericInput ? records.find((candidate) => String(candidate.cid) === input) : records[0];
    if (!record)
      throw new PubChemResolutionError("MOLECULE_NOT_FOUND", "Capela could not confidently identify this molecule.");
    const preferredName = record.synonymlist?.find((value) => value.trim()) ?? record.iupacname ?? input;
    const synonyms = this.cleanSynonyms(
      [...(record.synonymlist ?? []), ...(record.iupacname ? [record.iupacname] : [])],
      preferredName,
    );
    return {
      pubchemCid: record.cid,
      preferredName,
      synonyms,
      molecularFormula: record.molecularformula,
      molecularWeight: record.molecularweight === undefined ? undefined : String(record.molecularweight),
      canonicalSmiles: record.canonicalsmiles,
      isomericSmiles: record.isomericsmiles,
      inchi: record.inchi,
      inchiKey: record.inchikey,
      structure2dUrl: `${this.baseUrl}/compound/cid/${record.cid}/PNG?record_type=2d&image_size=large`,
      pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${record.cid}`,
    };
  }

  private entrezQuery(values: Record<string, string>) {
    const query = new URLSearchParams({ ...values, tool: "capela" });
    if (this.entrezEmail) query.set("email", this.entrezEmail);
    if (this.entrezApiKey) query.set("api_key", this.entrezApiKey);
    return query;
  }

  private fetchEntrezJson(url: string) {
    const request = this.entrezQueue.then(async () => {
      const delay = Math.max(0, this.nextEntrezRequestAt - Date.now());
      if (delay) await this.wait(delay);
      this.nextEntrezRequestAt = Date.now() + this.entrezIntervalMs;
      return this.fetchJson(url, { notFoundResponse: false });
    });
    this.entrezQueue = request.catch(() => undefined);
    return request;
  }

  private parseSynonyms(input: unknown, preferredName?: string) {
    const parsed = synonymResponseSchema.safeParse(input);
    if (!parsed.success) return [];
    return this.cleanSynonyms(parsed.data.InformationList.Information[0]?.Synonym ?? [], preferredName);
  }

  private cleanSynonyms(values: string[], preferredName?: string) {
    const seen = new Set<string>();
    const preferred = this.normalizeName(preferredName ?? "");
    return values
      .filter((synonym) => {
        const normalized = this.normalizeName(synonym);
        if (!normalized || normalized === preferred || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      })
      .slice(0, 20);
  }

  private parseDescription(input: unknown) {
    const parsed = descriptionResponseSchema.safeParse(input);
    if (!parsed.success) return undefined;
    const entries = parsed.data.InformationList.Information.filter((entry) => entry.Description);
    const entry = entries.find((item) => item.DescriptionSourceName === "ChEBI") ?? entries[0];
    return entry?.Description
      ? { text: entry.Description, sourceName: entry.DescriptionSourceName, sourceUrl: entry.DescriptionURL }
      : undefined;
  }

  private normalizeName(value: string) {
    return value.trim().toLocaleLowerCase();
  }

  private async fetchJson(url: string, options: { notFoundResponse?: boolean } = {}): Promise<unknown> {
    const retryDelays = [750];
    for (let attempt = 0; attempt < retryDelays.length + 1; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
        if (options.notFoundResponse !== false && response.status === 404)
          throw new PubChemResolutionError(
            "MOLECULE_NOT_FOUND",
            "Capela could not confidently identify this molecule.",
          );
        if (response.status === 400)
          throw new PubChemResolutionError(
            "PUBCHEM_INVALID_RESPONSE",
            "PubChem returned molecule data Capela could not validate.",
          );
        const retryable =
          response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        if (retryable && attempt < retryDelays.length) {
          await this.wait(this.retryDelay(response, retryDelays[attempt] ?? 1_500));
          continue;
        }
        if (!response.ok)
          throw new PubChemResolutionError(
            "PUBCHEM_UNAVAILABLE",
            "PubChem is temporarily unavailable. Please retry this investigation.",
          );
        return await response.json();
      } catch (error) {
        if (error instanceof PubChemResolutionError) throw error;
        if (attempt < retryDelays.length) {
          await this.wait(retryDelays[attempt] ?? 1_500);
          continue;
        }
        throw new PubChemResolutionError(
          "PUBCHEM_UNAVAILABLE",
          "PubChem is temporarily unavailable. Please retry this investigation.",
        );
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new PubChemResolutionError(
      "PUBCHEM_UNAVAILABLE",
      "PubChem is temporarily unavailable. Please retry this investigation.",
    );
  }

  private retryDelay(response: Response, fallback: number) {
    const value = response.headers?.get?.("retry-after")?.trim();
    if (!value) return fallback;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.min(3_000, Math.max(fallback, seconds * 1_000));
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? Math.min(3_000, Math.max(fallback, timestamp - Date.now())) : fallback;
  }

  private wait(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
