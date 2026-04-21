#!/usr/bin/env bun
/**
 * Verkada Camera Audio Audit
 *
 * Checks microphone/audio status on all cameras in a Verkada org.
 * Used for privacy compliance audits — verifies audio is disabled
 * on cameras where it should be.
 *
 * Usage:
 *   VERKADA_API_KEY="<key>" bun run audit.ts
 *   VERKADA_API_KEY="<key>" bun run audit.ts --csv > report.csv
 *
 * API Key Requirements:
 *   Create in Verkada Command → Integrations → API Keys
 *   Required scopes: "Cameras" + "Camera Audio"
 *
 * https://github.com/bizgroup-dev/verkada-audio-audit
 */

const API_BASE = 'https://api.verkada.com';
const RATE_LIMIT_DELAY = 250; // 4 req/sec (under Verkada's 300/min limit)

interface Camera {
  camera_id: string;
  name: string;
  model: string;
  serial: string;
  site: string;
  site_id: string;
  status: string;
  local_ip: string;
}

async function getToken(apiKey: string): Promise<string> {
  const res = await fetch(`${API_BASE}/token`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) {
    if (res.status === 409) {
      console.error('Error: Another API token is active for this org.');
      console.error('Wait 30 minutes for it to expire, then try again.');
      process.exit(1);
    }
    throw new Error(`Token request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()).token;
}

async function getAllCameras(token: string): Promise<Camera[]> {
  const all: Camera[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ page_size: '200' });
    if (pageToken) params.set('page_token', pageToken);

    const res = await fetch(`${API_BASE}/cameras/v1/devices?${params}`, {
      headers: { 'x-verkada-auth': token },
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.error('Error: API key does not have "Cameras" permission.');
        console.error('Edit the key in Verkada Command and add the Cameras scope.');
        process.exit(1);
      }
      throw new Error(`Camera list failed: ${res.status}`);
    }

    const data = await res.json();
    all.push(...(data.cameras || []));
    pageToken = data.next_page_token;
  } while (pageToken);

  return all;
}

async function getAudioStatus(token: string, cameraId: string): Promise<boolean | 'error' | 'no-permission'> {
  try {
    const res = await fetch(`${API_BASE}/cameras/v1/audio/status?camera_id=${cameraId}`, {
      headers: { 'x-verkada-auth': token },
    });
    if (res.status === 401 || res.status === 403) return 'no-permission';
    if (!res.ok) return 'error';
    return (await res.json()).enabled === true;
  } catch {
    return 'error';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main ---

const apiKey = process.env.VERKADA_API_KEY;
if (!apiKey) {
  console.error('Usage: VERKADA_API_KEY="<key>" bun run audit.ts [--csv]');
  console.error('');
  console.error('Create an API key in Verkada Command with "Cameras" + "Camera Audio" scopes.');
  console.error('See README.md for detailed instructions.');
  process.exit(1);
}

const csvMode = process.argv.includes('--csv');

if (!csvMode) {
  console.log('');
  console.log('  Verkada Camera Audio Audit');
  console.log('  =========================');
  console.log('');
  console.log('  Authenticating...');
}

const token = await getToken(apiKey);

if (!csvMode) console.log('  Fetching cameras...');

const cameras = await getAllCameras(token);

cameras.sort((a, b) => {
  const siteCompare = (a.site || '').localeCompare(b.site || '');
  return siteCompare !== 0 ? siteCompare : (a.name || '').localeCompare(b.name || '');
});

if (!csvMode) console.log(`  Found ${cameras.length} cameras. Checking audio...\n`);

if (csvMode) {
  console.log('Site,Camera Name,Model,Serial,Online,Audio Enabled');
}

let enabledCount = 0;
let disabledCount = 0;
let errorCount = 0;
const enabledCameras: { site: string; name: string; model: string }[] = [];

for (let i = 0; i < cameras.length; i++) {
  const cam = cameras[i];

  if (!csvMode) {
    process.stdout.write(`  [${i + 1}/${cameras.length}] ${cam.name || '(unnamed)'}...`);
  }

  const audioEnabled = await getAudioStatus(token, cam.camera_id);

  if (audioEnabled === true) {
    enabledCount++;
    enabledCameras.push({ site: cam.site, name: cam.name, model: cam.model });
  } else if (audioEnabled === false) {
    disabledCount++;
  } else {
    errorCount++;
  }

  if (csvMode) {
    const audioStr = audioEnabled === true ? 'ENABLED' : audioEnabled === false ? 'disabled' : String(audioEnabled);
    const online = cam.status === 'Live' ? 'Yes' : 'No';
    console.log(`"${cam.site || ''}","${cam.name || ''}","${cam.model || ''}","${cam.serial || ''}","${online}","${audioStr}"`);
  } else {
    const icon = audioEnabled === true ? ' 🔴 ENABLED' : audioEnabled === false ? ' ✅ disabled' : ` ⚠️  ${audioEnabled}`;
    console.log(icon);
  }

  if (i < cameras.length - 1) await sleep(RATE_LIMIT_DELAY);
}

if (!csvMode) {
  console.log('');
  console.log('  =========================');
  console.log('  Summary');
  console.log('  =========================');
  console.log(`  Total cameras:    ${cameras.length}`);
  console.log(`  Audio ENABLED:    ${enabledCount}${enabledCount > 0 ? ' ⚠️  REVIEW FOR PRIVACY' : ''}`);
  console.log(`  Audio disabled:   ${disabledCount}`);
  if (errorCount > 0) {
    console.log(`  Errors:           ${errorCount}`);
    console.log('                    (Key may need "Camera Audio" scope added)');
  }

  if (enabledCount > 0) {
    console.log('');
    console.log('  ⚠️  Cameras with audio ENABLED:');
    console.log('  ─────────────────────────────────────');
    for (const c of enabledCameras) {
      console.log(`    ${c.site} → ${c.name} (${c.model})`);
    }
  } else if (errorCount === 0) {
    console.log('');
    console.log('  ✅ All cameras have audio disabled. No privacy concerns.');
  }

  console.log('');
  console.log('  Export to CSV: VERKADA_API_KEY="<key>" bun run audit.ts --csv > report.csv');
  console.log('');
}
