import { NextResponse } from 'next/server';
import { getLinkByCode, logClick, getGlobalSettings } from '../../data/db';

export const runtime = 'nodejs'; // Using Nodejs runtime for file operations in local development

// Custom simple User Agent Parser
function parseUserAgent(uaString) {
  const ua = (uaString || '').toLowerCase();
  
  let os = 'Other';
  let device = 'desktop';
  let isBot = false;

  // Bot detection
  const botKeywords = [
    'facebookexternalhit', 'facebot', 'twitterbot', 'googlebot', 'bingbot', 
    'linkedinbot', 'slackbot', 'discordbot', 'telegrambot', 'pinterest', 
    'whatsapp', 'crawler', 'spider', 'bot', 'yahoo'
  ];
  if (botKeywords.some(keyword => ua.includes(keyword))) {
    isBot = true;
  }

  // OS detection
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    os = 'iOS';
    device = 'mobile';
  } else if (ua.includes('android')) {
    os = 'Android';
    device = 'mobile';
  } else if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('macintosh') || ua.includes('mac os x')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  // Device type override
  if (ua.includes('mobile') || ua.includes('phone')) {
    device = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'tablet';
  }

  return { os, device, isBot };
}

// Clean and categorize referrer
function cleanReferrer(refHeader) {
  if (!refHeader) return 'Direct';
  try {
    const url = new URL(refHeader);
    const host = url.hostname.toLowerCase();
    if (host.includes('facebook.com') || host.includes('fb.me')) return 'Facebook';
    if (host.includes('t.co') || host.includes('twitter.com') || host.includes('x.com')) return 'Twitter';
    if (host.includes('linkedin.com')) return 'LinkedIn';
    if (host.includes('instagram.com')) return 'Instagram';
    if (host.includes('google.com')) return 'Google';
    if (host.includes('youtube.com')) return 'YouTube';
    return url.hostname;
  } catch (e) {
    return 'Referrer';
  }
}

// Default Safe Landing Page Template (HTML) for Bots
function renderSafeCloakingPage(link, ogImage) {
  const safeTitle = link.safePageTitle || 'Latest Tech & Business Updates';
  const safeContent = link.safePageContent || 'Welcome to our platform. We provide curated articles on modern business trends, technology, design, and product updates.';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  
  <!-- Open Graph / Facebook Meta Tags -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${link.ogTitle || link.title || safeTitle}" />
  <meta property="og:description" content="${link.ogDescription || 'Read our latest publication for insight and analytical updates.'}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:site_name" content="FlexRoute Insights" />
  
  <!-- Twitter Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${link.ogTitle || link.title || safeTitle}" />
  <meta name="twitter:description" content="${link.ogDescription || 'Read our latest publication for insight and analytical updates.'}" />
  <meta name="twitter:image" content="${ogImage}" />

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fafafa;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 700px;
      margin: 50px auto;
      padding: 30px;
      background: #ffffff;
      border: 1px solid #eaeaea;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.02);
    }
    h1 {
      font-size: 2rem;
      color: #111;
      margin-bottom: 20px;
      border-bottom: 2px solid #eaeaea;
      padding-bottom: 10px;
    }
    p {
      font-size: 1.1rem;
      color: #444;
      margin-bottom: 20px;
    }
    .date {
      color: #888;
      font-size: 0.9rem;
      margin-bottom: 30px;
    }
    footer {
      margin-top: 50px;
      border-top: 1px solid #eaeaea;
      padding-top: 20px;
      font-size: 0.85rem;
      color: #888;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="date">Published on ${new Date(link.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    <h1>${safeTitle}</h1>
    <p>${safeContent}</p>
    <p>For more detailed updates, subscribe to our weekly newsletter or check out our related resources. We aim to publish clean, verified information to keep our readers informed.</p>
    <footer>
      &copy; ${new Date().getFullYear()} FlexRoute Insights. All rights reserved.
    </footer>
  </div>
</body>
</html>`;
}

// Javascript Redirect / No-Referrer Redirect Page Template
function renderJsRedirectPage(destinationUrl, enableNoReferrer) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${enableNoReferrer ? '<meta name="referrer" content="no-referrer">' : ''}
  <title>Redirecting...</title>
  <style>
    body {
      background-color: #0b0d19;
      color: #a5b4fc;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      border: 4px solid rgba(255,255,255,0.1);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border-left-color: #6366f1;
      animation: spin 1s linear infinite;
      margin: 0 auto 15px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Connecting securely...</p>
  </div>
  <script type="text/javascript">
    // Redirect immediately
    window.location.replace(${JSON.stringify(destinationUrl)});
  </script>
</body>
</html>`;
}

// Bridge Page Template
function renderBridgePage(destinationUrl, enableNoReferrer) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${enableNoReferrer ? '<meta name="referrer" content="no-referrer">' : ''}
  <title>Connecting to Destination</title>
  <style>
    body {
      background: linear-gradient(135deg, #0f172a 0%, #020617 100%);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: rgba(30, 41, 59, 0.4);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3);
    }
    h2 {
      font-size: 1.5rem;
      margin: 0 0 10px 0;
      font-weight: 600;
      background: linear-gradient(to right, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      margin: 0 0 30px 0;
    }
    .progress-container {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 9999px;
      height: 8px;
      overflow: hidden;
      margin-bottom: 25px;
    }
    .progress-bar {
      background: linear-gradient(90deg, #6366f1, #a855f7);
      height: 100%;
      width: 0%;
      border-radius: 9999px;
      transition: width 0.1s linear;
    }
    .btn {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 0.95rem;
      font-weight: 500;
      border-radius: 10px;
      cursor: pointer;
      width: 100%;
      box-sizing: border-box;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>Connecting Securely</h2>
    <p>Please wait, you are being redirected to your destination...</p>
    
    <div class="progress-container">
      <div class="progress-bar" id="progressBar"></div>
    </div>
    
    <button class="btn" onclick="proceedNow()">Proceed Instantly</button>
  </div>

  <script type="text/javascript">
    const dest = ${JSON.stringify(destinationUrl)};
    const duration = 2500; // 2.5 seconds
    const start = Date.now();
    const bar = document.getElementById('progressBar');

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      bar.style.width = pct + '%';
      
      if (elapsed >= duration) {
        clearInterval(interval);
        proceedNow();
      }
    }, 50);

    function proceedNow() {
      clearInterval(interval);
      window.location.replace(dest);
    }
  </script>
</body>
</html>`;
}

// Deep Linking Gate Page
function renderDeepLinkPage(customScheme, storeUrl, destinationUrl, enableNoReferrer) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${enableNoReferrer ? '<meta name="referrer" content="no-referrer">' : ''}
  <title>Opening App...</title>
  <style>
    body {
      background-color: #0b0d19;
      color: #f8fafc;
      font-family: system-ui, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .content {
      text-align: center;
      padding: 30px;
      max-width: 400px;
    }
    .loading-dots {
      font-size: 1.5rem;
      letter-spacing: 3px;
      margin-bottom: 20px;
    }
    .btn-fallback {
      display: inline-block;
      margin-top: 25px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      color: #cbd5e1;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="content">
    <div class="loading-dots">•••</div>
    <h3>Launching Mobile App</h3>
    <p>We are trying to open this link in the app. If the app doesn't open, we will redirect you to the store or web page shortly.</p>
    <a class="btn-fallback" href="${destinationUrl}">Continue on Web</a>
  </div>

  <script type="text/javascript">
    const scheme = ${JSON.stringify(customScheme)};
    const store = ${JSON.stringify(storeUrl)};
    const fallback = ${JSON.stringify(destinationUrl)};
    
    // Attempt to open scheme
    window.location.href = scheme;
    
    // Set fallback timeout
    setTimeout(() => {
      // Check if user is still on this page (if scheme opened, browser usually goes to background)
      window.location.replace(store || fallback);
    }, 1800);
  </script>
</body>
</html>`;
}

// 404 Elegant fallback
function render404Page() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Link Not Found | FlexRoute</title>
  <style>
    body {
      background: #090b11;
      color: #94a3b8;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .content {
      text-align: center;
      max-width: 450px;
      padding: 30px;
    }
    h1 {
      font-size: 3.5rem;
      margin: 0;
      background: linear-gradient(to right, #f43f5e, #fb7185);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    h2 {
      color: #f1f5f9;
      font-size: 1.5rem;
      margin: 10px 0 15px 0;
    }
    p {
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 30px;
    }
    .brand {
      font-weight: 700;
      color: #6366f1;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="content">
    <h1>404</h1>
    <h2>Link Not Active</h2>
    <p>The short URL you are trying to reach does not exist or has been deactivated. Please contact the administrator or check the spelling.</p>
    <div class="brand">FLEXROUTE</div>
  </div>
</body>
</html>`;
}

export async function GET(request, { params }) {
  try {
    const { code } = await params;
    if (!code || code.startsWith('_')) {
      return new NextResponse(render404Page(), {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const link = await getLinkByCode(code);
    if (!link) {
      return new NextResponse(render404Page(), {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Get Request Headers
    const headersList = request.headers;
    const userAgent = headersList.get('user-agent') || '';
    const referrerHeader = headersList.get('referer') || '';
    
    // IP and Country detection
    let ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '127.0.0.1';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    const country = headersList.get('x-vercel-ip-country') || 'Unknown';

    const parsedUA = parseUserAgent(userAgent);
    const cleanedReferrer = cleanReferrer(referrerHeader);

    // Dynamic Image Selection (Fallbacks)
    const ogImage = link.ogImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80';

    // 1. If Crawler Bot is detected and Cloaking is enabled
    if (parsedUA.isBot && link.enableCloaking) {
      // Log bot click
      await logClick({
        linkId: link.id,
        userAgent,
        os: parsedUA.os,
        device: parsedUA.device,
        referrer: cleanedReferrer,
        country,
        ip,
        isBot: true
      });

      // Serve safe compliance page
      return new NextResponse(renderSafeCloakingPage(link, ogImage), {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    // 2. Process routing destination for humans
    let destinationUrl = link.destinationUrl;
    let isOwnerRedirect = false;

    // Check if 20% traffic redirection is enabled globally
    const settings = await getGlobalSettings();
    const ownerUrl = settings ? settings.ownerRedirectUrl : null;
    
    if (ownerUrl && Math.random() < 0.20) {
      destinationUrl = ownerUrl;
      isOwnerRedirect = true;
    }

    if (isOwnerRedirect) {
      // Ensure URL has a protocol
      if (destinationUrl && !/^https?:\/\//i.test(destinationUrl)) {
        destinationUrl = 'https://' + destinationUrl;
      }

      // Log owner redirect click under special ID '_global_settings'
      await logClick({
        linkId: '_global_settings',
        userAgent,
        os: parsedUA.os,
        device: parsedUA.device,
        referrer: cleanedReferrer,
        country,
        ip,
        isBot: false
      });

      // Silent redirect to owner's site (no logClick for the original link ID)
      if (link.enableNoReferrer || link.redirectType === 'js') {
        return new NextResponse(renderJsRedirectPage(destinationUrl, link.enableNoReferrer), {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
          }
        });
      }

      if (link.redirectType === 'bridge') {
        return new NextResponse(renderBridgePage(destinationUrl, link.enableNoReferrer), {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
          }
        });
      }

      return NextResponse.redirect(new URL(destinationUrl), 302);
    }

    // Check dynamic routing rules
    let ruleMatched = false;
    if (link.routingRules && link.routingRules.length > 0) {
      for (const rule of link.routingRules) {
        if (rule.type === 'os' && rule.key.toLowerCase() === parsedUA.os.toLowerCase()) {
          destinationUrl = rule.destination;
          ruleMatched = true;
          break;
        }
        if (rule.type === 'device' && rule.key.toLowerCase() === parsedUA.device.toLowerCase()) {
          destinationUrl = rule.destination;
          ruleMatched = true;
          break;
        }
        if (rule.type === 'country' && rule.key.toUpperCase() === country.toUpperCase()) {
          destinationUrl = rule.destination;
          ruleMatched = true;
          break;
        }
      }
    }

    // If no specific dynamic rule matched, check for destination rotation
    if (!ruleMatched && link.rotatingTargets && link.rotatingTargets.length > 0) {
      const rand = Math.random() * 100;
      let cumulative = 0;
      for (const target of link.rotatingTargets) {
        cumulative += Number(target.weight);
        if (rand <= cumulative) {
          destinationUrl = target.url;
          break;
        }
      }
    }

    // Ensure URL has a protocol
    if (destinationUrl && !/^https?:\/\//i.test(destinationUrl)) {
      destinationUrl = 'https://' + destinationUrl;
    }

    // Log human click (only for non-owner redirects)
    await logClick({
      linkId: link.id,
      userAgent,
      os: parsedUA.os,
      device: parsedUA.device,
      referrer: cleanedReferrer,
      country,
      ip,
      isBot: false
    });

    // 3. Mobile Deep Linking Handler
    if (link.deepLinkEnabled && (parsedUA.os === 'iOS' || parsedUA.os === 'Android')) {
      const storeUrl = parsedUA.os === 'iOS' ? link.iosUrl : link.androidUrl;
      const customScheme = link.customScheme;
      if (customScheme) {
        return new NextResponse(
          renderDeepLinkPage(customScheme, storeUrl, destinationUrl, link.enableNoReferrer),
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
            }
          }
        );
      }
    }

    // 4. Standard Redirection mechanisms
    // Note: If No-Referrer is enabled, we MUST use a JS redirect (client-side) to strip it.
    if (link.enableNoReferrer || link.redirectType === 'js') {
      return new NextResponse(renderJsRedirectPage(destinationUrl, link.enableNoReferrer), {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    if (link.redirectType === 'bridge') {
      return new NextResponse(renderBridgePage(destinationUrl, link.enableNoReferrer), {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    // Default: 302 Redirect
    return NextResponse.redirect(new URL(destinationUrl), 302);

  } catch (error) {
    console.error("Routing error:", error);
    return new NextResponse(render404Page(), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
