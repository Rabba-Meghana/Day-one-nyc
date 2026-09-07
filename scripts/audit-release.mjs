import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

const [rawContractPath, rawCenterPath] = process.argv.slice(2);
if (!rawContractPath || !rawCenterPath) {
  throw new Error("usage: audit-release.mjs RAW_PASSPORT_JS RAW_CENTERS_JSON");
}

let checks = 0;
const check = (condition, message) => {
  checks += 1;
  assert.ok(condition, message);
};
const equal = (actual, expected, message) => {
  checks += 1;
  assert.deepEqual(actual, expected, message);
};
const hash = (path) => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");

const contracts = JSON.parse(fs.readFileSync(new URL("../app/data/contracts.json", import.meta.url), "utf8"));
const centers = JSON.parse(fs.readFileSync(new URL("../app/data/centers.json", import.meta.url), "utf8"));
const rawCenters = JSON.parse(fs.readFileSync(rawCenterPath, "utf8"));

const rawContractText = fs.readFileSync(rawContractPath, "utf8");
const sandbox = {};
vm.runInNewContext(rawContractText, sandbox, { timeout: 10_000 });
const rawContracts = sandbox.public_ctr_data;
check(Array.isArray(rawContracts), "PASSPort feed must contain a contract array");

equal(rawContracts.length, 61_988, "PASSPort source count");
equal(contracts.records.length, 693, "filtered contract count");
equal(rawCenters.length, 2_752, "DOHMH source count");
equal(centers.records.length, 2_752, "published center count");

const rawRelevant = rawContracts.filter((row) =>
  ["DEPARTMENT OF EDUCATION", "ADMINISTRATION FOR CHILDREN'S SERVICES"].includes(row[4]) &&
  (row[17] === "Human/Client Service" || row[21] === "Nonprofit Corporation") &&
  Number((row[14] || "").slice(-4)) >= 2024
);
equal(rawRelevant.length, contracts.records.length, "independently filtered PASSPort count");
const rawById = new Map(rawRelevant.map((row) => [row[0], row]));
equal(rawById.size, rawRelevant.length, "filtered PASSPort record IDs must be unique");
equal(new Set(contracts.records.map((record) => record.recordId)).size, contracts.records.length, "published contract IDs must be unique");
equal(new Set(centers.records.map((record) => record.dcid)).size, centers.records.length, "childcare IDs must be unique");
equal(new Set(rawCenters.map((record) => record.dcid)).size, rawCenters.length, "source childcare IDs must be unique");
const rawCentersById = new Map(rawCenters.map((record) => [record.dcid, record]));

const parseMoney = (value) => {
  if (!value) return null;
  const negative = value.includes("(");
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : null;
};
const sourceFields = [
  ["recordId", 0, (v) => v], ["epin", 1, (v) => v || null], ["contractId", 2, (v) => v || null],
  ["title", 3, (v) => v], ["agency", 4, (v) => v], ["vendor", 5, (v) => v],
  ["program", 6, (v) => v || null], ["procurementMethod", 7, (v) => v || null],
  ["contractType", 8, (v) => v || null], ["status", 9, (v) => v],
  ["awardAmount", 10, parseMoney], ["currentAmount", 11, parseMoney],
  ["totalEncumbered", 12, parseMoney], ["totalPaid", 13, parseMoney],
  ["startDate", 14, (v) => v || null], ["endDate", 15, (v) => v || null],
  ["registrationDate", 16, (v) => v || null], ["industry", 17, (v) => v || null],
  ["certification", 20, (v) => v || null], ["corporateStructure", 21, (v) => v || null],
];

const parseDate = (value) => {
  if (!value) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  check(Boolean(match), `invalid date ${value}`);
  const [, month, day, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  check(date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day), `impossible date ${value}`);
  return date;
};
const dayDiff = (a, b) => Math.round((a.getTime() - b.getTime()) / 86_400_000);
const snapshot = new Date(contracts.source.retrievedAt);
const asOf = new Date(Date.UTC(snapshot.getUTCFullYear(), snapshot.getUTCMonth(), snapshot.getUTCDate()));

const expectedRisk = (record) => {
  const started = parseDate(record.startDate);
  const registered = parseDate(record.registrationDate);
  if (started && registered) {
    const days = dayDiff(registered, started);
    return days > 0 ? ["late", "Registered late", days] : ["ontime", "Registered on time", days];
  }
  if (!started) return ["unknown", "Date unavailable", 0];
  const days = dayDiff(asOf, started);
  if (days >= 0 && record.status !== "Registered") return ["critical", "Work started, unregistered", days];
  if (days >= -60 && record.status !== "Registered") return ["watch", "Starts within 60 days", Math.abs(days)];
  if (record.status === "Registered") return ["registered", "Registered", 0];
  return ["pipeline", "In pipeline", Math.abs(days)];
};

for (const record of contracts.records) {
  const source = rawById.get(record.recordId);
  check(Boolean(source), `missing PASSPort source row ${record.recordId}`);
  for (const [field, index, normalize] of sourceFields) equal(record[field], normalize(source[index]), `${record.recordId}.${field}`);
  check(["DEPARTMENT OF EDUCATION", "ADMINISTRATION FOR CHILDREN'S SERVICES"].includes(record.agency), `${record.recordId}.agency filter`);
  check(record.industry === "Human/Client Service" || record.corporateStructure === "Nonprofit Corporation", `${record.recordId}.service filter`);
  check(Number(record.startDate?.slice(-4)) >= 2024, `${record.recordId}.start-year filter`);
  const [key, label, days] = expectedRisk(record);
  equal(record.riskKey, key, `${record.recordId}.riskKey`);
  equal(record.riskLabel, label, `${record.recordId}.riskLabel`);
  equal(record.riskDays, days, `${record.recordId}.riskDays`);
  check(record.vendor.trim().length > 0, `${record.recordId}.vendor required`);
  check(record.title.trim().length > 0, `${record.recordId}.title required`);
}

for (let index = 0; index < centers.records.length; index += 1) {
  const record = centers.records[index];
  const source = rawCentersById.get(record.dcid);
  check(Boolean(source), `childcare row ${index} source record exists`);
  equal(record, source, `childcare row ${index} exact source equality`);
  check(record.dcid?.length > 0, `childcare row ${index} dcid`);
  check(record.program_name?.trim().length > 0, `childcare row ${index} program name`);
  check(record.address?.trim().length > 0, `childcare row ${index} address`);
  if (record.latitude) check(Number(record.latitude) >= 40 && Number(record.latitude) <= 41, `childcare row ${index} latitude`);
  if (record.longitude) check(Number(record.longitude) >= -75 && Number(record.longitude) <= -73, `childcare row ${index} longitude`);
}

const critical = contracts.records.filter((record) => record.riskKey === "critical");
const watch = contracts.records.filter((record) => record.riskKey === "watch");
const late = contracts.records.filter((record) => record.riskKey === "late");
const ontime = contracts.records.filter((record) => record.riskKey === "ontime");
equal(critical.length, 39, "critical count");
equal(critical.length + watch.length, 42, "active-risk count");
equal(late.length, 358, "late count");
equal(late.length + ontime.length, 630, "dated registration count");
equal(Math.max(...critical.map((record) => record.riskDays)), 797, "oldest open clock");
equal(critical.reduce((sum, record) => sum + (record.currentAmount ?? record.awardAmount ?? 0), 0), 115_035_009.54, "critical disclosed value");

console.log(JSON.stringify({
  passed: true,
  checks,
  metrics: { critical: 39, activeRisk: 42, relevantContracts: 693, late: 358, dated: 630, value: 115_035_009.54, oldestDays: 797 },
  sourceLimitations: { duplicatePassportRows: rawContracts.length - new Set(rawContracts.map((row) => row[0])).size },
  sha256: {
    rawPassport: hash(rawContractPath),
    publishedContracts: hash(new URL("../app/data/contracts.json", import.meta.url)),
    rawChildcare: hash(rawCenterPath),
    publishedChildcare: hash(new URL("../app/data/centers.json", import.meta.url)),
  },
}));
