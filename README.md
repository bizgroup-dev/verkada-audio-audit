# Verkada Camera Audio Audit

Bulk-check microphone/audio status across all cameras in a Verkada organization. Identifies cameras with audio enabled for privacy compliance audits.

**Why?** Verkada Command only lets you check audio settings one camera at a time. With 100+ cameras, that's impractical. This tool audits your entire fleet in seconds.

## Quick Start

```bash
# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Clone this repo
git clone https://github.com/bizgroup-dev/verkada-audio-audit.git
cd verkada-audio-audit

# Run the audit
VERKADA_API_KEY="<your-key>" bun run audit.ts
```

## Creating the API Key

1. Log into **Verkada Command** at [command.verkada.com](https://command.verkada.com)
2. Click the **gear icon** (bottom-left) → **Integrations** → **API Keys**
3. Click **+ Add API Key**
4. Set:
   - **Name:** `audio-audit` (or any label)
   - **Permissions:** Check both:
     - ✅ **Cameras**
     - ✅ **Camera Audio**
   - **Sites:** All Sites (or select specific sites)
5. Click **Create** and **copy the key**

> API keys expire after 90 days. For one-time audits, delete the key when done.

## Usage

### Terminal output

```bash
VERKADA_API_KEY="<key>" bun run audit.ts
```

```
  Verkada Camera Audio Audit
  =========================

  Found 17 cameras. Checking audio...

  [1/17] Lobby Camera... ✅ disabled
  [2/17] Front Entrance... ✅ disabled
  [3/17] Break Room... 🔴 ENABLED

  =========================
  Summary
  =========================
  Total cameras:    17
  Audio ENABLED:    1 ⚠️  REVIEW FOR PRIVACY
  Audio disabled:   16

  ⚠️  Cameras with audio ENABLED:
  ─────────────────────────────────────
    Main Office → Break Room (CD41)
```

### CSV export

```bash
VERKADA_API_KEY="<key>" bun run audit.ts --csv > audio-report.csv
```

Opens in Excel/Google Sheets. Columns: Site, Camera Name, Model, Serial, Online, Audio Enabled.

## How It Works

1. Authenticates with the Verkada API using your key
2. Lists all cameras in the organization (paginated)
3. Checks audio status on each camera individually
4. Rate-limited to 4 requests/second (well under Verkada's 300/min limit)

| Fleet Size | Audit Time |
|-----------|-----------|
| 20 cameras | ~5 seconds |
| 100 cameras | ~30 seconds |
| 500 cameras | ~2.5 minutes |
| 1,000 cameras | ~5 minutes |

## Troubleshooting

| Error | Fix |
|-------|-----|
| `409 Conflict` | Another API token is active. Wait 30 minutes or use a different key. |
| `401 on camera list` | API key needs **Cameras** permission. Edit in Verkada Command. |
| All cameras show `error` | API key needs **Camera Audio** permission. Edit in Verkada Command. |
| `401 on token` | Key is invalid or expired. Create a new one (90-day expiry). |

## Requirements

- [Bun](https://bun.sh) runtime (v1.0+)
- Network access to `api.verkada.com`
- No other dependencies

## License

MIT

---

Built by [VanBelkum](https://vanbelkum.com) — Managed IT, Security & Communications for West Michigan.
