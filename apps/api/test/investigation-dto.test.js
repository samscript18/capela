const assert = require("node:assert/strict");
const { test } = require("node:test");
const { validate } = require("class-validator");
const { CreateInvestigationDto } = require("../dist/investigations/dto/create-investigation.dto.js");

test("investigation creation rejects whitespace-only molecule input", async () => {
  const input = new CreateInvestigationDto();
  input.originalInput = "   ";
  const errors = await validate(input);
  assert.ok(errors.some((error) => error.property === "originalInput"));
});

test("investigation creation accepts a bounded molecule name", async () => {
  const input = new CreateInvestigationDto();
  input.originalInput = "Loliolide";
  assert.deepEqual(await validate(input), []);
});
