// Local After Effects automation for the Render Farm stage: find AEPs, and
// for a given one, disable its text layers and save a "_TEXTLESS" copy.
// Footage/relink handling used to live here too (for the Nexrender Cloud
// pipeline) but the render farm this app now targets resolves footage
// itself — this module only needs to answer "does this project have text,
// and can we save a copy with it turned off."
//
// Drives AE via osascript + a JSON sentinel file, the same shape this app's
// very first local-render automation used.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function esc(p) { return String(p).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

// ---------- JSX generation ----------

// One AE pass: walks every comp/layer, disables matches (real TextLayers,
// TXT_-prefixed names, label color 9 — same rule used everywhere else in
// this codebase), and if none were found skips the save entirely (nothing
// to make textless). Sentinel JSON is built with a plain for loop, not
// .map — this After Effects' ExtendScript engine doesn't reliably support
// Array.prototype.map inside a DoScriptFile call (CLAUDE.md hard-won bug #19).
function buildDisableAndSaveJsx(aepPath, outAepPath, sentinelPath) {
  return `(function () {
  var LABEL = 9;
  var disabled = 0;
  function jstr(s) { return '"' + String(s).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"').replace(/\\n/g, ' ') + '"'; }
  try {
    var f = new File("${esc(aepPath)}");
    if (!f.exists) throw new Error("AEP not found");
    app.beginSuppressDialogs();
    app.open(f);
    for (var i = 1; i <= app.project.numItems; i++) {
      var it = app.project.item(i);
      if (!(it instanceof CompItem)) continue;
      for (var L = 1; L <= it.numLayers; L++) {
        var ly;
        try { ly = it.layer(L); } catch (eL) { continue; }
        try {
          if ((ly instanceof TextLayer) || (/^TXT_/i.test(ly.name)) || ly.label === LABEL) {
            if (ly.enabled) { ly.enabled = false; disabled++; }
          }
        } catch (eT) {}
      }
    }
    if (disabled === 0) {
      app.endSuppressDialogs(false);
      var o0 = new File("${esc(sentinelPath)}");
      o0.encoding = "UTF-8"; o0.open("w");
      o0.write('{"skipped":true,"disabled":0}');
      o0.close();
      return;
    }
    var saveTo = new File("${esc(outAepPath)}");
    app.project.save(saveTo);
    app.endSuppressDialogs(false);
    var o = new File("${esc(sentinelPath)}");
    o.encoding = "UTF-8"; o.open("w");
    o.write('{"skipped":false,"disabled":' + disabled + ',"savedAep":' + jstr(saveTo.fsName) + '}');
    o.close();
  } catch (err) {
    try { app.endSuppressDialogs(false); } catch (e2) {}
    var o2 = new File("${esc(sentinelPath)}");
    o2.encoding = "UTF-8"; o2.open("w");
    o2.write('{"error":' + jstr(String(err)) + '}');
    o2.close();
  }
})();`;
}

// ---------- driving After Effects ----------

function findAEApp() {
  const roots = ['/Applications', path.join(os.homedir(), 'Applications')];
  for (const root of roots) {
    let entries = [];
    try { entries = fs.readdirSync(root); } catch (e) { continue; }
    const dir = entries.filter(n => /^Adobe After Effects/i.test(n)).sort().pop();
    if (!dir) continue;
    const inside = path.join(root, dir);
    if (dir.endsWith('.app')) return dir.replace(/\.app$/, '');
    try {
      const app = fs.readdirSync(inside).find(n => /^Adobe After Effects.*\.app$/i.test(n));
      if (app) return app.replace(/\.app$/, '');
    } catch (e) { /* keep looking */ }
  }
  return null;
}

function runOsascript(jsxPath) {
  const appName = findAEApp();
  const target = appName ? `application "${appName}"` : 'application id "com.adobe.AfterEffects"';
  return new Promise((resolve, reject) => {
    execFile('osascript',
      ['-e', `tell ${target} to activate`,
       '-e', `tell ${target} to DoScriptFile "${jsxPath.replace(/"/g, '\\"')}"`],
      { timeout: 120000 },
      err => (err ? reject(new Error(
        `Could not reach After Effects${appName ? ` ("${appName}")` : ' (not found in /Applications?)'}: ${err.message}` +
        ' — if macOS asked permission to control After Effects, allow it and retry.'))
        : resolve()));
  });
}

function waitForSentinel(sentinelPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const iv = setInterval(() => {
      let rep = null;
      try { rep = JSON.parse(fs.readFileSync(sentinelPath, 'utf8')); } catch (e) { /* not written yet */ }
      if (rep) {
        clearInterval(iv);
        if (rep.error) reject(new Error(rep.error));
        else resolve(rep);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(iv);
        reject(new Error('Timed out waiting for After Effects to respond. Check: AE is running · Preferences → Scripting & Expressions → "Allow Scripts to Write Files and Access Network" is ON · no dialog box is blocking AE.'));
      }
    }, 1500);
  });
}

// Opens the AEP, disables matching text layers, and saves a <name>_TEXTLESS.aep
// copy beside the original — unless nothing matched, in which case nothing
// is saved and { skipped: true } comes back (matches this app's long-standing
// "nothing to make textless" behavior).
async function disableTextAndSave(aepPath) {
  const dir = path.dirname(aepPath);
  const base = path.basename(aepPath).replace(/\.aep$/i, '');
  const outAepPath = path.join(dir, `${base}_TEXTLESS.aep`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aeptextless-'));
  const sentinel = path.join(tmp, 'report.json');
  const jsxPath = path.join(tmp, 'disable.jsx');
  fs.writeFileSync(jsxPath, buildDisableAndSaveJsx(aepPath, outAepPath, sentinel));
  await runOsascript(jsxPath);
  const report = await waitForSentinel(sentinel, 5 * 60 * 1000);
  if (report.skipped) return { aep: aepPath, skipped: true };
  return { aep: aepPath, skipped: false, layersDisabled: report.disabled, savedAep: report.savedAep || outAepPath };
}

// Find .aep files under a root (skips _TEXTLESS copies, auto-save folders, junk)
const SKIP_DIR = /auto-?save|adobe after effects auto|\bbackup\b|old versions?/i;
function scanAeps(root, maxDepth = 6) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth || out.length > 500) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIR.test(e.name)) continue;
        walk(p, depth + 1);
      } else if (/\.aep$/i.test(e.name) && !/_TEXTLESS\.aep$/i.test(e.name) && !/auto-?save/i.test(e.name)) {
        out.push(p);
      }
    }
  };
  walk(root, 0);
  return out;
}

module.exports = {
  buildDisableAndSaveJsx,
  findAEApp,
  disableTextAndSave,
  scanAeps,
};
