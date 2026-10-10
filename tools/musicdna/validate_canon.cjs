const fs = require("fs");
const path = require("path");

const expectedDimensions = [
  "movement",
  "atmosphere",
  "groove",
  "darkness",
  "hope",
  "nostalgia",
  "transformation",
  "complexity",
  "melody",
  "verbal_cleverness",
  "authenticity",
  "romanticism",
  "energy",
  "dreaminess",
  "community",
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted && char === '"' && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(value);
      value = "";
    } else if (!quoted && char === "\n") {
      row.push(value);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

const filePath =
  process.argv[2] ||
  path.join(__dirname, "..", "..", "data", "musicdna", "alternative_diagnostic_canon_seed.csv");
const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
const [headers, ...records] = rows;
const headerIndex = new Map(headers.map((header, index) => [header, index]));
const errors = [];

for (const required of [
  "title",
  "artist",
  "year",
  "lane",
  "diagnostic_power",
  "primary_dimensions",
  "archetype_signals",
  ...expectedDimensions,
]) {
  if (!headerIndex.has(required)) errors.push(`Missing required column: ${required}`);
}

const seen = new Map();
const lanes = new Map();
for (const [index, record] of records.entries()) {
  if (record.length !== headers.length) {
    errors.push(`Row ${index + 2} has ${record.length} columns; expected ${headers.length}`);
    continue;
  }

  const title = record[headerIndex.get("title")];
  const artist = record[headerIndex.get("artist")];
  const lane = record[headerIndex.get("lane")];
  const diagnosticPower = Number(record[headerIndex.get("diagnostic_power")]);
  const primaryDimensions = record[headerIndex.get("primary_dimensions")]
    .split("|")
    .filter(Boolean);
  const archetypeSignals = record[headerIndex.get("archetype_signals")].split("|").filter(Boolean);
  const key = `${artist}|${title}`;
  seen.set(key, (seen.get(key) || 0) + 1);
  lanes.set(lane, (lanes.get(lane) || 0) + 1);

  if (!Number.isInteger(diagnosticPower) || diagnosticPower < 0 || diagnosticPower > 100) {
    errors.push(
      `Row ${index + 2} has invalid diagnostic_power: ${record[headerIndex.get("diagnostic_power")]}`,
    );
  }

  if (!primaryDimensions.length) {
    errors.push(`Row ${index + 2} has no primary_dimensions`);
  }

  for (const dimension of primaryDimensions) {
    if (!expectedDimensions.includes(dimension)) {
      errors.push(`Row ${index + 2} has invalid primary dimension: ${dimension}`);
    }
  }

  if (!archetypeSignals.length) {
    errors.push(`Row ${index + 2} has no archetype_signals`);
  }

  for (const dimension of expectedDimensions) {
    const value = Number(record[headerIndex.get(dimension)]);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      errors.push(
        `Row ${index + 2} has invalid ${dimension}: ${record[headerIndex.get(dimension)]}`,
      );
    }
  }
}

for (const [key, count] of seen.entries()) {
  if (count > 1) errors.push(`Duplicate song: ${key}`);
}

if (records.length !== 250) errors.push(`Expected 250 records; found ${records.length}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Validated ${records.length} diagnostic records with ${expectedDimensions.length} dimensions.`,
);
for (const [lane, count] of [...lanes.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`${lane}: ${count}`);
}
