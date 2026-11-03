import { Injectable } from "@nestjs/common";
import type { MoleculeSnapshot, PaperSnapshot, ResearchRun } from "@capela/shared";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { OtariGatewayService, type SaveRun } from "./otari-gateway.service";
import { ResearchError, scientificUrl, snapshot, strictOutput } from "./provenance";

export const PublicationSchema = z
  .object({
    pmid: z.string().regex(/^\d{1,10}$/),
    title: z.string().min(1).max(2000),
    abstract: z.string().max(30000),
    authors: z.array(z.string().max(300)).max(100),
    journal: z.string().max(500),
    year: z.number().int().min(1800).max(2200).nullable(),
    doi: z.string().max(300).nullable(),
    publicationTypes: z.array(z.string().max(200)).max(30),
    canonicalUrl: z.string().regex(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d{1,10}\/$/),
  })
  .strict();
export const PublicationInput = z
  .object({ url: z.string().regex(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d{1,10}\/$/) })
  .strict();
const SearchSchema = z
  .object({
    results: z
      .array(
        z
          .object({ title: z.string().max(2000), url: z.string().max(2000), snippet: z.string().max(12000) })
          .passthrough(),
      )
      .max(40),
  })
  .passthrough();
const DiscoverySchema = z
  .object({
    server_id: z.string(),
    server_revision: z.string().min(1).max(200),
    tools: z
      .array(z.object({ name: z.string(), input_schema: z.record(z.string(), z.unknown()) }).passthrough())
      .max(100),
  })
  .passthrough();
@Injectable()
export class OtariRetrievalService {
  constructor(private readonly gateway: OtariGatewayService) {}
  async search(molecule: MoleculeSnapshot, run: ResearchRun, save: SaveRun) {
    const { data } = await this.gateway.request(
      "/search",
      {
        query: `${molecule.preferredName.slice(0, 200)} biological activity mechanism study`,
        max_results: 15,
        search_domain_filter: ["pubmed.ncbi.nlm.nih.gov"],
        max_tokens_per_page: 1024,
      },
      "scientific_search",
      run,
      save,
    );
    const search = strictOutput(SearchSchema, data);
    // IDs are taken only from the canonical publication URL, never page references/snippets.
    const discoveredUrls = [
      ...new Set(
        search.results.flatMap((r) => {
          try {
            const u = new URL(scientificUrl(r.url));
            const m = u.hostname === "pubmed.ncbi.nlm.nih.gov" && u.pathname.match(/^\/(\d{1,10})\/?$/);
            return m ? [`https://pubmed.ncbi.nlm.nih.gov/${m[1]}/`] : [];
          } catch {
            return [];
          }
        }),
      ),
    ];
    const urls = discoveredUrls.slice(0, 5);
    if (!urls.length) return { papers: [] as PaperSnapshot[], discoveredCount: 0 };
    const server = this.gateway.value("OTARI_MCP_SERVER_ID");
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(server))
      throw new ResearchError("OTARI_MCP_NOT_CONFIGURED", "Configure the hosted read-only publication MCP server.");
    const discovery = strictOutput(
      DiscoverySchema,
      (await this.gateway.request(`/mcp/servers/${server}/tools`, undefined, "mcp_discovery", run, save)).data,
    );
    const tool = discovery.tools.find((t) => t.name === "publication_abstract");
    const schema = tool?.input_schema;
    const properties = schema?.properties as Record<string, { type?: unknown }> | undefined;
    if (
      discovery.server_id !== server ||
      !schema ||
      schema.type !== "object" ||
      schema.additionalProperties !== false ||
      JSON.stringify(schema.required) !== '["url"]' ||
      Object.keys(properties ?? {}).join() !== "url" ||
      properties?.url?.type !== "string"
    )
      throw new ResearchError(
        "OTARI_MCP_SCHEMA",
        "Hosted MCP discovery does not match Capela's read-only metadata contract.",
      );
    const papers: PaperSnapshot[] = [];
    for (const url of urls) {
      const args = PublicationInput.parse({ url });
      const { data: result } = await this.gateway.request(
        "/mcp/execute",
        {
          mcp_server_id: server,
          tool_name: "publication_abstract",
          arguments: args,
          server_revision: discovery.server_revision,
          client_execution_id: randomUUID(),
        },
        "publication_metadata",
        run,
        save,
      );
      if (result.isError === true || result.resultType !== "complete")
        throw new ResearchError("OTARI_MCP_RESULT", "Publication MCP returned an incomplete or failed result.");
      const pub = strictOutput(PublicationSchema, result.structuredContent);
      if (pub.canonicalUrl !== url || !url.endsWith(`/${pub.pmid}/`))
        throw new ResearchError(
          "SOURCE_IDENTITY_MISMATCH",
          "Canonical publication identity does not match the selected source.",
        );
      if (!pub.abstract.trim()) continue;
      const source = snapshot(pub.pmid, url, pub.abstract);
      run.snapshots.push(source);
      await save(); // Immutable source is durable before any role call.
      const review = pub.publicationTypes.some((p) => /review|meta-analysis/i.test(p));
      papers.push({
        id: pub.pmid,
        source: "PUBMED",
        title: pub.title,
        authors: pub.authors,
        journal: pub.journal,
        year: pub.year ?? undefined,
        doi: pub.doi ?? undefined,
        pmid: pub.pmid,
        abstract: source.text,
        publicationTypes: pub.publicationTypes,
        studyType: review ? "review" : "journal_article",
        fullTextAvailable: false,
        openAccess: false,
        externalUrl: url,
        relevanceScore: 0,
        relevanceReasons: ["Selected from hosted Otari scientific search; canonical metadata via hosted MCP"],
        matchedQueries: [molecule.preferredName],
      });
    }
    return { papers, discoveredCount: discoveredUrls.length };
  }
}
