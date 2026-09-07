import fs from "node:fs";
import path from "node:path";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: extract-centers.mjs INPUT OUTPUT");
const records = JSON.parse(fs.readFileSync(input, "utf8"));
if (!Array.isArray(records) || records.length < 2_000) {
  throw new Error("NYC childcare dataset did not contain the expected records");
}
const payload = {
  source: {
    publisher: "NYC Department of Health and Mental Hygiene",
    dataset: "Active NYC Health Code Regulated Child Care Programs",
    datasetUrl: "https://data.cityofnewyork.us/Health/Active-NYC-Health-Code-Regulated-Child-Care-Progra/gy3q-4tzp",
    apiUrl: "https://data.cityofnewyork.us/resource/gy3q-4tzp.json",
    retrievedAt: new Date().toISOString(),
    recordCount: records.length,
  },
  records,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(payload));
console.log(JSON.stringify({ output, records: records.length }));
