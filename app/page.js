"use client";

import { useState, useEffect } from 'react';

const PRESET_IMAGES = [
  { id: 'purple-wave', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80', name: 'Fluid Wave' },
  { id: 'vibrant-gradient', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80', name: 'Rainbow' },
  { id: 'abstract-3d', url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=800&q=80', name: 'Glass Shape' },
  { id: 'tech-grid', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80', name: 'Grid Network' },
  { id: 'deep-space', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80', name: 'Dark Tech' }
];

const INITIAL_FORM = {
  id: '',
  title: '',
  code: '',
  destinationUrl: '',
  redirectType: '302',
  enableCloaking: true,
  safePageTitle: 'Weekly Industry Trends & Tech Updates',
  safePageContent: 'Discover the latest breakthroughs in software engineering, digital commerce, product strategy, and modern system design. We curate clean, verified content weekly.',
  enableNoReferrer: true,
  ogTitle: '',
  ogDescription: '',
  ogImage: PRESET_IMAGES[0].url,
  deepLinkEnabled: false,
  iosUrl: '',
  androidUrl: '',
  customScheme: '',
  rotatingTargets: [],
  routingRules: []
};

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'links', 'editor'
  const [rawLinks, setRawLinks] = useState([]);
  const [rawAnalytics, setRawAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(INITIAL_FORM);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerRedirectUrl, setOwnerRedirectUrl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [workspaceKey, setWorkspaceKey] = useState('');
  
  // Computed property to filter links visible to the current view
  const links = (() => {
    if (isAdmin) return rawLinks;
    if (typeof window === 'undefined') return [];
    try {
      const myLinks = JSON.parse(localStorage.getItem('flexroute_my_links') || '[]');
      return rawLinks.filter(l => l.userId === workspaceKey || myLinks.includes(l.id));
    } catch (e) {
      return [];
    }
  })();

  // Computed property to recalculate statistics for the visible links only
  const analytics = (() => {
    if (!rawAnalytics) return null;
    if (isAdmin) return rawAnalytics;

    if (typeof window === 'undefined') {
      return {
        ...rawAnalytics,
        summary: { totalClicks: 0, uniqueClicks: 0, humanClicks: 0, botClicks: 0 },
        recentClicks: [],
        topLinks: [],
        timeline: [],
        referrers: [],
        countries: [],
        os: { iOS: 0, Android: 0, macOS: 0, Windows: 0, Linux: 0, Other: 0 },
        devices: { desktop: 0, mobile: 0, tablet: 0 }
      };
    }

    try {
      const myLinks = JSON.parse(localStorage.getItem('flexroute_my_links') || '[]');
      const myLinkIds = new Set(myLinks);

      // Filter recent clicks to only include clicks belonging to user's links
      const filteredClicks = (rawAnalytics.recentClicks || []).filter(c => {
        const link = rawLinks.find(l => l.id === c.linkId);
        return link && (link.userId === workspaceKey || myLinkIds.has(c.linkId));
      });

      // Recalculate Summary
      const totalClicks = filteredClicks.length;
      const uniqueIps = new Set(filteredClicks.map(c => c.ip));
      const uniqueClicks = uniqueIps.size;
      const botClicks = filteredClicks.filter(c => c.isBot).length;
      const humanClicks = totalClicks - botClicks;

      // Recalculate OS, Referrer, and Country stats
      const os = { iOS: 0, Android: 0, macOS: 0, Windows: 0, Linux: 0, Other: 0 };
      const referrersMap = {};
      const countriesMap = {};

      filteredClicks.forEach(c => {
        const system = c.os || 'Other';
        if (os[system] !== undefined) os[system]++;
        else os.Other++;

        const ref = c.referrer || 'Direct';
        referrersMap[ref] = (referrersMap[ref] || 0) + 1;

        const country = c.country || 'Unknown';
        countriesMap[country] = (countriesMap[country] || 0) + 1;
      });

      const referrers = Object.entries(referrersMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const countries = Object.entries(countriesMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Recalculate Timeline (7 Days)
      const timelineData = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        timelineData[dateStr] = { date: dateStr, human: 0, bot: 0 };
      }

      filteredClicks.forEach(c => {
        const dateStr = c.timestamp.split('T')[0];
        if (timelineData[dateStr]) {
          if (c.isBot) {
            timelineData[dateStr].bot++;
          } else {
            timelineData[dateStr].human++;
          }
        }
      });

      const timeline = Object.values(timelineData);

      // Filter top links listing
      const topLinks = (rawAnalytics.topLinks || []).filter(l => {
        const link = rawLinks.find(x => x.id === l.id);
        return link && (link.userId === workspaceKey || myLinkIds.has(l.id));
      });

      return {
        ...rawAnalytics,
        summary: {
          totalClicks,
          uniqueClicks,
          humanClicks,
          botClicks
        },
        recentClicks: filteredClicks,
        topLinks,
        timeline,
        referrers,
        countries,
        os
      };
    } catch (e) {
      return rawAnalytics;
    }
  })();

  // Client mount verification state to prevent hydration errors
  const [mounted, setMounted] = useState(false);

  // Custom states for sub-editors
  const [newRule, setNewRule] = useState({ type: 'os', key: '', destination: '' });
  const [newTarget, setNewTarget] = useState({ url: '', weight: 50 });
  const [hostUrl, setHostUrl] = useState('http://localhost:3000');

  // Load Host URL and verify mount
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setHostUrl(`${window.location.protocol}//${window.location.host}`);
      
      // Initialize or load workspace key
      let savedKey = localStorage.getItem('flexroute_workspace_key');
      if (!savedKey) {
        const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
        savedKey = `FR-${rand}`;
        localStorage.setItem('flexroute_workspace_key', savedKey);
      }
      setWorkspaceKey(savedKey);

      // Check for secret admin access code
      const params = new URLSearchParams(window.location.search);
      const passParam = params.get('pass');
      
      if (passParam === 'Ravi5445$' || localStorage.getItem('flexroute_admin') === 'true') {
        setIsAdmin(true);
        localStorage.setItem('flexroute_admin', 'true');
      }
    }
  }, []);

  // Auto-migrate local links to the active workspace key in the database
  useEffect(() => {
    if (mounted && rawLinks.length > 0 && workspaceKey && !isAdmin) {
      try {
        const myLinks = JSON.parse(localStorage.getItem('flexroute_my_links') || '[]');
        if (myLinks.length > 0) {
          // Find links that are in myLinks but don't have this workspaceKey set yet in the database
          const linksToMigrate = rawLinks.filter(l => myLinks.includes(l.id) && l.userId !== workspaceKey);
          
          if (linksToMigrate.length > 0) {
            Promise.all(linksToMigrate.map(async (link) => {
              try {
                await fetch(`/api/links/${link.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: workspaceKey })
                });
              } catch (err) {
                console.error(`Failed to migrate link ${link.id}`, err);
              }
            })).then(() => {
              // Refresh links list to sync UI state
              fetchData();
            });
          }
        }
      } catch (e) {
        console.error("Error during auto-migration:", e);
      }
    }
  }, [mounted, rawLinks, workspaceKey, isAdmin]);

  const handleWorkspaceChange = () => {
    const key = prompt("Enter your Workspace Key (e.g. FR-XXXXXX or custom name) to load your links:", workspaceKey);
    if (key !== null && key.trim() !== "") {
      const cleanKey = key.trim();
      setWorkspaceKey(cleanKey);
      if (typeof window !== 'undefined') {
        localStorage.setItem('flexroute_workspace_key', cleanKey);
      }
      showToast(`Switched to workspace: ${cleanKey}`);
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('flexroute_admin');
      showToast('Logged out successfully');
    }
  };

  const handleAdminPrompt = () => {
    const code = prompt("Enter Admin Password:");
    if (code === 'Ravi5445$') {
      setIsAdmin(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('flexroute_admin', 'true');
      }
      showToast('Logged in as Admin!');
    } else if (code !== null) {
      showToast('Incorrect password!', 'error');
    }
  };

  // Fetch Links and Analytics
  const fetchData = async () => {
    setLoading(true);
    try {
      const t = Date.now();
      const [linksRes, analyticsRes] = await Promise.all([
        fetch(`/api/links?t=${t}`, { cache: 'no-store' }),
        fetch(`/api/analytics?t=${t}`, { cache: 'no-store' })
      ]);
      const linksData = await linksRes.json();
      const analyticsData = await analyticsRes.json();

      if (linksData.success) setRawLinks(linksData.links);
      if (analyticsData.success) setRawAnalytics(analyticsData);
    } catch (e) {
      showToast('Error loading data from API', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/settings?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.settings) {
        setOwnerRedirectUrl(data.settings.ownerRedirectUrl || '');
      }
    } catch (e) {
      console.error("Error loading settings:", e);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerRedirectUrl })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Settings saved successfully!');
      } else {
        showToast(data.error || 'Failed to save settings', 'error');
      }
    } catch (err) {
      showToast('Network error saving settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchData();
      fetchSettings();
    }
  }, [mounted]);

  if (!mounted) {
    return (
      <div style={{ background: '#060814', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#6366f1', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '3px solid rgba(99,102,241,0.1)', borderTopColor: '#6366f1', width: '32px', height: '32px', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 15px auto' }}></div>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Loading FlexRoute Engine...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Toast notifier
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Copy helper
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  };

  // Add Dynamic Rule
  const addRoutingRule = () => {
    if (!newRule.key || !newRule.destination) {
      showToast('Please fill all rule parameters', 'error');
      return;
    }
    setForm({
      ...form,
      routingRules: [...form.routingRules, { ...newRule, id: Date.now().toString() }]
    });
    setNewRule({ type: 'os', key: '', destination: '' });
    showToast('Routing rule added');
  };

  // Delete Dynamic Rule
  const removeRoutingRule = (index) => {
    const updated = [...form.routingRules];
    updated.splice(index, 1);
    setForm({ ...form, routingRules: updated });
  };

  // Add Rotating Target
  const addRotatingTarget = () => {
    if (!newTarget.url || !newTarget.weight) {
      showToast('Please fill all target fields', 'error');
      return;
    }
    setForm({
      ...form,
      rotatingTargets: [...form.rotatingTargets, { ...newTarget, id: Date.now().toString() }]
    });
    setNewTarget({ url: '', weight: 50 });
    showToast('Rotating destination added');
  };

  // Delete Rotating Target
  const removeRotatingTarget = (index) => {
    const updated = [...form.rotatingTargets];
    updated.splice(index, 1);
    setForm({ ...form, rotatingTargets: updated });
  };

  // Handle Form Input Changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // Preset Image selection
  const selectPresetImage = (url) => {
    setForm({
      ...form,
      ogImage: url
    });
  };

  // Create or Update Link
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.destinationUrl) {
      showToast('Code and Default URL are required', 'error');
      return;
    }

    const isEdit = !!form.id;
    const url = isEdit ? `/api/links/${form.id}` : '/api/links';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, userId: workspaceKey })
      });
      const data = await res.json();

      if (data.success) {
        showToast(isEdit ? 'Link updated successfully!' : 'Link created successfully!');
        
        // Track newly created link ownership in localStorage
        if (!isEdit && data.link && data.link.id) {
          try {
            const myLinks = JSON.parse(localStorage.getItem('flexroute_my_links') || '[]');
            if (!myLinks.includes(data.link.id)) {
              myLinks.push(data.link.id);
              localStorage.setItem('flexroute_my_links', JSON.stringify(myLinks));
            }
          } catch (err) {
            console.error("Failed to update my links storage", err);
          }
        }

        setForm(INITIAL_FORM);
        fetchData();
        setActiveTab('links');
      } else {
        showToast(data.error || 'Server error', 'error');
      }
    } catch (err) {
      showToast('Network error, please try again.', 'error');
    }
  };

  // Edit Link mode activation
  const editLink = (link) => {
    setForm({
      id: link.id,
      title: link.title || '',
      code: link.code || '',
      destinationUrl: link.destinationUrl || '',
      redirectType: link.redirectType || '302',
      enableCloaking: link.enableCloaking !== undefined ? link.enableCloaking : true,
      safePageTitle: link.safePageTitle || 'Weekly Industry Trends & Tech Updates',
      safePageContent: link.safePageContent || '',
      enableNoReferrer: link.enableNoReferrer !== undefined ? link.enableNoReferrer : true,
      ogTitle: link.ogTitle || '',
      ogDescription: link.ogDescription || '',
      ogImage: link.ogImage || PRESET_IMAGES[0].url,
      deepLinkEnabled: !!link.deepLinkEnabled,
      iosUrl: link.iosUrl || '',
      androidUrl: link.androidUrl || '',
      customScheme: link.customScheme || '',
      rotatingTargets: link.rotatingTargets || [],
      routingRules: link.routingRules || []
    });
    setActiveTab('editor');
  };

  // Delete Link execution
  const handleDeleteLink = async (id) => {
    if (!confirm('Are you sure you want to delete this link?')) return;
    try {
      const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Link deleted successfully');
        
        // Remove deleted link ownership from localStorage
        try {
          const myLinks = JSON.parse(localStorage.getItem('flexroute_my_links') || '[]');
          const updated = myLinks.filter(lid => lid !== id);
          localStorage.setItem('flexroute_my_links', JSON.stringify(updated));
        } catch (err) {
          console.error("Failed to remove link from storage", err);
        }

        fetchData();
      } else {
        showToast(data.error || 'Could not delete link', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
  };

  // Filter links on search query
  const filteredLinks = links.filter(l => 
    l.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.title && l.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
    l.destinationUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // SVG Line Chart builder based on timeline click counts
  const renderSvgTimeline = () => {
    if (!analytics || !analytics.timeline || analytics.timeline.length === 0) return null;

    const timeline = analytics.timeline;
    const maxVal = Math.max(...timeline.map(t => Math.max(t.human, t.bot)), 10);
    const height = 200;
    const width = 600;
    const padding = 30;

    const pointsHuman = [];
    const pointsBot = [];

    const stepX = (width - padding * 2) / (timeline.length - 1);
    
    timeline.forEach((item, index) => {
      const x = padding + index * stepX;
      // Human Line
      const yHuman = height - padding - (item.human / maxVal) * (height - padding * 2);
      pointsHuman.push(`${x},${yHuman}`);
      
      // Bot Line
      const yBot = height - padding - (item.bot / maxVal) * (height - padding * 2);
      pointsBot.push(`${x},${yBot}`);
    });

    const pathDHuman = `M ${pointsHuman.join(' L ')}`;
    const pathDBot = `M ${pointsBot.join(' L ')}`;

    // Area paths
    const pathFillHuman = `${pathDHuman} L ${padding + (timeline.length - 1) * stepX},${height - padding} L ${padding},${height - padding} Z`;
    const pathFillBot = `${pathDBot} L ${padding + (timeline.length - 1) * stepX},${height - padding} L ${padding},${height - padding} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        <defs>
          <linearGradient id="human-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0"/>
          </linearGradient>
          <linearGradient id="bot-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0"/>
          </linearGradient>
        </defs>

        {/* Y Axis Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = padding + ratio * (height - padding * 2);
          const gridVal = Math.round(maxVal * (1 - ratio));
          return (
            <g key={i}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} className="chart-grid-line" />
              <text x={padding - 8} y={y + 4} textAnchor="end" className="chart-axis-text">{gridVal}</text>
            </g>
          );
        })}

        {/* Areas */}
        <path d={pathFillHuman} className="chart-path-fill" fill="url(#human-gradient)" />
        <path d={pathFillBot} className="chart-path-fill" fill="url(#bot-gradient)" />

        {/* Lines */}
        <path d={pathDHuman} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
        <path d={pathDBot} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />

        {/* Points and Dates */}
        {timeline.map((item, index) => {
          const x = padding + index * stepX;
          const yH = height - padding - (item.human / maxVal) * (height - padding * 2);
          const yB = height - padding - (item.bot / maxVal) * (height - padding * 2);
          
          // Render only month/day e.g. "06-24"
          const dateLabel = item.date.slice(5);

          return (
            <g key={index}>
              <text x={x} y={height - 8} textAnchor="middle" className="chart-axis-text">{dateLabel}</text>
              <circle cx={x} cy={yH} r="4" fill="#6366f1" stroke="#060814" strokeWidth="2" />
              <circle cx={x} cy={yB} r="3" fill="#ef4444" stroke="#060814" strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'border-red' : ''}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="brand">
          <div className="brand-logo">FR</div>
          <div className="brand-name">FLEXROUTE</div>
        </div>

        <ul className="nav-menu">
          <li>
            <div 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); fetchData(); }}
            >
              <span className="nav-icon">📊</span> Dashboard
            </div>
          </li>
          <li>
            <div 
              className={`nav-item ${activeTab === 'links' ? 'active' : ''}`}
              onClick={() => { setActiveTab('links'); fetchData(); }}
            >
              <span className="nav-icon">🔗</span> Links Manager
            </div>
          </li>
          <li>
            <div 
              className={`nav-item ${activeTab === 'editor' ? 'active' : ''}`}
              onClick={() => { setForm(INITIAL_FORM); setActiveTab('editor'); }}
            >
              <span className="nav-icon">➕</span> Create Anti-Ban Link
            </div>
          </li>
          {isAdmin && (
            <li>
              <div 
                className="nav-item"
                onClick={handleLogout}
                style={{ marginTop: '20px', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.15)', background: 'rgba(239, 68, 68, 0.05)' }}
              >
                <span className="nav-icon">🚪</span> Logout Admin
              </div>
            </li>
          )}
        </ul>

        <div className="nav-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>Workspace Key</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={workspaceKey}>
                {workspaceKey}
              </span>
              <button 
                onClick={handleWorkspaceChange}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.85rem', padding: '2px 4px' }}
                title="Log in to a different workspace key"
              >
                ✏️
              </button>
            </div>
          </div>

          <div>Storage Adapter:</div>
          <div>
            {analytics?.databaseMode === 'supabase' ? (
              <span className="db-badge kv">Supabase Active</span>
            ) : (
              <span className="db-badge local">Local Mode (db.json)</span>
            )}
          </div>
          <div style={{ marginTop: '10px' }}>v1.2.0 (Cloaking Active)</div>
        </div>
      </div>

      {/* Main Container */}
      <div className="main-content">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="header">
              <div>
                <h1 className="page-title">Traffic Overview</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Real-time analysis of human clicks, scraper bots, and referrers.</p>
              </div>
              <button className="btn btn-primary" onClick={fetchData}>🔄 Refresh Logs</button>
            </div>

            {/* KPI Cards */}
            <div className="stats-grid">
              <div className="glass-card">
                <div className="stat-label">Total Clicks</div>
                <div className="stat-value">{analytics?.summary?.totalClicks || 0}</div>
                <div className="stat-subtext">Cumulative link resolutions</div>
              </div>
              <div className="glass-card">
                <div className="stat-label">Total Users (Unique IPs)</div>
                <div className="stat-value">{analytics?.summary?.uniqueClicks || 0}</div>
                <div className="stat-subtext">Identified unique client IPs</div>
              </div>
              <div className="glass-card" style={{ borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                <div className="stat-label">Total Shortened URLs</div>
                <div className="stat-value">{links.length}</div>
                <div className="stat-subtext">Active custom redirect rules</div>
              </div>
              <div className="glass-card" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                <div className="stat-label" style={{ color: 'var(--color-success)' }}>Human Traffic</div>
                <div className="stat-value">{analytics?.summary?.humanClicks || 0}</div>
                <div className="stat-subtext">Redirected to destination</div>
              </div>
              <div className="glass-card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <div className="stat-label" style={{ color: 'var(--color-danger)' }}>Scraper Bots Blocked</div>
                <div className="stat-value">{analytics?.summary?.botClicks || 0}</div>
                <div className="stat-subtext">Served safe cloaked page</div>
              </div>
            </div>

            {/* Global Settings Redirection Panel */}
            {isAdmin && (
              <div className="glass-card" style={{ marginBottom: '35px', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
                <div className="card-header" style={{ marginBottom: '10px' }}>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚙️ Global Redirection Settings (20% Traffic Redirection)
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '15px' }}>
                  Enter a website URL below. Once saved, 20% of all incoming human traffic across all shortened links will be redirected silently to this website (without increasing link click counts).
                </p>
                <form onSubmit={handleSaveSettings} style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <input 
                      type="url" 
                      placeholder="e.g., https://nuso-daily.vercel.app (your main site)" 
                      className="form-control"
                      style={{ margin: 0 }}
                      value={ownerRedirectUrl}
                      onChange={(e) => setOwnerRedirectUrl(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={savingSettings} style={{ minWidth: '150px' }}>
                    {savingSettings ? 'Saving...' : '💾 Save Settings'}
                  </button>
                </form>
                <div style={{ marginTop: '15px', fontSize: '0.9rem', color: 'var(--color-success)', fontWeight: '600' }}>
                  📈 Total Redirected Clicks: {analytics?.ownerRedirectClicks || 0} clicks
                </div>
              </div>
            )}

            {/* Chart and breakdowns */}
            <div className="dashboard-grid">
              <div className="glass-card">
                <div className="card-header">
                  <div className="card-title">Click Timeline (Human vs Scraper Bots)</div>
                  <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem' }}>
                    <span style={{ color: '#6366f1' }}>● Real Users</span>
                    <span style={{ color: '#ef4444' }}>● Crawler Bots</span>
                  </div>
                </div>
                <div className="chart-container">
                  {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Loading timeline data...</div>
                  ) : (
                    renderSvgTimeline()
                  )}
                </div>
              </div>

              {/* OS / Referrer Breakdown */}
              <div className="glass-card">
                <div className="card-header">
                  <div className="card-title">Device / Operating System</div>
                </div>
                <div className="donut-list">
                  <div className="donut-item">
                    <div className="donut-info">
                      <span className="donut-name">iOS (Apple iPhone)</span>
                      <span className="donut-val">{analytics?.os?.iOS || 0} clicks</span>
                    </div>
                    <div className="donut-track">
                      <div 
                        className="donut-bar" 
                        style={{ 
                          width: `${analytics?.summary?.totalClicks ? (analytics.os.iOS / analytics.summary.totalClicks) * 100 : 0}%`,
                          background: 'var(--color-primary)'
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="donut-item">
                    <div className="donut-info">
                      <span className="donut-name">Android</span>
                      <span className="donut-val">{analytics?.os?.Android || 0} clicks</span>
                    </div>
                    <div className="donut-track">
                      <div 
                        className="donut-bar" 
                        style={{ 
                          width: `${analytics?.summary?.totalClicks ? (analytics.os.Android / analytics.summary.totalClicks) * 100 : 0}%`,
                          background: 'var(--color-secondary)'
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="donut-item">
                    <div className="donut-info">
                      <span className="donut-name">Windows / Desktop</span>
                      <span className="donut-val">{analytics?.os?.Windows || 0} clicks</span>
                    </div>
                    <div className="donut-track">
                      <div 
                        className="donut-bar" 
                        style={{ 
                          width: `${analytics?.summary?.totalClicks ? (analytics.os.Windows / analytics.summary.totalClicks) * 100 : 0}%`,
                          background: 'var(--color-info)'
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="donut-item">
                    <div className="donut-info">
                      <span className="donut-name">macOS</span>
                      <span className="donut-val">{analytics?.os?.macOS || 0} clicks</span>
                    </div>
                    <div className="donut-track">
                      <div 
                        className="donut-bar" 
                        style={{ 
                          width: `${analytics?.summary?.totalClicks ? (analytics.os.macOS / analytics.summary.totalClicks) * 100 : 0}%`,
                          background: '#cbd5e1'
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Referral Sources & Country lists */}
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="glass-card">
                <div className="card-header">
                  <div className="card-title">Referrer Traffic Sources</div>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Platform</th>
                        <th>Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics?.referrers && analytics.referrers.length > 0 ? (
                        analytics.referrers.map((ref, idx) => (
                          <tr key={idx}>
                            <td>{ref.name}</td>
                            <td className="click-count">{ref.count}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No referrals logged yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass-card">
                <div className="card-header">
                  <div className="card-title">Geographical Traffic (Countries)</div>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Country</th>
                        <th>Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics?.countries && analytics.countries.length > 0 ? (
                        analytics.countries.map((c, idx) => (
                          <tr key={idx}>
                            <td>{c.name}</td>
                            <td className="click-count">{c.count}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No geo-traffic logged yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Live Logs */}
            <div className="glass-card">
              <div className="card-header">
                <div className="card-title">Real-Time Traffic Logs (Last 50 Entries)</div>
              </div>
              <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Ref</th>
                      <th>OS / Device</th>
                      <th>Country</th>
                      <th>IP Address</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.recentClicks && analytics.recentClicks.length > 0 ? (
                      analytics.recentClicks.map((click, idx) => (
                        <tr key={idx}>
                          <td>{new Date(click.timestamp).toLocaleTimeString()}</td>
                          <td>{click.referrer}</td>
                          <td>{click.os} ({click.device})</td>
                          <td>{click.country}</td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{click.ip}</td>
                          <td>
                            {click.isBot ? (
                              <span className="bot-tag">Blocked Bot</span>
                            ) : (
                              <span className="human-tag">Redirected</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Waiting for incoming traffic...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LINKS LIST */}
        {activeTab === 'links' && (
          <div>
            <div className="header">
              <div>
                <h1 className="page-title">Active Routing Links</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Search and manage cloaking rules, destination URLs, and redirection targets.</p>
              </div>
              <button className="btn btn-primary" onClick={() => { setForm(INITIAL_FORM); setActiveTab('editor'); }}>
                ➕ Create New Link
              </button>
            </div>

            <div className="glass-card" style={{ marginBottom: '25px', padding: '16px' }}>
              <input 
                type="text" 
                placeholder="🔍 Search by code, title, or destination URL..." 
                className="form-control" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="glass-card" style={{ padding: '0px' }}>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Link Title</th>
                      <th>Short Link Code</th>
                      <th>Default Destination</th>
                      <th>Cloaking</th>
                      <th>Anti-Ban Mode</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLinks.length > 0 ? (
                      filteredLinks.map((link) => (
                        <tr key={link.id}>
                          <td style={{ fontWeight: '600' }}>{link.title}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="code-badge">/{link.code}</span>
                              <button 
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px' }}
                                onClick={() => copyToClipboard(`${hostUrl}/${link.code}`)}
                              >
                                Copy
                              </button>
                            </div>
                          </td>
                          <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                            {link.destinationUrl}
                          </td>
                          <td>
                            {link.enableCloaking ? (
                              <span className="human-tag">Cloaking Active</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.85rem' }}>
                              {link.redirectType === '302' && 'Server HTTP 302'}
                              {link.redirectType === 'js' && 'Javascript Delay'}
                              {link.redirectType === 'bridge' && 'Bridge Page'}
                            </span>
                            {link.enableNoReferrer && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-success)', marginTop: '2px' }}>
                                🛡️ No-Referrer Enabled
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => editLink(link)}>
                                ✏️ Edit
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteLink(link.id)}>
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                          No active links found. Create one to get started!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CREATE/EDIT EDITOR FORM */}
        {activeTab === 'editor' && (
          <div>
            <div className="header">
              <div>
                <h1 className="page-title">{form.id ? 'Edit Link Configuration' : 'Create Anti-Ban Traffic Router'}</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Configure smart cloaking filters and security barriers.</p>
              </div>
              <button className="btn btn-secondary" onClick={() => setActiveTab('links')}>
                ⬅️ Back to Links
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="dashboard-grid" style={{ gridTemplateColumns: '1.8fr 1.2fr' }}>
                {/* Form Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Card 1: Core details */}
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">1. Basic Parameters</div>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Link Title / Campaign Name</label>
                      <input 
                        type="text" 
                        name="title" 
                        placeholder="e.g. Facebook Promo June" 
                        className="form-control" 
                        value={form.title} 
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Custom Short Path (Alphanumeric)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>/</span>
                          <input 
                            type="text" 
                            name="code" 
                            placeholder="my-offer-link" 
                            className="form-control" 
                            value={form.code} 
                            onChange={handleInputChange}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Default Target URL</label>
                        <input 
                          type="url" 
                          name="destinationUrl" 
                          placeholder="https://mysite.com/landing-page" 
                          className="form-control" 
                          value={form.destinationUrl} 
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Anti-Ban & Cloaking Settings */}
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">2. Social Media Anti-Ban Engine</div>
                    </div>

                    <div className="switch-group">
                      <div className="switch-label-container">
                        <div className="switch-title">Smart Crawler Cloaking (Highly Recommended)</div>
                        <div className="switch-desc">Serves clean, safe compliant pages to Facebook/Twitter bots to prevent bans.</div>
                      </div>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          name="enableCloaking"
                          checked={form.enableCloaking}
                          onChange={handleInputChange}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>

                    {form.enableCloaking && (
                      <div className="alert-box">
                        🛡️ <strong>Cloaking Configured:</strong> Crawler bots visiting <code>/{form.code || 'your-link'}</code> will see a clean blog content template titled with the safe parameters below. Real users will bypass this.
                        
                        <div className="form-group" style={{ marginTop: '15px' }}>
                          <label className="form-label">Safe Page Content Title (Shown to Bots)</label>
                          <input 
                            type="text" 
                            name="safePageTitle"
                            className="form-control"
                            value={form.safePageTitle}
                            onChange={handleInputChange}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Safe Page Paragraph Content (Shown to Bots)</label>
                          <textarea 
                            name="safePageContent"
                            className="form-control"
                            value={form.safePageContent}
                            onChange={handleInputChange}
                          />
                        </div>
                      </div>
                    )}

                    <div className="form-row" style={{ marginTop: '10px' }}>
                      <div className="form-group">
                        <label className="form-label">Redirection Method</label>
                        <select 
                          name="redirectType" 
                          className="form-control"
                          value={form.redirectType}
                          onChange={handleInputChange}
                        >
                          <option value="302">Server Redirect (Fast, 302 Found)</option>
                          <option value="js">Javascript Redirect (Hides from simple bots)</option>
                          <option value="bridge">Sleek Bridge Page ( countdown timer )</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <div className="switch-group" style={{ border: 'none', background: 'transparent', padding: '0', marginTop: '10px' }}>
                          <div className="switch-label-container">
                            <div className="switch-title">Strip Referrer Header (No-Referrer)</div>
                            <div className="switch-desc">Removes Facebook referral indicators. Destination site registers as "Direct traffic".</div>
                          </div>
                          <label className="switch">
                            <input 
                              type="checkbox" 
                              name="enableNoReferrer"
                              checked={form.enableNoReferrer}
                              onChange={handleInputChange}
                            />
                            <span className="slider"></span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Rotator & Dynamic Rules */}
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">3. Destination Rotation & Traffic Rules</div>
                    </div>

                    <div className="alert-box" style={{ background: 'rgba(168, 85, 247, 0.08)', borderColor: 'rgba(168, 85, 247, 0.2)' }}>
                      💡 <strong>Load Balancing:</strong> Distribute traffic among multiple landing pages by configuring weights. If configured, weights determine which link is selected when no custom rules match.
                    </div>

                    {/* Rotator List */}
                    <div className="weight-list">
                      {Array.isArray(form.rotatingTargets) && form.rotatingTargets.map((target, idx) => (
                        <div className="weight-row" key={target.id || idx}>
                          <div style={{ flex: '3', overflow: 'hidden', textOverflow: 'ellipsis' }}>{target.url}</div>
                          <div style={{ flex: '1', fontWeight: 'bold' }}>{target.weight}% weight</div>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => removeRotatingTarget(idx)}>Remove</button>
                        </div>
                      ))}
                    </div>

                    <div className="rule-row" style={{ gridTemplateColumns: '3fr 1fr auto', background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed' }}>
                      <input 
                        type="url" 
                        placeholder="https://mysite.com/alternative-page" 
                        className="form-control"
                        value={newTarget.url}
                        onChange={(e) => setNewTarget({ ...newTarget, url: e.target.value })}
                      />
                      <input 
                        type="number" 
                        placeholder="50" 
                        min="1" 
                        max="100" 
                        className="form-control"
                        value={newTarget.weight}
                        onChange={(e) => setNewTarget({ ...newTarget, weight: e.target.value })}
                      />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={addRotatingTarget}>➕ Add Target</button>
                    </div>

                    {/* Dynamic targeting rules */}
                    <label className="form-label" style={{ marginTop: '20px' }}>Custom OS, Device, or Country Rules</label>
                    <div className="weight-list" style={{ marginTop: '10px' }}>
                      {Array.isArray(form.routingRules) && form.routingRules.map((rule, idx) => (
                        <div className="rule-row" key={rule.id || idx}>
                          <div><strong>{rule.type.toUpperCase()}</strong></div>
                          <div><code>{rule.key}</code></div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{rule.destination}</div>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => removeRoutingRule(idx)}>Remove</button>
                        </div>
                      ))}
                    </div>

                    <div className="rule-row" style={{ background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed' }}>
                      <select 
                        className="form-control"
                        value={newRule.type}
                        onChange={(e) => setNewRule({ ...newRule, type: e.target.value, key: '' })}
                      >
                        <option value="os">OS</option>
                        <option value="device">Device</option>
                        <option value="country">Country (2 Letter Code)</option>
                      </select>
                      
                      {newRule.type === 'os' && (
                        <select 
                          className="form-control"
                          value={newRule.key}
                          onChange={(e) => setNewRule({ ...newRule, key: e.target.value })}
                        >
                          <option value="">Select OS</option>
                          <option value="iOS">iOS</option>
                          <option value="Android">Android</option>
                          <option value="Windows">Windows</option>
                          <option value="macOS">macOS</option>
                        </select>
                      )}

                      {newRule.type === 'device' && (
                        <select 
                          className="form-control"
                          value={newRule.key}
                          onChange={(e) => setNewRule({ ...newRule, key: e.target.value })}
                        >
                          <option value="">Select Device</option>
                          <option value="mobile">Mobile</option>
                          <option value="tablet">Tablet</option>
                          <option value="desktop">Desktop</option>
                        </select>
                      )}

                      {newRule.type === 'country' && (
                        <input 
                          type="text" 
                          placeholder="e.g. IN, US, GB" 
                          maxLength="2"
                          className="form-control"
                          value={newRule.key}
                          onChange={(e) => setNewRule({ ...newRule, key: e.target.value.toUpperCase() })}
                        />
                      )}

                      <input 
                        type="url" 
                        placeholder="https://mysite.com/special-page" 
                        className="form-control"
                        value={newRule.destination}
                        onChange={(e) => setNewRule({ ...newRule, destination: e.target.value })}
                      />

                      <button type="button" className="btn btn-secondary btn-sm" onClick={addRoutingRule}>➕ Add Rule</button>
                    </div>
                  </div>

                  {/* Card 4: Mobile Deep Linking */}
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-title">4. Mobile App Deep Linking (Optional)</div>
                    </div>

                    <div className="switch-group">
                      <div className="switch-label-container">
                        <div className="switch-title">Direct Mobile App Opening</div>
                        <div className="switch-desc">Launches app via scheme if installed, falls back to store.</div>
                      </div>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          name="deepLinkEnabled"
                          checked={form.deepLinkEnabled}
                          onChange={handleInputChange}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>

                    {form.deepLinkEnabled && (
                      <div className="alert-box" style={{ background: 'rgba(6, 182, 212, 0.08)', borderColor: 'rgba(6, 182, 212, 0.2)' }}>
                        <div className="form-group">
                          <label className="form-label">Custom URI Scheme (App Intent)</label>
                          <input 
                            type="text" 
                            name="customScheme"
                            placeholder="myapp://open/offer?id=12" 
                            className="form-control"
                            value={form.customScheme}
                            onChange={handleInputChange}
                          />
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">iOS App Store URL (Fallback)</label>
                            <input 
                              type="url" 
                              name="iosUrl"
                              placeholder="https://apps.apple.com/app/id123" 
                              className="form-control"
                              value={form.iosUrl}
                              onChange={handleInputChange}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Android Play Store URL (Fallback)</label>
                            <input 
                              type="url" 
                              name="androidUrl"
                              placeholder="https://play.google.com/store/apps/details?id=app" 
                              className="form-control"
                              value={form.androidUrl}
                              onChange={handleInputChange}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Open Graph Card preview Simulator (Sticky/Right side) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="glass-card" style={{ position: 'sticky', top: '20px' }}>
                    <div className="card-header">
                      <div className="card-title">Open Graph (Facebook Card) Preview</div>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Custom Preview Title</label>
                      <input 
                        type="text" 
                        name="ogTitle" 
                        placeholder={form.title || 'Click to view this offer...'} 
                        className="form-control" 
                        value={form.ogTitle} 
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Custom Preview Description</label>
                      <textarea 
                        name="ogDescription" 
                        placeholder="Get 50% discount on registration today. Fast delivery and secure payments." 
                        className="form-control" 
                        value={form.ogDescription} 
                        onChange={handleInputChange}
                        style={{ minHeight: '60px' }}
                      />
                    </div>

                    {/* Presets and custom image input */}
                    <div className="form-group">
                      <label className="form-label">Custom Preview Image URL</label>
                      <input 
                        type="text" 
                        name="ogImage" 
                        placeholder="https://mysite.com/image.jpg" 
                        className="form-control" 
                        value={form.ogImage} 
                        onChange={handleInputChange}
                      />
                      
                      <label className="form-label" style={{ marginTop: '10px', fontSize: '0.75rem' }}>Select A Safe Preset Image Cover</label>
                      <div className="preset-images-grid">
                        {PRESET_IMAGES.map((img) => (
                          <button
                            type="button"
                            key={img.id}
                            className={`preset-img-btn ${form.ogImage === img.url ? 'active' : ''}`}
                            style={{ backgroundImage: `url(${img.url})` }}
                            onClick={() => selectPresetImage(img.url)}
                            title={img.name}
                          />
                        ))}
                      </div>
                    </div>

                    {/* FB UI Simulator */}
                    <div style={{ marginTop: '30px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Live Facebook Feed Simulator</label>
                      <div className="facebook-preview" style={{ marginTop: '10px' }}>
                        <div className="fb-card-header">
                          <div className="fb-avatar">F</div>
                          <div className="fb-meta-text">
                            <div className="fb-name">FlexRoute Marketing</div>
                            <div className="fb-time">Sponsored · 🌐</div>
                          </div>
                        </div>
                        <div className="fb-caption">
                          Check out this awesome article we compiled recently!
                        </div>
                        <div 
                          className="fb-img-placeholder"
                          style={{ backgroundImage: `url(${form.ogImage})` }}
                        >
                          {!form.ogImage && (
                            <div className="fb-img-placeholder fb-img-none">No Preview Image selected</div>
                          )}
                        </div>
                        <div className="fb-link-details">
                          <div className="fb-link-host">FLEXROUTE.COM/{form.code || 'CODE'}</div>
                          <div className="fb-link-title">{form.ogTitle || form.title || 'Dynamic Safe Headline'}</div>
                          <div className="fb-link-desc">{form.ogDescription || 'See description snippet here. Make it look professional to grab user clicks.'}</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: '1' }}>
                        💾 {form.id ? 'Save Configuration' : 'Generate Secure Link'}
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => { setForm(INITIAL_FORM); setActiveTab('links'); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Copyright Footer with Secret Admin Trigger */}
        <div 
          className="copyright-footer"
          onDoubleClick={handleAdminPrompt}
          style={{
            marginTop: '80px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-color)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            userSelect: 'none'
          }}
          title="© 2026 FLEXROUTE. All rights reserved."
        >
          © 2026 FLEXROUTE. All rights reserved.
        </div>
      </div>
    </div>
  );
}
