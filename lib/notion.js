// Notion sync — talks to the user's "FEG Delivery Catalog" database via the official API.
// Requires: an internal integration token (secret_...) that has been connected to the
// FEG Delivery Hub page in Notion (page ••• menu → Connections).
const NOTION = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

async function api(token, method, path, body) {
  const res = await fetch(NOTION + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Notion API error ${res.status}`);
  return json;
}

// Resolve a database ID from a raw ID, a dashed UUID, or a full Notion URL.
function cleanDbId(idOrUrl) {
  const s = String(idOrUrl);
  // Standard dashed UUID (8-4-4-4-12) — checked on the ORIGINAL string, before any
  // dash-stripping, since only this exact grouping is safe to strip dashes from.
  const uuid = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return uuid[0].replace(/-/g, '');
  // Bare/compact 32-hex ID, e.g. embedded in a URL slug: "My-Database-<32hex>?v=...".
  // Bounded by non-alphanumeric on both sides so it can't swallow a hex-valid letter
  // (a/b/c/d/e/f) off the end of an adjacent slug word — blanket-stripping every dash
  // in the whole string first (the old approach) let "...Database-<id>" merge into
  // "...Databasee<32 chars>", silently returning a shifted, WRONG database id.
  const bare = s.match(/(?:^|[^0-9a-zA-Z])([0-9a-f]{32})(?:[^0-9a-zA-Z]|$)/i);
  if (bare) return bare[1];
  throw new Error('That does not look like a Notion database ID or URL.');
}

async function testConnection(token, dbId) {
  const db = await api(token, 'GET', `/databases/${cleanDbId(dbId)}`);
  const title = (db.title || []).map(t => t.plain_text).join('') || '(untitled)';
  return { ok: true, title };
}

const text = v => ({ rich_text: [{ text: { content: String(v).slice(0, 1900) } }] });
const select = name => ({ select: { name } });
const date = iso => ({ date: { start: iso } });

async function listEpisodes(token, dbId) {
  const out = [];
  let cursor;
  do {
    const r = await api(token, 'POST', `/databases/${cleanDbId(dbId)}/query`, {
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    });
    for (const p of r.results) {
      const props = p.properties || {};
      const title = (props['Episode']?.title || []).map(t => t.plain_text).join('');
      if (title.startsWith('📋 TEMPLATE')) continue;
      out.push({
        id: p.id,
        url: p.url,
        title,
        show: props['Show']?.select?.name || '',
        season: props['Season']?.number ?? null,
        ep: props['Episode #']?.number ?? null,
        status: props['Status']?.select?.name || '',
        airDate: props['Air Date']?.date?.start || null,
        deliverBy: props['Deliver By']?.date?.start || null,
        lastQC: props['Last QC']?.date?.start || null,
        qcNotes: (props['QC Notes']?.rich_text || []).map(t => t.plain_text).join(''),
        assets: {
          'Texted Video': props['Texted Video']?.select?.name || 'Not started',
          'Textless Video': props['Textless Video']?.select?.name || 'Not started',
          'Textless No Graphics': props['Textless No Graphics']?.select?.name || 'Not started',
          'Audio Stems': props['Audio Stems']?.select?.name || 'Not started',
          'Closed Captions': props['Closed Captions']?.select?.name || 'Not started',
          'Segment Timings': props['Segment Timings']?.select?.name || 'Not started',
        },
      });
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}

// Push a QC result to an episode row.
// asset: 'Texted Video' | 'Textless Video'
async function pushQC(token, pageId, asset, passed, failSummary) {
  const props = {
    [asset]: select(passed ? 'QC Passed' : 'QC Failed'),
    'Last QC': date(new Date().toISOString()),
    'QC Notes': text(passed
      ? `${asset}: passed app QC ${new Date().toLocaleString()}`
      : `${asset} FAILED: ${failSummary}`),
  };
  await api(token, 'PATCH', `/pages/${pageId}`, { properties: props });
  return true;
}

// Tick / set any tracked asset status
async function setAssetStatus(token, pageId, asset, status) {
  await api(token, 'PATCH', `/pages/${pageId}`, { properties: { [asset]: select(status) } });
  return true;
}

// Record where the episode's Distribution folder lives
async function setDropboxPath(token, pageId, folderPath) {
  await api(token, 'PATCH', `/pages/${pageId}`, { properties: { 'Dropbox Path': text(folderPath) } });
  return true;
}

// Set the overall pipeline status
async function setPipelineStatus(token, pageId, status) {
  await api(token, 'PATCH', `/pages/${pageId}`, { properties: { Status: select(status) } });
  return true;
}

async function createEpisode(token, dbId, fields) {
  const properties = {
    Episode: { title: [{ text: { content: fields.title } }] },
    Status: select('Ready For Processing'),
  };
  if (fields.show) properties['Show'] = select(fields.show);
  if (fields.season != null && fields.season !== '') properties['Season'] = { number: Number(fields.season) };
  if (fields.ep != null && fields.ep !== '') properties['Episode #'] = { number: Number(fields.ep) };
  const page = await api(token, 'POST', '/pages', {
    parent: { database_id: cleanDbId(dbId) },
    properties,
  });
  return { id: page.id, url: page.url };
}

// Appends a description, a collapsed spec-reference toggle, and one to_do
// block per pipeline stage to an episode's own Notion page (every database
// row is itself a page, so `pageId` here is the same episode id already used
// everywhere else — no separate page lookup needed). Returns { stageId: blockId }
// so the caller can check items off later by block id instead of re-searching
// the page's content each time.
async function createStageChecklist(token, pageId, { description, specLines, stages }) {
  const para = content => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content } }] } });
  const children = [
    para(description),
    {
      object: 'block', type: 'toggle',
      toggle: {
        rich_text: [{ text: { content: 'Technical Specifications' } }],
        children: specLines.map(para),
      },
    },
    { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ text: { content: 'Delivery Checklist' } }] } },
    ...stages.map(s => ({
      object: 'block', type: 'to_do',
      to_do: { rich_text: [{ text: { content: s.name } }], checked: false },
    })),
  ];
  const res = await api(token, 'PATCH', `/blocks/${pageId}/children`, { children });
  const todoBlocks = res.results.slice(-stages.length);
  const map = {};
  stages.forEach((s, i) => { map[s.id] = todoBlocks[i].id; });
  return map;
}

// Checks/unchecks one existing to_do block by id — the per-stage sync point.
async function setChecklistItem(token, blockId, checked) {
  await api(token, 'PATCH', `/blocks/${blockId}`, { to_do: { checked } });
  return true;
}

module.exports = { testConnection, listEpisodes, pushQC, setAssetStatus, setPipelineStatus, setDropboxPath, createEpisode, createStageChecklist, setChecklistItem };
