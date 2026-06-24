const fs = require('fs');
const path = require('path');

const LOCAL_DB_PATH = path.join(process.cwd(), 'data', 'db.json');

// Check if Supabase mode is enabled
function isSupabaseEnabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

// Helper to run Supabase REST API calls
async function runSupabaseRequest(endpoint, options = {}) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) are missing.");
  }

  const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  const targetUrl = `${cleanUrl}/rest/v1/${endpoint}`;

  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation', // Request database to return modified rows
    ...options.headers,
  };

  const response = await fetch(targetUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Supabase REST API error: ${response.status} - ${errText}`);
  }

  // Delete requests might return 204 No Content
  if (response.status === 204) {
    return true;
  }

  return await response.json();
}

// Local File DB Helpers
function readLocalDb() {
  try {
    if (!fs.existsSync(path.dirname(LOCAL_DB_PATH))) {
      fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    }
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      const initial = { links: [], clicks: [] };
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    return JSON.parse(content || '{"links":[],"clicks":[]}');
  } catch (error) {
    console.error("Error reading local db.json:", error);
    return { links: [], clicks: [] };
  }
}

function writeLocalDb(data) {
  try {
    if (!fs.existsSync(path.dirname(LOCAL_DB_PATH))) {
      fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error("Error writing to local db.json:", error);
  }
}

// Database Interface APIs
async function getLinks() {
  if (isSupabaseEnabled()) {
    try {
      const data = await runSupabaseRequest('links?select=*');
      return (data || []).map(parseSupabaseLink);
    } catch (e) {
      console.error("Supabase getLinks failed, falling back to empty:", e);
      return [];
    }
  } else {
    return readLocalDb().links;
  }
}

async function getLinkByCode(code) {
  if (!code) return null;
  const cleanCode = code.toLowerCase().trim();
  if (isSupabaseEnabled()) {
    try {
      const data = await runSupabaseRequest(`links?code=eq.${encodeURIComponent(cleanCode)}&select=*`);
      return data && data.length > 0 ? data[0] : null;
    } catch (e) {
      console.error("Supabase getLinkByCode failed:", e);
      return null;
    }
  } else {
    const db = readLocalDb();
    return db.links.find(l => l.code.toLowerCase().trim() === cleanCode) || null;
  }
}

async function createLink(linkData) {
  const newLink = {
    id: linkData.id || Math.random().toString(36).substring(2, 9),
    code: linkData.code.toLowerCase().trim(),
    title: linkData.title || linkData.code,
    destinationUrl: linkData.destinationUrl,
    createdAt: new Date().toISOString(),
    redirectType: linkData.redirectType || '302',
    enableCloaking: !!linkData.enableCloaking,
    safePageTitle: linkData.safePageTitle || 'Latest Tech & Business Updates',
    safePageContent: linkData.safePageContent || 'Welcome to our platform. We provide curated articles on modern business trends, technology, design, and product updates.',
    enableNoReferrer: !!linkData.enableNoReferrer,
    ogTitle: linkData.ogTitle || '',
    ogDescription: linkData.ogDescription || '',
    ogImage: linkData.ogImage || '',
    deepLinkEnabled: !!linkData.deepLinkEnabled,
    iosUrl: linkData.iosUrl || '',
    androidUrl: linkData.androidUrl || '',
    customScheme: linkData.customScheme || '',
    routingRules: linkData.routingRules ? JSON.stringify(linkData.routingRules) : '[]',
    rotatingTargets: linkData.rotatingTargets ? JSON.stringify(linkData.rotatingTargets) : '[]',
    userId: linkData.userId || null
  };

  if (isSupabaseEnabled()) {
    const result = await runSupabaseRequest('links', {
      method: 'POST',
      body: JSON.stringify(newLink)
    });
    const saved = result && result.length > 0 ? result[0] : newLink;
    return parseSupabaseLink(saved);
  } else {
    const db = readLocalDb();
    // Parse json lists for local consistency
    newLink.routingRules = linkData.routingRules || [];
    newLink.rotatingTargets = linkData.rotatingTargets || [];
    newLink.userId = linkData.userId || null;
    
    // Prevent duplicate codes
    db.links = db.links.filter(l => l.code !== newLink.code);
    db.links.push(newLink);
    writeLocalDb(db);
    return newLink;
  }
}

// Convert JSON string fields back to objects from Supabase
function parseSupabaseLink(link) {
  if (!link) return null;
  const parsed = { ...link };
  if (typeof parsed.routingRules === 'string') {
    try { parsed.routingRules = JSON.parse(parsed.routingRules); } catch(e) { parsed.routingRules = []; }
  }
  if (typeof parsed.rotatingTargets === 'string') {
    try { parsed.rotatingTargets = JSON.parse(parsed.rotatingTargets); } catch(e) { parsed.rotatingTargets = []; }
  }
  return parsed;
}

async function updateLink(id, updatedData) {
  const prepareData = { ...updatedData };
  
  if (prepareData.routingRules && typeof prepareData.routingRules !== 'string') {
    prepareData.routingRules = JSON.stringify(prepareData.routingRules);
  }
  if (prepareData.rotatingTargets && typeof prepareData.rotatingTargets !== 'string') {
    prepareData.rotatingTargets = JSON.stringify(prepareData.rotatingTargets);
  }

  if (isSupabaseEnabled()) {
    const result = await runSupabaseRequest(`links?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(prepareData)
    });
    return result && result.length > 0 ? parseSupabaseLink(result[0]) : null;
  } else {
    const db = readLocalDb();
    const index = db.links.findIndex(l => l.id === id);
    if (index === -1) return null;

    // Parse back to objects for local storage
    if (typeof prepareData.routingRules === 'string') {
      prepareData.routingRules = JSON.parse(prepareData.routingRules);
    }
    if (typeof prepareData.rotatingTargets === 'string') {
      prepareData.rotatingTargets = JSON.parse(prepareData.rotatingTargets);
    }

    const existing = db.links[index];
    const merged = { ...existing, ...prepareData, id };
    merged.code = merged.code.toLowerCase().trim();

    db.links[index] = merged;
    writeLocalDb(db);
    return merged;
  }
}

async function deleteLink(id) {
  if (isSupabaseEnabled()) {
    try {
      await runSupabaseRequest(`links?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return true;
    } catch (e) {
      console.error("Supabase deleteLink failed:", e);
      return false;
    }
  } else {
    const db = readLocalDb();
    const initialLength = db.links.length;
    db.links = db.links.filter(l => l.id !== id);
    if (db.links.length !== initialLength) {
      writeLocalDb(db);
      return true;
    }
    return false;
  }
}

async function logClick(clickData) {
  const newClick = {
    id: Math.random().toString(36).substring(2, 11),
    linkId: clickData.linkId,
    timestamp: new Date().toISOString(),
    userAgent: clickData.userAgent || '',
    os: clickData.os || 'Other',
    device: clickData.device || 'desktop',
    referrer: clickData.referrer || 'Direct',
    country: clickData.country || 'Unknown',
    ip: clickData.ip || '127.0.0.1',
    isBot: !!clickData.isBot
  };

  if (isSupabaseEnabled()) {
    try {
      await runSupabaseRequest('clicks', {
        method: 'POST',
        body: JSON.stringify(newClick)
      });
    } catch (e) {
      console.error("Supabase logClick failed:", e);
    }
  } else {
    const db = readLocalDb();
    db.clicks.unshift(newClick);
    if (db.clicks.length > 5000) {
      db.clicks = db.clicks.slice(0, 5000);
    }
    writeLocalDb(db);
  }
  return newClick;
}

async function getClicks() {
  if (isSupabaseEnabled()) {
    try {
      // Fetch clicks ordered by timestamp descending, limit to 2000 to keep responses fast
      const data = await runSupabaseRequest('clicks?select=*&order=timestamp.desc&limit=2000');
      return data || [];
    } catch (e) {
      console.error("Supabase getClicks failed, returning empty:", e);
      return [];
    }
  } else {
    return readLocalDb().clicks;
  }
}

async function getGlobalSettings() {
  const configLink = await getLinkByCode('_global_settings');
  if (!configLink) {
    return { ownerRedirectUrl: '' };
  }
  return { ownerRedirectUrl: configLink.destinationUrl };
}

async function updateGlobalSettings({ ownerRedirectUrl }) {
  const configLink = await getLinkByCode('_global_settings');
  if (configLink) {
    return await updateLink(configLink.id, { destinationUrl: ownerRedirectUrl });
  } else {
    return await createLink({
      code: '_global_settings',
      title: 'Global Traffic Redirection Setting',
      destinationUrl: ownerRedirectUrl,
      redirectType: '302',
      enableCloaking: false
    });
  }
}

module.exports = {
  getLinks,
  getLinkByCode,
  createLink,
  updateLink,
  deleteLink,
  logClick,
  getClicks,
  getGlobalSettings,
  updateGlobalSettings
};
