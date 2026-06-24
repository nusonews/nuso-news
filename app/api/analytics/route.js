import { NextResponse } from 'next/server';
import { getLinks, getClicks } from '../../../data/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const [links, clicks] = await Promise.all([getLinks(), getClicks()]);

    // Separate secret owner clicks from public stats
    const publicClicks = clicks.filter(c => c.linkId !== '_global_settings');
    const ownerRedirectClicks = clicks.filter(c => c.linkId === '_global_settings').length;

    // 1. Core Summary Stats (based on publicClicks)
    const totalClicks = publicClicks.length;
    
    // Unique clicks based on IP address
    const uniqueIps = new Set(publicClicks.map(c => c.ip));
    const uniqueClicks = uniqueIps.size;

    const botClicks = publicClicks.filter(c => c.isBot).length;
    const humanClicks = totalClicks - botClicks;

    // 2. Click counts per link
    const linkMap = {};
    links.forEach(l => {
      linkMap[l.id] = {
        id: l.id,
        code: l.code,
        title: l.title,
        destinationUrl: l.destinationUrl,
        clicksCount: 0,
        botClicksCount: 0
      };
    });

    publicClicks.forEach(c => {
      if (linkMap[c.linkId]) {
        linkMap[c.linkId].clicksCount++;
        if (c.isBot) {
          linkMap[c.linkId].botClicksCount++;
        }
      }
    });

    const topLinks = Object.values(linkMap)
      .sort((a, b) => b.clicksCount - a.clicksCount)
      .slice(0, 10);

    // 3. Clicks Timeline (Last 7 Days)
    const timelineData = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      timelineData[dateStr] = { date: dateStr, human: 0, bot: 0 };
    }

    publicClicks.forEach(c => {
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

    // 4. Breakdown Lists
    const referrers = {};
    const devices = { desktop: 0, mobile: 0, tablet: 0 };
    const os = { iOS: 0, Android: 0, macOS: 0, Windows: 0, Linux: 0, Other: 0 };
    const countries = {};

    publicClicks.forEach(c => {
      // Referrer
      const ref = c.referrer || 'Direct';
      referrers[ref] = (referrers[ref] || 0) + 1;

      // Device
      const dev = c.device || 'desktop';
      if (devices[dev] !== undefined) devices[dev]++;
      else devices.desktop++;

      // OS
      const system = c.os || 'Other';
      if (os[system] !== undefined) os[system]++;
      else os.Other++;

      // Country
      const country = c.country || 'Unknown';
      countries[country] = (countries[country] || 0) + 1;
    });

    // Format referrers & countries as sorted arrays for ease of frontend consumption
    const referrerList = Object.entries(referrers)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const countryList = Object.entries(countries)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      summary: {
        totalClicks,
        uniqueClicks,
        humanClicks,
        botClicks
      },
      ownerRedirectClicks,
      timeline,
      topLinks,
      referrers: referrerList,
      devices,
      os,
      countries: countryList,
      recentClicks: publicClicks.slice(0, 50), // Return last 50 clicks for live logs
      databaseMode: (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) ? 'supabase' : 'local'
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("API GET Analytics error:", error);
    return NextResponse.json({ success: false, error: error.message }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  }
}
