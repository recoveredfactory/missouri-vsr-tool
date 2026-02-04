#!/usr/bin/env node

/**
 * Audit script for translation messages
 *
 * Finds:
 * - Keys used in code but missing from messages/en.json
 * - Keys in en.json but missing from es.json (untranslated)
 * - Keys in messages but not used in code (dead keys)
 *
 * Run: pnpm audit-messages
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcDir = join(__dirname, "..", "src");
const messagesDir = join(__dirname, "..", "messages");

// Load message files
const enMessages = JSON.parse(readFileSync(join(messagesDir, "en.json"), "utf-8"));
const esMessages = JSON.parse(readFileSync(join(messagesDir, "es.json"), "utf-8"));

// Get all keys (excluding $schema)
const enKeys = new Set(Object.keys(enMessages).filter((k) => k !== "$schema"));
const esKeys = new Set(Object.keys(esMessages).filter((k) => k !== "$schema"));

// Patterns to match message usage in code
const patterns = [
  // m.key_name() - direct function calls
  /\bm\.([a-z][a-z0-9_]*)\s*\(/g,
  // import { key_name, ... } from "$lib/paraglide/messages"
  /import\s*\{([^}]+)\}\s*from\s*["'](?:\$lib\/paraglide\/messages|\.\.\/.*messages)["']/g,
];

// Recursively find all .svelte and .ts/.js files
function findFiles(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findFiles(fullPath, files);
    } else if (/\.(svelte|ts|js)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

// Extract message keys from a file
function extractKeysFromFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const keys = new Set();

  // Match m.key_name() pattern
  const mCallPattern = /\bm\.([a-z][a-z0-9_]*)\s*\(/g;
  let match;
  while ((match = mCallPattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  // Match imported function names from paraglide/messages
  const importPattern = /import\s*\{([^}]+)\}\s*from\s*["'](?:\$lib\/paraglide\/messages|[^"']*messages)["']/g;
  while ((match = importPattern.exec(content)) !== null) {
    const imports = match[1].split(",").map((s) => s.trim());
    for (const imp of imports) {
      // Handle "name as alias" syntax
      const name = imp.split(/\s+as\s+/)[0].trim();
      if (name && /^[a-z][a-z0-9_]*$/.test(name)) {
        keys.add(name);
      }
    }
  }

  // Also match direct function calls for imported names
  // e.g., search_placeholder() after import { search_placeholder }
  const functionCallPattern = /\b([a-z][a-z0-9_]*)\s*\(\s*\)/g;
  while ((match = functionCallPattern.exec(content)) !== null) {
    const name = match[1];
    // Only add if it looks like a message key (has underscore or matches known patterns)
    if (name.includes("_") && !["console_log", "import_meta"].includes(name)) {
      keys.add(name);
    }
  }

  return keys;
}

// Find all used keys in codebase
function findUsedKeys() {
  const files = findFiles(srcDir);
  const usedKeys = new Set();

  for (const file of files) {
    const keys = extractKeysFromFile(file);
    for (const key of keys) {
      usedKeys.add(key);
    }
  }

  return usedKeys;
}

// Main audit
function audit() {
  console.log("Auditing translation messages...\n");

  const usedKeys = findUsedKeys();
  let hasIssues = false;

  // 1. Keys used in code but missing from en.json
  const missingInEn = [...usedKeys].filter((k) => !enKeys.has(k)).sort();
  if (missingInEn.length > 0) {
    hasIssues = true;
    console.log("❌ Keys used in code but MISSING from en.json:");
    for (const key of missingInEn) {
      console.log(`   - ${key}`);
    }
    console.log();
  }

  // 2. Keys in en.json but missing from es.json (untranslated)
  const missingInEs = [...enKeys].filter((k) => !esKeys.has(k)).sort();
  if (missingInEs.length > 0) {
    hasIssues = true;
    console.log("⚠️  Keys in en.json but MISSING from es.json (need translation):");
    for (const key of missingInEs) {
      console.log(`   - ${key}`);
    }
    console.log();
  }

  // 3. Keys in messages but not used in code (dead keys)
  const unusedKeys = [...enKeys].filter((k) => !usedKeys.has(k)).sort();
  if (unusedKeys.length > 0) {
    hasIssues = true;
    console.log("⚠️  Keys in en.json but NOT USED in code (potentially dead):");
    for (const key of unusedKeys) {
      console.log(`   - ${key}`);
    }
    console.log();
  }

  // 4. Keys in es.json but not in en.json (orphaned translations)
  const orphanedInEs = [...esKeys].filter((k) => !enKeys.has(k)).sort();
  if (orphanedInEs.length > 0) {
    hasIssues = true;
    console.log("⚠️  Keys in es.json but NOT in en.json (orphaned):");
    for (const key of orphanedInEs) {
      console.log(`   - ${key}`);
    }
    console.log();
  }

  // Summary
  console.log("─".repeat(50));
  console.log(`Total keys in en.json: ${enKeys.size}`);
  console.log(`Total keys in es.json: ${esKeys.size}`);
  console.log(`Total keys used in code: ${usedKeys.size}`);
  console.log();

  if (!hasIssues) {
    console.log("✅ All translations are in sync!");
  } else {
    console.log("Run 'pnpm export-messages' to export current messages to CSV,");
    console.log("update the Google Sheet, then 'pnpm sync-messages' to pull changes.");
  }

  // Exit with error if there are missing keys (critical)
  if (missingInEn.length > 0) {
    process.exit(1);
  }
}

audit();
