# Translation Management

This project uses [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) for internationalization with Google Sheets as the source of truth for translations.

## Quick Start

```bash
# Sync translations from Google Sheets
pnpm sync-messages

# Preview without writing files
pnpm sync-messages --dry-run

# Export current messages to CSV
pnpm export-messages

# Audit for missing/unused keys
pnpm audit-messages
```

## Google Sheets Setup

**Sheet URL:** [Missouri VSR Translations](https://docs.google.com/spreadsheets/d/1jIyytsvBSSVCNC1m29N17F8S8HQqoq2j4Oqb0II4Xlc/edit)

### Required Configuration

The sheet MUST be publicly viewable for the sync script to work:

1. Open the Google Sheet
2. Click the **Share** button (top right)
3. Under **General access**, click and select **"Anyone with the link"**
4. Ensure the permission is set to **Viewer**
5. Click **Done**

### Sheet Format

The sheet must have these columns (header row):

| key | en | es |
|-----|----|----|
| home_title | Hello world | Hola mundo |
| home_subtitle | Welcome | Bienvenido |

- **key**: The message identifier (snake_case, e.g., `home_hero_headline`)
- **en**: English translation (required)
- **es**: Spanish translation (optional, will warn if missing)

## Workflow

### Adding New Translations

1. Add the key to the Google Sheet with English text
2. Add the Spanish translation (or leave empty to add later)
3. Run `pnpm sync-messages` to pull changes
4. Run `pnpm audit-messages` to verify

### Using Translations in Code

```svelte
<script>
  import * as m from "$lib/paraglide/messages";
</script>

<h1>{m.home_hero_headline()}</h1>
```

Or import specific messages:

```svelte
<script>
  import { home_hero_headline } from "$lib/paraglide/messages";
</script>

<h1>{home_hero_headline()}</h1>
```

### Message Parameters

For dynamic content, use curly braces in the translation:

**Google Sheet:**
| key | en | es |
|-----|----|----|
| greeting | Hello, {name}! | ¡Hola, {name}! |

**Code:**
```svelte
{m.greeting({ name: "Maria" })}
```

## Scripts

### `pnpm sync-messages`

Downloads translations from Google Sheets and updates `messages/en.json` and `messages/es.json`.

Options:
- `--dry-run`: Preview changes without writing files

Environment:
- `GOOGLE_SHEET_ID`: Override the default sheet ID

### `pnpm export-messages`

Exports current `messages/*.json` files to `messages-export.csv`. Use this to:
- Initialize the Google Sheet with existing translations
- Backup current translations
- Review changes before syncing

### `pnpm audit-messages`

Checks for translation issues:
- Keys used in code but missing from `en.json` (error)
- Keys in `en.json` but missing from `es.json` (warning)
- Keys in messages but not used in code (warning)
- Keys in `es.json` but not in `en.json` (warning)

## Troubleshooting

### "Authentication error" or "Received HTML instead of CSV"

The Google Sheet is not publicly accessible. See [Google Sheets Setup](#google-sheets-setup).

### "Sheet must have a 'key' column"

The header row is missing or incorrectly named. Ensure the first row has: `key`, `en`, `es`

### Keys showing as "missing in code"

The audit script might not detect all usage patterns. Common causes:
- Dynamic key construction (e.g., `m[keyName]()`)
- Keys used in data files instead of components

### Missing Spanish translations

Run `pnpm audit-messages` to see which keys need translation, then update the Google Sheet.

## File Structure

```
packages/web/
├── messages/
│   ├── en.json          # English translations (synced from Sheets)
│   └── es.json          # Spanish translations (synced from Sheets)
├── scripts/
│   ├── sync-messages.js    # Pull from Google Sheets
│   ├── export-messages-csv.js  # Export to CSV
│   └── audit-messages.js   # Check for issues
└── TRANSLATIONS.md         # This file
```

## Reconciliation (One-Time Setup)

If starting fresh or reconciling existing translations:

1. Export current messages: `pnpm export-messages`
2. Open `messages-export.csv` and copy all content
3. Paste into the Google Sheet (replacing existing content)
4. Review and fix any issues in the sheet
5. Run `pnpm sync-messages` to verify round-trip works
6. From now on, edit only in Google Sheets

## Notes

- The `$schema` key in JSON files is auto-generated and should not be in the Google Sheet
- Keys should use snake_case (e.g., `home_hero_headline`)
- Empty English values are skipped during sync
- The sync script overwrites local files - always edit in Google Sheets
