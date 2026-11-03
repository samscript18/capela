import { Controller, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { PublicationInput, PublicationSchema } from "./otari-retrieval.service";
import { boundedJson } from "./otari-gateway.service";

// Separate authentication surface for the hosted gateway. No application user data is exposed.
@ApiExcludeController()
@Controller("research-mcp")
export class PublicationMcpController {
  private readonly rates = new Map<string, { at: number; count: number }>();
  constructor(private readonly config: ConfigService) {}
  @Post()
  async handle(@Req() req: Request, @Res() res: Response) {
    const secret = this.config.get<string>("CAPELA_MCP_TOKEN")?.trim();
    const actual = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${secret ?? ""}`);
    if (!secret || secret.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new UnauthorizedException();
    // Global rate limit per process, in addition to hosted workspace/key limits.
    const now = Date.now(),
      entry = this.rates.get("metadata");
    const rate = !entry || now - entry.at > 60000 ? { at: now, count: 0 } : entry;
    if (++rate.count > 30) {
      res.status(429).json({ error: "Metadata rate limit" });
      return;
    }
    this.rates.set("metadata", rate);
    const server = new McpServer({ name: "capela-publication-metadata", version: "1.0.0" });
    server.registerTool(
      "publication_abstract",
      {
        description: "Read canonical PubMed publication metadata and abstract only.",
        inputSchema: PublicationInput,
        outputSchema: PublicationSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ url }) => {
        const pmid = PublicationInput.parse({ url }).url.split("/").filter(Boolean).at(-1)!;
        // Fixed authority, fixed query grammar: no arbitrary network or redirect target.
        const endpoint = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
        endpoint.searchParams.set("query", `EXT_ID:${pmid} AND SRC:MED`);
        endpoint.searchParams.set("format", "json");
        endpoint.searchParams.set("resultType", "core");
        endpoint.searchParams.set("pageSize", "1");
        try {
          const response = await fetch(endpoint, { redirect: "error", signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error();
          const data = await boundedJson(response, 200000);
          const results = data.resultList as { result?: Record<string, unknown>[] } | undefined;
          const p = results?.result?.[0];
          if (!p || p.id !== pmid || p.source !== "MED") throw new Error();
          const journalInfo = p.journalInfo as { yearOfPublication?: number; journal?: { title?: string } } | undefined;
          const types = p.pubTypeList as { pubType?: string[] } | undefined;
          const authors = p.authorList as { author?: { fullName?: string }[] } | undefined;
          const pub = PublicationSchema.parse({
            pmid,
            title: p.title,
            abstract: plain(typeof p.abstractText === "string" ? p.abstractText : ""),
            authors: (authors?.author ?? [])
              .map((a) => a.fullName ?? "")
              .filter(Boolean)
              .slice(0, 100),
            journal: journalInfo?.journal?.title ?? "",
            year: journalInfo?.yearOfPublication ? Number(journalInfo.yearOfPublication) : null,
            doi: p.doi ?? null,
            publicationTypes: types?.pubType ?? [],
            canonicalUrl: url,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify(pub) }], structuredContent: pub };
        } catch {
          return {
            content: [{ type: "text" as const, text: "Canonical publication metadata unavailable." }],
            isError: true,
          };
        }
      },
    );
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
function plain(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}
