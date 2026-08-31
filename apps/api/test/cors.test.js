const assert = require("node:assert/strict");
const { test } = require("node:test");
const { allowedWebOrigins } = require("../dist/config/cors.js");

test("CORS uses a safe local default and supports explicit comma-separated web origins", () => {
  assert.deepEqual(allowedWebOrigins(), ["http://localhost:3000"]);
  assert.deepEqual(allowedWebOrigins("https://capela.example, https://preview.example,https://capela.example"), [
    "https://capela.example",
    "https://preview.example",
  ]);
});
