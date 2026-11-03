require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const { PublicationMcpController } = require("../dist/research/publication-mcp.controller");

test("real SDK HTTP discovery/invocation is authenticated, read-only and bounded (mock canonical API)", async (t) => {
  const token = "fixture-remote-token-not-a-secret-123456";
  const controller = new PublicationMcpController({ get: () => token });
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.post("/research-mcp", (req, res) =>
    controller.handle(req, res).catch(() => res.status(401).json({ error: "Unauthorized" })),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = new URL(`http://127.0.0.1:${server.address().port}/research-mcp`);
  const client = new Client({ name: "capela-offline-test", version: "1.0.0" });
  t.after(async () => {
    await client.close();
    await new Promise((r) => server.close(r));
  });
  const original = global.fetch;
  let upstreamCalls = 0;
  t.mock.method(global, "fetch", async (input, init) => {
    const value = String(input instanceof Request ? input.url : input);
    if (value.startsWith("https://www.ebi.ac.uk/")) {
      upstreamCalls++;
      assert.equal(init.redirect, "error");
      const u = new URL(value);
      assert.equal(u.searchParams.get("query"), "EXT_ID:12345 AND SRC:MED");
      return Response.json({
        resultList: {
          result: [
            {
              id: "12345",
              source: "MED",
              title: "Synthetic metadata fixture",
              abstractText: "A synthetic fixture abstract, not scientific output.",
              authorList: { author: [] },
              pubTypeList: { pubType: ["Journal Article"] },
            },
          ],
        },
      });
    }
    return original(input, init);
  });
  const denied = await original(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(denied.status, 401);
  await client.connect(
    new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }),
  );
  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((x) => x.name),
    ["publication_abstract"],
  );
  assert.equal(tools.tools[0].annotations.readOnlyHint, true);
  const result = await client.callTool({
    name: "publication_abstract",
    arguments: { url: "https://pubmed.ncbi.nlm.nih.gov/12345/" },
  });
  assert.equal(result.structuredContent.pmid, "12345");
  assert.equal(upstreamCalls, 1);
  const invalid = await client.callTool({
    name: "publication_abstract",
    arguments: { url: "https://169.254.169.254/latest/meta-data/" },
  });
  assert.equal(invalid.isError, true);
  assert.equal(upstreamCalls, 1, "private destinations never dispatched");
});
