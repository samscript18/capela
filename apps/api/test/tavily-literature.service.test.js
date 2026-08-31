const assert = require("node:assert/strict");
const { test } = require("node:test");
const { TavilyLiteratureError, TavilyLiteratureService } = require("../dist/research/tavily-literature.service.js");

function service(values = {}) {
  const instance = new TavilyLiteratureService({
    get: (key) => values[key] ?? { TAVILY_API_KEY: "test-key", TAVILY_TIMEOUT_MS: "2000" }[key],
  });
  return instance;
}

function result(overrides = {}) {
  return {
    id: "result-1",
    title: "Loliolide biological activity",
    url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
    content: "Loliolide activity and pathway response were measured.",
    rawContent: `Abstract
Loliolide activity and pathway response were measured in a controlled experimental model. The reported outcomes were statistically assessed and described by the authors.

Publication types
Journal Article

PMID: 12345678
DOI: 10.1000/test`,
    score: 0.92,
    publishedDate: "2024-03-01",
    ...overrides,
  };
}

const molecule = {
  pubchemCid: 100332,
  preferredName: "Loliolide",
  synonyms: ["(-)-Loliolide", "CAS-123", "5989-02-6"],
  structure2dUrl: "https://example.test/image",
  pubchemUrl: "https://example.test/compound",
};

test("Tavily runs four bounded scientific searches, deduplicates records, and preserves retrieved identifiers", async () => {
  const requests = [];
  const instance = service();
  instance.client = {
    search: async (query, options) => {
      requests.push({ query, options });
      return { results: [result({ title: "Loliolide: <i>biological activity</i>" })] };
    },
  };

  const output = await instance.search(molecule, "Loliolide");

  assert.equal(requests.length, 4);
  assert.ok(requests.every(({ options }) => options.maxResults <= 20 && options.includeRawContent === "text"));
  assert.ok(requests.every(({ options }) => options.includeDomains.includes("pubmed.ncbi.nlm.nih.gov")));
  assert.equal(output.discoveredCount, 1);
  assert.equal(output.papers.length, 1);
  assert.equal(output.papers[0].matchedQueries.length, 4);
  assert.equal(output.papers[0].pmid, "12345678");
  assert.equal(output.papers[0].doi, "10.1000/test");
  assert.equal(output.papers[0].title, "Loliolide: biological activity");
  assert.equal(output.papers[0].year, 2024);
  assert.match(output.papers[0].abstract, /controlled experimental model/);
  assert.ok(output.papers[0].relevanceScore > 10);
});

test("Tavily deduplicates by normalized title and only selects results with retrieved abstracts", async () => {
  let request = 0;
  const instance = service({ MAX_DISCOVERED_PAPERS: "20", MAX_ANALYZED_PAPERS: "5" });
  instance.client = {
    search: async () => {
      request += 1;
      return {
        results: Array.from({ length: 6 }, (_, index) =>
          result({
            id: `${request}-${index}`,
            url: `https://europepmc.org/article/MED/${request}${index}2345`,
            title: index === 0 ? "Same Loliolide title!" : `Unique Loliolide paper ${request}-${index}`,
            rawContent:
              index === 5
                ? "No abstract is available."
                : `Abstract
This loliolide study reports a sufficiently detailed experimental abstract for record ${request}-${index}. Its measured outcomes and scientific context are described without unrelated identifiers.

Publication types
Journal Article`,
          }),
        ),
      };
    },
  };

  const output = await instance.search(molecule, "Loliolide");

  assert.equal(output.papers.length, 5);
  assert.ok(output.discoveredCount <= 20);
  assert.equal(output.papers.filter((paper) => paper.title === "Same Loliolide title!").length, 1);
  assert.ok(output.papers.every((paper) => paper.abstract));
});

test("Tavily invalid payloads fail closed", async () => {
  const instance = service();
  instance.client = { search: async () => ({ unexpected: true }) };
  await assert.rejects(
    () => instance.search(molecule, "Loliolide"),
    (error) => error instanceof TavilyLiteratureError && error.code === "TAVILY_INVALID_RESPONSE",
  );
});

test("Tavily preserves successful query results when one thematic search is unavailable", async () => {
  const instance = service();
  instance.client = {
    search: async (query) => {
      if (query.includes("pharmacology")) throw Object.assign(new Error("HTTP 503"), { status: 503 });
      return { results: [result()] };
    },
  };

  const output = await instance.search(molecule, "Loliolide");

  assert.equal(output.discoveredCount, 1);
  assert.equal(output.papers[0].matchedQueries.length, 3);
});

test("Tavily excludes results outside the configured scientific domains without inventing literature", async () => {
  const instance = service();
  instance.client = { search: async () => ({ results: [result({ url: "https://example.com/article" })] }) };
  const output = await instance.search(molecule, "Loliolide");
  assert.equal(output.discoveredCount, 0);
  assert.deepEqual(output.papers, []);
});
