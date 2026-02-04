#!/usr/bin/env node

/**
 * Sync translation messages from Google Sheets
 *
 * Downloads the CSV export from Google Sheets and updates messages/*.json files.
 *
 * REQUIREMENTS:
 * - The Google Sheet must be set to "Anyone with link can view"
 * - Sheet must have columns: key, en, es (header row)
 *
 * USAGE:
 *   pnpm sync-messages           # Sync and write files
 *   pnpm sync-messages --dry-run # Preview changes without writing
 *
 * ENVIRONMENT:
 *   GOOGLE_SHEET_ID - Override the default sheet ID
 *
 * Run: pnpm sync-messages
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1jIyytsvBSSVCNC1m29N17F8S8HQqoq2j4Oqb0II4Xlc";
const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Parse CSV text into rows, handling quoted fields with commas
 */
function parseCSV(csvText) {
  return csvText
    .split("\n")
    .map((row) => {
      const cols = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
          // Handle escaped quotes ("")
          if (inQuotes && row[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          cols.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      cols.push(current.trim());
      return cols;
    })
    .filter((row) => row.some((cell) => cell));
}

async function syncMessages() {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

    console.log(DRY_RUN ? "🔍 DRY RUN - No files will be written\n" : "");
    console.log(`Fetching sheet: ${SHEET_ID}`);
    console.log(`URL: ${csvUrl}\n`);

    const response = await fetch(csvUrl);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.error("\n❌ Authentication error!");
        console.error("The Google Sheet must be set to 'Anyone with link can view'.");
        console.error("\nTo fix:");
        console.error("1. Open the Google Sheet");
        console.error("2. Click 'Share' button");
        console.error("3. Under 'General access', select 'Anyone with the link'");
        console.error("4. Ensure 'Viewer' permission is selected");
        process.exit(1);
      }
      throw new Error(`Failed to fetch sheet: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();

    // Check if we got HTML instead of CSV (redirect to login page)
    if (csvText.includes("<!DOCTYPE html>") || csvText.includes("<html")) {
      console.error("\n❌ Received HTML instead of CSV!");
      console.error("This usually means the sheet is not publicly accessible.");
      console.error("\nTo fix:");
      console.error("1. Open the Google Sheet");
      console.error("2. Click 'Share' button");
      console.error("3. Under 'General access', select 'Anyone with the link'");
      process.exit(1);
    }

    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      console.log("No data found in sheet.");
      return;
    }

    // Find column indices
    const headers = rows[0].map((h) => h.toLowerCase());
    const keyIndex = headers.findIndex((h) => h === "key");
    const enIndex = headers.findIndex((h) => h === "en" || h === "english");
    const esIndex = headers.findIndex((h) => h === "es" || h === "spanish");

    if (keyIndex === -1) {
      console.error("❌ Sheet must have a 'key' column");
      process.exit(1);
    }
    if (enIndex === -1) {
      console.error("❌ Sheet must have an 'en' or 'english' column");
      process.exit(1);
    }

    console.log(`Found columns: key=${keyIndex}, en=${enIndex}, es=${esIndex >= 0 ? esIndex : "not found"}\n`);

    // Build message objects
    const enMessages = { $schema: "https://inlang.com/schema/inlang-message-format" };
    const esMessages = { $schema: "https://inlang.com/schema/inlang-message-format" };
    const missingEs = [];
    const emptyEn = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const key = row[keyIndex]?.trim();
      const enValue = row[enIndex]?.trim();
      const esValue = esIndex !== -1 ? row[esIndex]?.trim() : undefined;

      if (!key) continue;

      if (!enValue) {
        emptyEn.push(key);
        continue;
      }

      enMessages[key] = enValue;

      if (esValue) {
        esMessages[key] = esValue;
      } else {
        missingEs.push(key);
      }
    }

    // Report warnings
    if (emptyEn.length > 0) {
      console.log(`⚠️  ${emptyEn.length} keys have empty English values (skipped):`);
      emptyEn.slice(0, 5).forEach((k) => console.log(`   - ${k}`));
      if (emptyEn.length > 5) console.log(`   ... and ${emptyEn.length - 5} more`);
      console.log();
    }

    if (missingEs.length > 0) {
      console.log(`⚠️  ${missingEs.length} keys are missing Spanish translations:`);
      missingEs.slice(0, 10).forEach((k) => console.log(`   - ${k}`));
      if (missingEs.length > 10) console.log(`   ... and ${missingEs.length - 10} more`);
      console.log();
    }

    // Compare with existing files
    const messagesDir = join(__dirname, "..", "messages");
    const enPath = join(messagesDir, "en.json");
    const esPath = join(messagesDir, "es.json");

    const existingEn = existsSync(enPath)
      ? JSON.parse(readFileSync(enPath, "utf-8"))
      : {};
    const existingEs = existsSync(esPath)
      ? JSON.parse(readFileSync(esPath, "utf-8"))
      : {};

    const enCount = Object.keys(enMessages).length - 1; // Exclude $schema
    const esCount = Object.keys(esMessages).length - 1;
    const existingEnCount = Object.keys(existingEn).length - 1;
    const existingEsCount = Object.keys(existingEs).length - 1;

    console.log("─".repeat(50));
    console.log(`English: ${existingEnCount} → ${enCount} keys`);
    console.log(`Spanish: ${existingEsCount} → ${esCount} keys`);
    console.log();

    if (DRY_RUN) {
      console.log("🔍 Dry run complete. No files were written.");
      console.log("   Run without --dry-run to apply changes.");
    } else {
      writeFileSync(enPath, JSON.stringify(enMessages, null, 2) + "\n");
      console.log(`✓ Updated messages/en.json (${enCount} messages)`);

      if (esIndex !== -1 && esCount > 0) {
        writeFileSync(esPath, JSON.stringify(esMessages, null, 2) + "\n");
        console.log(`✓ Updated messages/es.json (${esCount} messages)`);
      }

      console.log("\nRun 'pnpm audit-messages' to verify the sync.");
    }
  } catch (error) {
    console.error("\n❌ Error syncing messages:", error.message);
    process.exit(1);
  }
}

syncMessages();
