const assert = require("node:assert/strict");
const { test } = require("node:test");
const { HealthController } = require("../dist/health/health.controller.js");

test("health reports a connected MongoDB dependency", () => {
  const controller = new HealthController({ readyState: 1 });
  assert.deepEqual(controller.health(), { status: "ok", service: "capela-api", database: "connected" });
});

test("health fails with 503 when MongoDB is unavailable", () => {
  const controller = new HealthController({ readyState: 0 });
  assert.throws(
    () => controller.health(),
    (error) => error.getStatus() === 503 && error.getResponse().database === "unavailable",
  );
});
