const { app, BrowserWindow, ipcMain, dialog, shell, powerSaveBlocker } = require('electron');

// Keep the machine awake during long ffmpeg/AE jobs
async function keepAwake(job) {
  const id = powerSaveBlocker.start('prevent-app-suspension');
  try { return await job(); }
  finally { try { powerSaveBlocker.stop(id); } catch (e) { /* ignore */ } }
}
const path = require('path');
const fs = require('fs');
const { runQC } = require('./lib/qc');
const { buildMaster } = require('./lib/build');
const { CORE, ANCILLARY, STATUSES } = require('./lib/checklist');
const { STAGES } = require('./lib/stages');
const { TEMPLATES } = require('./lib/templates');
const intake = require('./lib/intake');
const notion = require('./lib/notion');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 820,
    title: 'Media Distribution Toolkit',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ---------- file pickers ----------
ipcMain.handle('pick-files', async (_e, opts = {}) => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile', ...(opts.multi ? ['multiSelections'] : [])],
    filters: opts.filters || [{ name: 'Media', extensions: ['mov', 'mp4', 'mxf', 'wav'] }, { name: 'All files', extensions: ['*'] }],
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('pick-save', async (_e, defaultName) => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters: [{ name: 'QuickTime MOV', extensions: ['mov'] }],
  });
  return r.canceled ? null : r.filePath;
});

// ---------- QC ----------
ipcMain.handle('run-qc', async (_e, file) => runQC(file));

// ---------- Build ----------
ipcMain.handle('build-master', async (e, opts) => {
  return keepAwake(() => buildMaster({
    ...opts,
    onProgress: stage => e.sender.send('build-progress', stage),
  }));
});

// ---------- Checklist persistence ----------
const storeFile = () => path.join(app.getPath('userData'), 'feg-projects.json');

ipcMain.handle('checklist-defs', () => ({ CORE, ANCILLARY, STATUSES }));

ipcMain.handle('load-projects', () => {
  try { return JSON.parse(fs.readFileSync(storeFile(), 'utf8')); } catch (e) { return []; }
});

ipcMain.handle('save-projects', (_e, projects) => {
  fs.writeFileSync(storeFile(), JSON.stringify(projects, null, 2));
  return true;
});

// ---------- Workflow stages ----------
ipcMain.handle('stage-defs', () => STAGES);
const { GUIDE_STEPS } = require('./lib/guide');
ipcMain.handle('guide-defs', () => GUIDE_STEPS);

ipcMain.handle('pick-directory', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('open-external', (_e, url) => shell.openExternal(url));
ipcMain.handle('open-folder', (_e, p) => shell.openPath(p));

// Check a file for a stage, WITHOUT filing it yet
ipcMain.handle('intake-check', async (_e, { stageId, filePath }) => {
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage || !stage.intake) throw new Error('This stage does not accept files.');
  const kind = stage.intake.check;
  if (kind === 'video') return runQC(filePath);
  if (kind === 'wav') return intake.checkWav(filePath);
  if (kind === 'timings') return intake.checkTimings(filePath);
  return intake.checkExt(filePath, stage.intake.accept);
});

// File it into the episode's Distribution folder
ipcMain.handle('intake-file', async (_e, { stageId, filePath, episodeFolder }) => {
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage || !stage.intake) throw new Error('This stage does not accept files.');
  let s = {};
  try { s = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch (e) { /* defaults */ }
  const distName = s.distFolderName || 'Distribution';
  const dest = intake.fileIt(filePath, episodeFolder, distName, stage.intake.sub);
  return { dest, distFolder: path.join(episodeFolder, distName) };
});

// Creates the full Distribution folder tree (01 Master, 02 Textless, etc. —
// derived from every stage's own intake.sub, so this can't drift from what
// intake-file actually files into) right when a project folder gets linked,
// instead of each subfolder only ever appearing lazily the first time
// something gets filed into it.
ipcMain.handle('ensure-dist-folders', (_e, { episodeFolder, distName }) => {
  const name = distName || 'Distribution';
  const subs = [...new Set(STAGES.filter(s => s.intake).map(s => s.intake.sub))];
  for (const sub of subs) fs.mkdirSync(path.join(episodeFolder, name, sub), { recursive: true });
  return { distFolder: path.join(episodeFolder, name), subs };
});

ipcMain.handle('notion-set-dropbox-path', async (_e, { pageId, folderPath }) => {
  const s = creds();
  return notion.setDropboxPath(s.notionToken, pageId, folderPath);
});

// ---------- Automation: Premiere XML & caption parsing ----------
const { parseSequenceXML, makeTextlessXML, makeCleanXML } = require('./lib/premxml');
ipcMain.handle('make-clean-xml', (_e, { xmlPath, pattern }) => makeCleanXML(xmlPath, pattern));
const { parseCaptions, retimeCaptionFile } = require('./lib/sccparse');
ipcMain.handle('retime-captions', (_e, filePath) => retimeCaptionFile(filePath));
const aepinspect = require('./lib/aepinspect');
const renderfarm = require('./lib/renderfarm');

ipcMain.handle('parse-sequence-xml', (_e, filePath) => parseSequenceXML(filePath));
ipcMain.handle('parse-captions', (_e, filePath) => parseCaptions(filePath));

// ---------- Render Farm (queues renders via the centralized render-
// farm relay — see lib/renderfarm.js; credentials live server-side now,
// not in this app's Settings) ----------
ipcMain.handle('scan-aeps', (_e, root) => aepinspect.scanAeps(root));
ipcMain.handle('farm-send-batch', async (e, { aeps, mode, format }) => {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch (err) { /* defaults */ }
  return renderfarm.runFarmBatch(aeps, s, mode, format, msg => e.sender.send('farm-progress', msg));
});
ipcMain.handle('farm-cancel-batch', () => { renderfarm.cancelBatch(); return true; });
ipcMain.handle('make-textless-xml', (_e, { xmlPath, pattern }) => makeTextlessXML(xmlPath, pattern));

const { verifyTextless } = require('./lib/ocrverify');
const stemforge = require('./lib/stemforge');

ipcMain.handle('stems-build', async (e, opts) => keepAwake(() => stemforge.buildStems({ ...opts, onProgress: m => e.sender.send('stem-progress', m) })));
ipcMain.handle('stems-embed', async (e, opts) => keepAwake(() => stemforge.embedMaster({ ...opts, onProgress: m => e.sender.send('stem-progress', m) })));
ipcMain.handle('stems-pad', async (e, opts) => keepAwake(() => stemforge.padStems({ ...opts, onProgress: m => e.sender.send('stem-progress', m) })));
ipcMain.handle('verify-textless', async (e, opts) => {
  return verifyTextless({ ...opts, onProgress: msg => e.sender.send('ocr-progress', msg) });
});

// Write a plain text file (e.g. generated segment timings CSV) into a Distribution subfolder
ipcMain.handle('write-text-file', (_e, { content, destDir, filename }) => {
  fs.mkdirSync(destDir, { recursive: true });
  let dest = path.join(destDir, filename);
  if (fs.existsSync(dest)) {
    const ext = path.extname(dest), base = dest.slice(0, -ext.length);
    let n = 2;
    while (fs.existsSync(`${base} v${n}${ext}`)) n++;
    dest = `${base} v${n}${ext}`;
  }
  fs.writeFileSync(dest, content);
  return dest;
});

// ---------- Document templates ----------
ipcMain.handle('template-defs', () => TEMPLATES);

// Render HTML to a PDF in the episode's docs folder (HTML fallback if PDF fails)
ipcMain.handle('export-doc', async (_e, { html, destDir, filename, header, footer }) => {
  fs.mkdirSync(destDir, { recursive: true });
  const versioned = (base, ext) => {
    let dest = path.join(destDir, base + ext);
    let n = 2;
    while (fs.existsSync(dest)) { dest = path.join(destDir, `${base} v${n}${ext}`); n++; }
    return dest;
  };
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const pdf = await w.webContents.printToPDF({
      pageSize: 'Letter', printBackground: true,
      displayHeaderFooter: true,
      // Repeats on every page (incl. page 1, alongside the in-content masthead) so a
      // reader who's holding page 4 of a long cue sheet can still see whose doc it is.
      headerTemplate: `<div style="font-size:7px;color:#a2a7b0;width:100%;padding:0 44px;font-family:Helvetica,Arial,sans-serif;letter-spacing:.25px;text-transform:uppercase">${esc(header || '')}</div>`,
      footerTemplate: `<div style="font-size:7.5px;color:#8a8a8a;width:100%;padding:0 44px;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif;letter-spacing:.3px">` +
        `<span>${esc(footer || '')}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
      margins: { top: 0.6, bottom: 0.7, left: 0.6, right: 0.6 },
    });
    const dest = versioned(filename, '.pdf');
    fs.writeFileSync(dest, pdf);
    return { dest, format: 'pdf' };
  } catch (err) {
    const dest = versioned(filename, '.html');
    fs.writeFileSync(dest, html);
    return { dest, format: 'html', note: 'PDF rendering failed (' + err.message + ') — saved as HTML instead; it prints to PDF from any browser.' };
  } finally {
    try { w.destroy(); } catch (e) { /* ignore */ }
  }
});

// ---------- Settings (Notion token etc.) ----------
const settingsFile = () => path.join(app.getPath('userData'), 'feg-settings.json');

ipcMain.handle('load-settings', () => {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch (e) { return {}; }
});

ipcMain.handle('save-settings', (_e, s) => {
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2));
  return true;
});

// ---------- Notion sync ----------
function creds() {
  try {
    const s = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    if (!s.notionToken || !s.notionDb) throw new Error('missing');
    return s;
  } catch (e) {
    throw new Error('Notion is not set up yet — add your token and database ID in the Notion tab.');
  }
}

ipcMain.handle('notion-test', async (_e, { token, dbId }) => notion.testConnection(token, dbId));
ipcMain.handle('notion-episodes', async () => {
  const s = creds();
  return notion.listEpisodes(s.notionToken, s.notionDb);
});
ipcMain.handle('notion-push-qc', async (_e, { pageId, asset, passed, failSummary }) => {
  const s = creds();
  return notion.pushQC(s.notionToken, pageId, asset, passed, failSummary);
});
ipcMain.handle('notion-set-asset', async (_e, { pageId, asset, status }) => {
  const s = creds();
  return notion.setAssetStatus(s.notionToken, pageId, asset, status);
});
ipcMain.handle('notion-set-status', async (_e, { pageId, status }) => {
  const s = creds();
  return notion.setPipelineStatus(s.notionToken, pageId, status);
});
ipcMain.handle('notion-create-episode', async (_e, fields) => {
  const s = creds();
  return notion.createEpisode(s.notionToken, s.notionDb, fields);
});
// One-time per episode: writes the description/spec/checklist onto the
// episode's own Notion page. Stage list always comes from STAGES itself, so
// this can't drift from what the app's own pipeline actually has.
ipcMain.handle('notion-create-checklist', async (_e, { pageId, description, specLines }) => {
  const s = creds();
  const stages = STAGES.map(st => ({ id: st.id, name: st.name }));
  return notion.createStageChecklist(s.notionToken, pageId, { description, specLines, stages });
});
ipcMain.handle('notion-set-checklist-item', async (_e, { blockId, checked }) => {
  const s = creds();
  return notion.setChecklistItem(s.notionToken, blockId, checked);
});

// ---------- Renamer ----------
ipcMain.handle('rename-files', async (_e, jobs) => {
  // jobs: [{ from, to }]
  const results = [];
  for (const j of jobs) {
    try {
      const dest = path.join(path.dirname(j.from), j.to);
      if (fs.existsSync(dest)) throw new Error('A file with that name already exists');
      fs.renameSync(j.from, dest);
      results.push({ from: j.from, to: dest, ok: true });
    } catch (err) {
      results.push({ from: j.from, ok: false, error: err.message });
    }
  }
  return results;
});
