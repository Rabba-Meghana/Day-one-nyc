import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const data = JSON.parse(fs.readFileSync(new URL("../app/data/contracts.json", import.meta.url), "utf8"));

test("official contract snapshot has complete precomputed risk classifications", () => {
  assert.equal(data.source.originalRecordCount, 61_988);
  assert.equal(data.records.length, 693);
  assert.equal(new Set(data.records.map((record) => record.recordId)).size, 693);
  assert.ok(data.records.every((record) => record.riskKey && record.riskLabel && Number.isFinite(record.riskDays)));
});

test("published risk totals are deterministic", () => {
  const critical = data.records.filter((record) => record.riskKey === "critical");
  const watch = data.records.filter((record) => record.riskKey === "watch");
  const registered = data.records.filter((record) => ["late", "ontime"].includes(record.riskKey));
  const late = data.records.filter((record) => record.riskKey === "late");

  assert.equal(critical.length, 39);
  assert.equal(critical.length + watch.length, 42);
  assert.equal(late.length, 358);
  assert.equal(registered.length, 630);
  assert.equal(Math.max(...critical.map((record) => record.riskDays)), 797);
  assert.equal(
    critical.reduce((sum, record) => sum + (record.currentAmount ?? record.awardAmount ?? 0), 0),
    115_035_009.54,
  );
});

test("known PASSPort record remains searchable and classified", () => {
  const record = data.records.find((item) => item.vendor === "BELLEVUE DAY CARE CENTER INC");
  assert.ok(record);
  assert.equal(record.startDate, "07/01/2025");
  assert.equal(record.registrationDate, null);
  assert.equal(record.riskKey, "critical");
});
