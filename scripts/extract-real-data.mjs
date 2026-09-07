import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const [input, output, retrievedAtArg] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: extract-real-data.mjs INPUT OUTPUT");

const retrievedAt = retrievedAtArg || new Date().toISOString();
if (Number.isNaN(new Date(retrievedAt).getTime())) throw new Error("invalid retrieval timestamp");
const snapshot = new Date(retrievedAt);
const asOf = new Date(Date.UTC(snapshot.getUTCFullYear(), snapshot.getUTCMonth(), snapshot.getUTCDate()));

const sandbox = {};
vm.runInNewContext(fs.readFileSync(input, "utf8"), sandbox, { timeout: 10_000 });

const rows = sandbox.public_ctr_data;
if (!Array.isArray(rows) || rows.length < 1_000) {
  throw new Error("PASSPort contract feed did not contain the expected records");
}

const money = (value) => {
  if (!value) return null;
  const negative = value.includes("(");
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : null;
};

const parseDate = (value) => {
  if (!value) return null;
  const [month, day, year] = value.split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const dayDiff = (a, b) => Math.round((a.getTime() - b.getTime()) / 86_400_000);

const classify = (contract) => {
  const start = parseDate(contract.startDate);
  const registered = parseDate(contract.registrationDate);
  if (start && registered) {
    const days = dayDiff(registered, start);
    return days > 0
      ? { riskKey: "late", riskLabel: "Registered late", riskDays: days }
      : { riskKey: "ontime", riskLabel: "Registered on time", riskDays: days };
  }
  if (!start) return { riskKey: "unknown", riskLabel: "Date unavailable", riskDays: 0 };
  const sinceStart = dayDiff(asOf, start);
  if (sinceStart >= 0 && contract.status !== "Registered") {
    return { riskKey: "critical", riskLabel: "Work started, unregistered", riskDays: sinceStart };
  }
  if (sinceStart >= -60 && contract.status !== "Registered") {
    return { riskKey: "watch", riskLabel: "Starts within 60 days", riskDays: Math.abs(sinceStart) };
  }
  if (contract.status === "Registered") return { riskKey: "registered", riskLabel: "Registered", riskDays: 0 };
  return { riskKey: "pipeline", riskLabel: "In pipeline", riskDays: Math.abs(sinceStart) };
};

const relevant = rows
  .filter((row) =>
    ["DEPARTMENT OF EDUCATION", "ADMINISTRATION FOR CHILDREN'S SERVICES"].includes(row[4]) &&
    (row[17] === "Human/Client Service" || row[21] === "Nonprofit Corporation") &&
    Number((row[14] || "").slice(-4)) >= 2024
  )
  .map((row) => {
    const contract = {
    recordId: row[0],
    epin: row[1] || null,
    contractId: row[2] || null,
    title: row[3],
    agency: row[4],
    vendor: row[5],
    program: row[6] || null,
    procurementMethod: row[7] || null,
    contractType: row[8] || null,
    status: row[9],
    awardAmount: money(row[10]),
    currentAmount: money(row[11]),
    totalEncumbered: money(row[12]),
    totalPaid: money(row[13]),
    startDate: row[14] || null,
    endDate: row[15] || null,
    registrationDate: row[16] || null,
    industry: row[17] || null,
    certification: row[20] || null,
      corporateStructure: row[21] || null,
    };
    return { ...contract, ...classify(contract) };
  })
  .sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));

const payload = {
  source: {
    publisher: "NYC Mayor's Office of Contract Services",
    system: "PASSPort Public",
    url: "https://a0333-passportpublic.nyc.gov/contracts.html",
    feedUrl: "https://a0333-passportpublic.nyc.gov/dataJs/contractData.js",
    retrievedAt,
    originalRecordCount: rows.length,
    filter: "DOE or ACS; Human/Client Service or nonprofit; start year 2024 or later",
  },
  records: relevant,
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(payload));
console.log(JSON.stringify({ output, records: relevant.length, sourceRecords: rows.length }));
