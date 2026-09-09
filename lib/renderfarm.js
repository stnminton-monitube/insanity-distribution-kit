// Render Farm stage → the user's own Notion/Dropbox render farm, via a
// centralized relay (insanity-dashboard's POST /api/extension/renderfarm/queue).
//
// This app used to talk to Notion/Dropbox directly with its own per-user
// credentials (a Dropbox OAuth connection, a farm-specific Notion token).
// That's been replaced: this is rolling out to 15+ editors, and credentials
// belong in exactly one place — the relay — not scattered across every
// laptop. This module now does only what genuinely has to happen locally:
//   - disabling text layers (needs a real local After Effects install)
//   - converting a local Mac path into a Dropbox API path (pure string
//     logic, no credentials needed)
// Everything credentialed (resolving the right per-project "MGX:" Notion
// database, finding/creating a row, confirming Dropbox sync, setting the
// Queue properties) happens server-side now — see that repo's renderfarm.js.
const path = require('path');
const { disableTextAndSave } = require('./aepinspect');

// Local Mac path -> Dropbox API path: anchor on the team folder name
// (configurable — defaults to "Insanity Media Dropbox") and return
// everything after it. Pure string surgery, no API call, no credentials.
function localPathToDropboxPath(localPath, settings) {
  const anchor = (settings && settings.dropboxLocalAnchor) || 'Insanity Media Dropbox';
  const idx = localPath.indexOf(anchor);
  if (idx === -1) {
    throw new Error(`"${localPath}" doesn't contain "${anchor}" — is this file actually inside your Dropbox folder? (Anchor is configurable in Settings.)`);
  }
  let rest = localPath.slice(idx + anchor.length).replace(/\\/g, '/');
  if (!rest.startsWith('/')) rest = '/' + rest;
  return rest;
}

// Walks up from an AEP's path looking for a folder name that looks like a
// project code (e.g. "IB50 - Steven Douglas", "TUBI-1 - ..."). Same stable-
// prefix idea the farm's own dbx.js findProject/mgx-map keys on — the relay
// uses this same rule server-side to resolve the MGX: database.
function findProjectFolderName(aepPath) {
  const parts = path.dirname(aepPath).split(path.sep).reverse();
  for (const p of parts) {
    if (/^[A-Za-z]+-?\d+/.test(p)) return p;
  }
  return parts[0] || '';
}

// One HTTP call to the relay. Everything credentialed happens on the other
// side of this — this app never sees a Notion or Dropbox secret.
async function queueOnRelay(relayUrl, relayToken, payload) {
  const base = String(relayUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('No render farm relay URL set — add one in Settings.');
  if (!relayToken) throw new Error('No render farm relay token set — add one in Settings.');
  const res = await fetch(`${base}/api/extension/renderfarm/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${relayToken}`,
    },
    body: JSON.stringify(payload),
  });
  let json = {};
  try { json = await res.json(); } catch (e) { /* non-JSON error body */ }
  if (!res.ok) throw new Error(json.error || `Render farm relay error ${res.status}`);
  return json;
}

// ---------- orchestration ----------

// Sends one AEP to the farm. mode: 'texted' | 'textless' | 'both'.
// format: 'Default' | 'Alpha' (passed explicitly per batch, not read from
// settings — the UI's choice for THIS batch should never be ambiguous).
// For textless/both, disables text layers locally first (real AE, can only
// happen on this machine) — the relay itself confirms the resulting
// _TEXTLESS.aep has actually reached Dropbox before queuing anything, so
// this doesn't need to check that itself anymore.
async function sendToFarm(aepPath, settings, mode, format, onProgress) {
  if (mode === 'textless' || mode === 'both') {
    onProgress && onProgress('checking for text layers…');
    const result = await disableTextAndSave(aepPath);
    if (result.skipped) return { aep: aepPath, skipped: true };
    onProgress && onProgress(`${result.layersDisabled} text layer(s) disabled…`);
  }

  // Always the TEXTED file's path — the relay derives the _TEXTLESS.aep
  // sibling itself when queuing a textless/both job.
  const dropboxPath = localPathToDropboxPath(aepPath, settings);
  const projectFolderName = findProjectFolderName(aepPath);
  const rowLabel = path.basename(aepPath, '.aep');

  onProgress && onProgress('queuing on the render farm…');
  const result = await queueOnRelay(settings.farmRelayUrl, settings.farmRelayToken, {
    dropboxPath,
    projectFolderName,
    rowLabel,
    format: format || 'Default',
    mode,
  });

  return { aep: aepPath, queued: true, row: result.row, mode };
}

let batchCancelled = false;
function cancelBatch() { batchCancelled = true; }

async function runFarmBatch(aepPaths, settings, mode, format, onProgress) {
  batchCancelled = false;
  const results = [];
  for (let i = 0; i < aepPaths.length; i++) {
    if (batchCancelled) {
      onProgress(`Batch stopped — ${i}/${aepPaths.length} processed.`);
      break;
    }
    const aep = aepPaths[i];
    const tag = `[${i + 1}/${aepPaths.length}] ${path.basename(aep)}`;
    try {
      const report = await sendToFarm(aep, settings, mode, format, msg => onProgress(`${tag} — ${msg}`));
      results.push(report);
      onProgress(`${tag} — ${report.skipped ? 'skipped (no text found)' : `✔ queued as "${report.row}" (${report.mode})`}`);
    } catch (e) {
      results.push({ aep, error: e.message });
      onProgress(`${tag} — ✖ ${e.message}`);
    }
  }
  return results;
}

module.exports = {
  localPathToDropboxPath,
  findProjectFolderName,
  queueOnRelay,
  sendToFarm,
  runFarmBatch,
  cancelBatch,
};
