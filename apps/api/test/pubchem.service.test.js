const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const { PubChemResolutionError, PubChemService } = require("../dist/research/pubchem.service.js");

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function response(status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  };
}
function service(configuration = {}) {
  const instance = new PubChemService({
    get: (key) => configuration[key] ?? (key === "PUBCHEM_TIMEOUT_MS" ? "1000" : undefined),
  });
  instance.wait = async () => undefined;
  return instance;
}

test("PubChem resolution maps only validated API fields and caps synonyms", async () => {
  let propertyUrl;
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes("/property/")) {
      propertyUrl = value;
      return response(200, {
        PropertyTable: {
          Properties: [
            {
              CID: 100332,
              Title: "Loliolide",
              MolecularFormula: "C11H16O3",
              MolecularWeight: "196.24",
              SMILES: "stereo-smiles",
              ConnectivitySMILES: "connectivity-smiles",
              InChI: "InChI=1S/test",
              InChIKey: "TEST-INCHI-KEY",
            },
          ],
        },
      });
    }
    if (value.includes("/synonyms/"))
      return response(200, {
        InformationList: {
          Information: [
            {
              CID: 100332,
              Synonym: ["Loliolide", ...Array.from({ length: 24 }, (_, index) => `Synonym ${index + 1}`)],
            },
          ],
        },
      });
    return response(200, {
      InformationList: {
        Information: [
          { CID: 100332, Title: "Loliolide" },
          {
            CID: 100332,
            Description: "Validated description",
            DescriptionSourceName: "ChEBI",
            DescriptionURL: "https://example.test/source",
          },
        ],
      },
    });
  };
  const molecule = await service().resolve("Loliolide");
  assert.equal(molecule.pubchemCid, 100332);
  assert.equal(molecule.canonicalSmiles, "connectivity-smiles");
  assert.equal(molecule.isomericSmiles, "stereo-smiles");
  assert.equal(molecule.synonyms.length, 20);
  assert.equal(molecule.description.sourceName, "ChEBI");
  assert.match(propertyUrl, /MolecularWeight,SMILES,ConnectivitySMILES,InChI/);
  assert.doesNotMatch(propertyUrl, /CanonicalSMILES|IsomericSMILES/);
});

test("PubChem 404 becomes a scientific molecule-not-found error", async () => {
  global.fetch = async () => response(404, {});
  await assert.rejects(
    () => service().resolve("not-a-real-molecule"),
    (error) =>
      error instanceof PubChemResolutionError &&
      error.code === "MOLECULE_NOT_FOUND" &&
      error.message === "Capela could not confidently identify this molecule.",
  );
});

test("PubChem temporary service errors are retried once", async () => {
  let propertyAttempts = 0;
  const retryDelays = [];
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes("/property/")) {
      propertyAttempts += 1;
      if (propertyAttempts === 1) return response(503, {}, { "retry-after": "30" });
      return response(200, { PropertyTable: { Properties: [{ CID: 2244, Title: "Aspirin" }] } });
    }
    return response(200, { InformationList: { Information: [{ CID: 2244 }] } });
  };
  const instance = service();
  instance.wait = async (milliseconds) => retryDelays.push(milliseconds);
  assert.equal((await instance.resolve("Aspirin")).pubchemCid, 2244);
  assert.equal(propertyAttempts, 2);
  assert.equal(retryDelays[0], 3_000);
});

test("persistent PUG REST unavailability falls back to exact official Entrez compound records", async () => {
  let propertyAttempts = 0;
  let searchUrl = "";
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes("/rest/pug/") && value.includes("/property/")) {
      propertyAttempts += 1;
      return response(503, { Fault: { Code: "PUGREST.ServerBusy" } });
    }
    if (value.includes("/esearch.fcgi")) {
      searchUrl = value;
      return response(200, { esearchresult: { count: "1", idlist: ["100332"] } });
    }
    if (value.includes("/esummary.fcgi"))
      return response(200, {
        result: {
          uids: ["100332"],
          100332: {
            uid: "100332",
            cid: 100332,
            synonymlist: ["LOLIOLIDE", "5989-02-6", "calendin"],
            iupacname: "(6S,7aR)-6-hydroxy-4,4,7a-trimethyl-6,7-dihydro-5H-1-benzofuran-2-one",
            canonicalsmiles: "connectivity-smiles",
            isomericsmiles: "stereo-smiles",
            molecularformula: "C11H16O3",
            molecularweight: "196.240",
            inchikey: "XEVQXKKKAVVSMW-WRWORJQWSA-N",
            inchi: "InChI=1S/C11H16O3/test",
          },
        },
      });
    throw new Error(`Unexpected URL: ${value}`);
  };

  const molecule = await service().resolve("Loliolide");
  assert.equal(propertyAttempts, 2);
  assert.match(decodeURIComponent(searchUrl), /Loliolide\[CompleteSynonym\]/);
  assert.equal(molecule.pubchemCid, 100332);
  assert.equal(molecule.preferredName, "LOLIOLIDE");
  assert.equal(molecule.molecularFormula, "C11H16O3");
  assert.equal(molecule.canonicalSmiles, "connectivity-smiles");
  assert.equal(molecule.isomericSmiles, "stereo-smiles");
  assert.equal(molecule.inchiKey, "XEVQXKKKAVVSMW-WRWORJQWSA-N");
});

test("numeric CID fallback goes directly to Entrez ESummary", async () => {
  let searchCalls = 0;
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes("/rest/pug/")) return response(503, {});
    if (value.includes("/esearch.fcgi")) {
      searchCalls += 1;
      return response(500, {});
    }
    return response(200, {
      result: {
        uids: ["2244"],
        2244: {
          uid: "2244",
          cid: 2244,
          synonymlist: ["Aspirin"],
          molecularformula: "C9H8O4",
          molecularweight: "180.16",
        },
      },
    });
  };
  const molecule = await service().resolve("2244");
  assert.equal(searchCalls, 0);
  assert.equal(molecule.pubchemCid, 2244);
  assert.equal(molecule.preferredName, "Aspirin");
});

test("Entrez fallback preserves not-found and ambiguous molecule states", async () => {
  const run = async (searchResult, expectedCode) => {
    global.fetch = async (url) => {
      const value = String(url);
      if (value.includes("/rest/pug/")) return response(503, {});
      if (value.includes("/esearch.fcgi")) return response(200, { esearchresult: searchResult });
      throw new Error("ESummary must not run for an unresolved exact name");
    };
    await assert.rejects(
      () => service().resolve("Unresolved molecule"),
      (error) => error instanceof PubChemResolutionError && error.code === expectedCode,
    );
  };
  await run({ count: "0", idlist: [] }, "MOLECULE_NOT_FOUND");
  await run({ count: "2", idlist: ["1", "2"] }, "MOLECULE_AMBIGUOUS");
});

test("PubChem HTTP 400 is invalid data rather than a false molecule-not-found result", async () => {
  global.fetch = async () => response(400, {});
  await assert.rejects(
    () => service().resolve("Loliolide"),
    (error) => error instanceof PubChemResolutionError && error.code === "PUBCHEM_INVALID_RESPONSE",
  );
});

test("exhausted PUG REST and Entrez network failures remain retryable PubChem unavailability", async () => {
  global.fetch = async () => {
    throw new Error("network unavailable");
  };
  await assert.rejects(
    () => service().resolve("Loliolide"),
    (error) => error instanceof PubChemResolutionError && error.code === "PUBCHEM_UNAVAILABLE",
  );
});

test("invalid PubChem timeout configuration falls back to a safe default", () => {
  const instance = service({ PUBCHEM_TIMEOUT_MS: "not-a-number" });
  assert.equal(instance.timeoutMs, 10_000);
});
