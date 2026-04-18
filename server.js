#!/usr/bin/env node
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

if (typeof fetch !== 'function') {
  console.error('Node 18+ required (native fetch not available)');
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const USER_PIN = process.env.USER_PIN || '4406';
const ADMIN_PIN = process.env.ADMIN_PIN || '5502';
const COLORS_CSV = path.join(__dirname, 'team_colors_corrected_v3.csv');

/* ============================================================
 * Team metadata (30 MLB teams). Colors can be overridden by CSV.
 * ============================================================ */
const DEFAULT_TEAMS = {
  ARI: { city: 'Arizona',      name: 'D-backs',    abbr: 'ARI', league: 'NL', div: 'West',    primary: '#A71930', secondary: '#E3D4AD', ink: '#FFFFFF', mlbId: 109 },
  ATL: { city: 'Atlanta',      name: 'Braves',     abbr: 'ATL', league: 'NL', div: 'East',    primary: '#13274F', secondary: '#CE1141', ink: '#FFFFFF', mlbId: 144 },
  BAL: { city: 'Baltimore',    name: 'Orioles',    abbr: 'BAL', league: 'AL', div: 'East',    primary: '#DF4601', secondary: '#000000', ink: '#FFFFFF', mlbId: 110 },
  BOS: { city: 'Boston',       name: 'Red Sox',    abbr: 'BOS', league: 'AL', div: 'East',    primary: '#BD3039', secondary: '#0C2340', ink: '#FFFFFF', mlbId: 111 },
  CHC: { city: 'Chicago',      name: 'Cubs',       abbr: 'CHC', league: 'NL', div: 'Central', primary: '#0E3386', secondary: '#CC3433', ink: '#FFFFFF', mlbId: 112 },
  CWS: { city: 'Chicago',      name: 'White Sox',  abbr: 'CWS', league: 'AL', div: 'Central', primary: '#27251F', secondary: '#C4CED4', ink: '#FFFFFF', mlbId: 145 },
  CIN: { city: 'Cincinnati',   name: 'Reds',       abbr: 'CIN', league: 'NL', div: 'Central', primary: '#C6011F', secondary: '#000000', ink: '#FFFFFF', mlbId: 113 },
  CLE: { city: 'Cleveland',    name: 'Guardians',  abbr: 'CLE', league: 'AL', div: 'Central', primary: '#00385D', secondary: '#E50022', ink: '#FFFFFF', mlbId: 114 },
  COL: { city: 'Colorado',     name: 'Rockies',    abbr: 'COL', league: 'NL', div: 'West',    primary: '#333366', secondary: '#C4CED4', ink: '#FFFFFF', mlbId: 115 },
  DET: { city: 'Detroit',      name: 'Tigers',     abbr: 'DET', league: 'AL', div: 'Central', primary: '#0C2340', secondary: '#FA4616', ink: '#FFFFFF', mlbId: 116 },
  HOU: { city: 'Houston',      name: 'Astros',     abbr: 'HOU', league: 'AL', div: 'West',    primary: '#EB6E1F', secondary: '#002D62', ink: '#FFFFFF', mlbId: 117 },
  KC:  { city: 'Kansas City',  name: 'Royals',     abbr: 'KC',  league: 'AL', div: 'Central', primary: '#004687', secondary: '#BD9B60', ink: '#FFFFFF', mlbId: 118 },
  LAA: { city: 'Los Angeles',  name: 'Angels',     abbr: 'LAA', league: 'AL', div: 'West',    primary: '#BA0021', secondary: '#003263', ink: '#FFFFFF', mlbId: 108 },
  LAD: { city: 'Los Angeles',  name: 'Dodgers',    abbr: 'LAD', league: 'NL', div: 'West',    primary: '#005A9C', secondary: '#EF3E42', ink: '#FFFFFF', mlbId: 119 },
  MIA: { city: 'Miami',        name: 'Marlins',    abbr: 'MIA', league: 'NL', div: 'East',    primary: '#00A3E0', secondary: '#EF3340', ink: '#FFFFFF', mlbId: 146 },
  MIL: { city: 'Milwaukee',    name: 'Brewers',    abbr: 'MIL', league: 'NL', div: 'Central', primary: '#12284B', secondary: '#FFC52F', ink: '#FFFFFF', mlbId: 158 },
  MIN: { city: 'Minnesota',    name: 'Twins',      abbr: 'MIN', league: 'AL', div: 'Central', primary: '#002B5C', secondary: '#D31145', ink: '#FFFFFF', mlbId: 142 },
  NYM: { city: 'New York',     name: 'Mets',       abbr: 'NYM', league: 'NL', div: 'East',    primary: '#002D72', secondary: '#FF5910', ink: '#FFFFFF', mlbId: 121 },
  NYY: { city: 'New York',     name: 'Yankees',    abbr: 'NYY', league: 'AL', div: 'East',    primary: '#0C2340', secondary: '#C4CED4', ink: '#FFFFFF', mlbId: 147 },
  OAK: { city: 'Athletics',    name: 'Athletics',  abbr: 'ATH', league: 'AL', div: 'West',    primary: '#003831', secondary: '#EFB21E', ink: '#FFFFFF', mlbId: 133 },
  PHI: { city: 'Philadelphia', name: 'Phillies',   abbr: 'PHI', league: 'NL', div: 'East',    primary: '#E81828', secondary: '#002D72', ink: '#FFFFFF', mlbId: 143 },
  PIT: { city: 'Pittsburgh',   name: 'Pirates',    abbr: 'PIT', league: 'NL', div: 'Central', primary: '#27251F', secondary: '#FDB827', ink: '#FFFFFF', mlbId: 134 },
  SD:  { city: 'San Diego',    name: 'Padres',     abbr: 'SD',  league: 'NL', div: 'West',    primary: '#2F241D', secondary: '#FFC425', ink: '#FFFFFF', mlbId: 135 },
  SF:  { city: 'San Francisco',name: 'Giants',     abbr: 'SF',  league: 'NL', div: 'West',    primary: '#FD5A1E', secondary: '#27251F', ink: '#FFFFFF', mlbId: 137 },
  SEA: { city: 'Seattle',      name: 'Mariners',   abbr: 'SEA', league: 'AL', div: 'West',    primary: '#0C2C56', secondary: '#005C5C', ink: '#FFFFFF', mlbId: 136 },
  STL: { city: 'St. Louis',    name: 'Cardinals',  abbr: 'STL', league: 'NL', div: 'Central', primary: '#C41E3A', secondary: '#FEDB00', ink: '#FFFFFF', mlbId: 138 },
  TB:  { city: 'Tampa Bay',    name: 'Rays',       abbr: 'TB',  league: 'AL', div: 'East',    primary: '#092C5C', secondary: '#F5D130', ink: '#FFFFFF', mlbId: 139 },
  TEX: { city: 'Texas',        name: 'Rangers',    abbr: 'TEX', league: 'AL', div: 'West',    primary: '#003278', secondary: '#C0111F', ink: '#FFFFFF', mlbId: 140 },
  TOR: { city: 'Toronto',      name: 'Blue Jays',  abbr: 'TOR', league: 'AL', div: 'East',    primary: '#134A8E', secondary: '#E8291C', ink: '#FFFFFF', mlbId: 141 },
  WSH: { city: 'Washington',   name: 'Nationals',  abbr: 'WSH', league: 'NL', div: 'East',    primary: '#AB0003', secondary: '#14225A', ink: '#FFFFFF', mlbId: 120 },
};

const ID_TO_ABBR = Object.fromEntries(
  Object.entries(DEFAULT_TEAMS).map(([abbr, t]) => [t.mlbId, abbr])
);
const NICK_TO_ABBR = Object.fromEntries(
  Object.entries(DEFAULT_TEAMS).map(([abbr, t]) => [t.name.toLowerCase(), abbr])
);

const colorOverrides = {};

function loadColors() {
  try {
    if (!fs.existsSync(COLORS_CSV)) {
      console.warn(`[colors] CSV not found at ${COLORS_CSV}, using built-in defaults`);
      return;
    }
    const text = fs.readFileSync(COLORS_CSV, 'utf8');
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return;

    const header = lines[0].toLowerCase().split(',').map(s => s.trim());
    const abbrIdx = header.findIndex(h => h === 'abbr' || h === 'abbreviation' || h === 'code');
    const primIdx = header.findIndex(h => h.includes('primary'));
    const secIdx = header.findIndex(h => h.includes('secondary'));

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      if (cols.length < 2) continue;

      let abbr, primary, secondary;

      if (abbrIdx >= 0 && primIdx >= 0) {
        abbr = cols[abbrIdx];
        primary = cols[primIdx];
        secondary = secIdx >= 0 ? cols[secIdx] : null;
      } else {
        // Fallback: first col is abbr, find hex columns
        abbr = cols[0];
        const hexes = cols.filter(c => /^#[0-9A-Fa-f]{6}$/.test(c));
        primary = hexes[0];
        secondary = hexes[1];
      }

      if (!abbr || !primary || !/^#[0-9A-Fa-f]{6}$/.test(primary)) continue;
      const A = abbr.toUpperCase();
      colorOverrides[A] = {
        primary: primary.toUpperCase(),
        secondary: (secondary && /^#[0-9A-Fa-f]{6}$/.test(secondary))
          ? secondary.toUpperCase()
          : (DEFAULT_TEAMS[A]?.secondary || '#FFFFFF'),
      };
    }
    console.log(`[colors] loaded ${Object.keys(colorOverrides).length} overrides from CSV`);
  } catch (e) {
    console.error('[colors] load error:', e.message);
  }
}

function getTeams() {
  const out = {};
  for (const [abbr, t] of Object.entries(DEFAULT_TEAMS)) {
    const o = colorOverrides[abbr];
    out[abbr] = {
      ...t,
      primary: o?.primary || t.primary,
      secondary: o?.secondary || t.secondary,
    };
  }
  return out;
}

loadColors();

/* ============================================================
 * Sessions + rate limiting
 * ============================================================ */
const sessions = new Map();  // token -> { admin, exp }
const SESSION_TTL = 6 * 60 * 60 * 1000;  // 6 hours
const rateBuckets = new Map();  // ip -> { count, start }
const RATE_WINDOW = 60 * 1000;
const RATE_MAX = 20;

function mkToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function checkRate(ip) {
  const now = Date.now();
  const b = rateBuckets.get(ip);
  if (!b || now - b.start > RATE_WINDOW) {
    rateBuckets.set(ip, { count: 1, start: now });
    return true;
  }
  b.count += 1;
  return b.count <= RATE_MAX;
}

function getSession(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || '');
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(token); return null; }
  return { token, ...s };
}

function requireAdmin(req, res, next) {
  const s = getSession(req);
  if (!s || !s.admin) return res.status(403).json({ ok: false, error: 'admin required' });
  req.session = s;
  next();
}

/* ============================================================
 * Cache helpers (in-memory, TTL-based)
 * ============================================================ */
function makeCache(defaultTtl) {
  const store = new Map();
  return {
    async get(key, producer, ttlOverride) {
      const now = Date.now();
      const hit = store.get(key);
      if (hit && hit.exp > now) return hit.v;
      try {
        const v = await producer();
        store.set(key, { v, exp: now + (ttlOverride ?? defaultTtl) });
        return v;
      } catch (e) {
        // On error, serve stale if we have it
        if (hit) {
          console.warn(`[cache] producer failed for ${key}, serving stale:`, e.message);
          return hit.v;
        }
        throw e;
      }
    },
    invalidate(key) { store.delete(key); },
    clear() { store.clear(); },
  };
}

const scoresCache = makeCache(30_000);
const gameCache = makeCache(15_000);
const espnGameCache = makeCache(15_000);
const espnScoreboardCache = makeCache(5 * 60_000);
const standingsCache = makeCache(10 * 60_000);

/* ============================================================
 * External API wrappers (with timeout + user-agent)
 * ============================================================ */
const UA = 'Dugout-MLB-Tracker/1.0 (+https://baseball.beaubouef.com)';

async function httpJson(url, { timeoutMs = 10_000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText} at ${url}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/* ============================================================
 * MLB Stats API transforms
 * ============================================================ */
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayEastern() {
  // Most MLB games are scheduled in US timezones; use Eastern as the canonical "today"
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(d);
}

function classifyState(apiStatus) {
  const c = apiStatus?.abstractGameCode || '';   // 'P' preview, 'L' live, 'F' final
  if (c === 'L') return 'live';
  if (c === 'F') return 'final';
  if (c === 'P') return 'pre';
  return (apiStatus?.detailedState || '').toLowerCase().includes('postpone') ? 'postponed' : 'pre';
}

function broadcastString(broadcasts) {
  if (!Array.isArray(broadcasts) || !broadcasts.length) return '';
  const tv = broadcasts.filter(b => (b.type === 'TV' || b.type === 'FCL') && b.isNational !== undefined);
  const list = (tv.length ? tv : broadcasts)
    .filter(b => b.type === 'TV' || b.type === 'FCL' || !b.type)
    .map(b => b.name || b.callSign)
    .filter(Boolean);
  return [...new Set(list)].slice(0, 3).join(' \u00B7 ');
}

function transformScheduleGame(g) {
  const state = classifyState(g.status);
  const ls = g.linescore || {};
  const away = g.teams?.away || {};
  const home = g.teams?.home || {};
  const awayAbbr = ID_TO_ABBR[away.team?.id] || (away.team?.abbreviation || '').toUpperCase();
  const homeAbbr = ID_TO_ABBR[home.team?.id] || (home.team?.abbreviation || '').toUpperCase();

  const halfRaw = (ls.inningHalf || ls.halfInning || '').toLowerCase();
  const half = halfRaw.startsWith('bot') ? 'bottom' : 'top';

  const offense = ls.offense || {};
  const bases = {
    first: Boolean(offense.first),
    second: Boolean(offense.second),
    third: Boolean(offense.third),
  };

  return {
    id: g.gamePk,
    away: awayAbbr,
    home: homeAbbr,
    awayScore: away.score ?? 0,
    homeScore: home.score ?? 0,
    state,
    inning: ls.currentInning ?? 0,
    half,
    outs: ls.outs ?? 0,
    balls: ls.balls ?? 0,
    strikes: ls.strikes ?? 0,
    bases,
    startUtc: g.gameDate,
    venue: g.venue?.name ? `${g.venue.name}${g.venue.location?.city ? ', ' + g.venue.location.city : ''}` : (g.venue?.name || ''),
    broadcast: broadcastString(g.broadcasts),
    statusDetail: g.status?.detailedState || '',
    doubleHeader: g.doubleHeader === 'Y',
    gameNumber: g.gameNumber,
  };
}

async function fetchScheduleForDate(date) {
  const url =
    'https://statsapi.mlb.com/api/v1/schedule' +
    `?sportId=1&date=${encodeURIComponent(date)}` +
    '&hydrate=linescore(runners),broadcasts(all),team,probablePitcher,game(content(summary),status),venue(location)';
  const data = await httpJson(url);
  const games = [];
  for (const d of (data.dates || [])) {
    for (const g of (d.games || [])) games.push(transformScheduleGame(g));
  }
  return { date, games };
}

async function fetchFeed(gamePk) {
  const url = `https://statsapi.mlb.com/api/v1.1/game/${encodeURIComponent(gamePk)}/feed/live`;
  return await httpJson(url, { timeoutMs: 15_000 });
}

function playerKey(id) { return `ID${id}`; }

function pitcherStats(player) {
  if (!player) return null;
  const season = player.seasonStats?.pitching || {};
  const today = player.stats?.pitching || {};
  return {
    name: player.person?.fullName || '',
    hand: player.person?.pitchHand?.code || player.pitchHand?.code || '',
    era: Number.parseFloat(season.era || '0') || 0,
    ip: today.inningsPitched || season.inningsPitched || '0.0',
    k: today.strikeOuts ?? 0,
    bb: today.baseOnBalls ?? 0,
    h: today.hits ?? 0,
    pitches: today.pitchesThrown ?? today.numberOfPitches ?? 0,
  };
}

function batterStats(player) {
  if (!player) return null;
  const season = player.seasonStats?.batting || {};
  const today = player.stats?.batting || {};
  const avgStr = String(season.avg || '.000');
  const avgNum = Number.parseFloat(avgStr.startsWith('.') ? '0' + avgStr : avgStr) || 0;
  // Build today line: "H-AB, BB" style
  const parts = [];
  const ab = today.atBats ?? 0;
  const h  = today.hits ?? 0;
  if (ab > 0 || h > 0) parts.push(`${h}-${ab}`);
  if ((today.homeRuns ?? 0) > 0) parts.push('HR');
  else if ((today.triples ?? 0) > 0) parts.push('3B');
  else if ((today.doubles ?? 0) > 0) parts.push('2B');
  if ((today.baseOnBalls ?? 0) > 0) parts.push('BB');
  if ((today.strikeOuts ?? 0) > 0 && h === 0) parts.push('K');
  const todayStr = parts.length ? parts.join(', ') : '0-0';

  return {
    name: player.person?.fullName || '',
    hand: player.person?.batSide?.code || player.batSide?.code || '',
    avg: avgNum,
    hr: season.homeRuns ?? 0,
    rbi: season.rbi ?? 0,
    ops: Number.parseFloat(season.ops || '0') || 0,
    today: todayStr,
  };
}

function transformLineScore(feed, awayAbbr, homeAbbr) {
  const ls = feed.liveData?.linescore;
  if (!ls) return { [awayAbbr]: [], [homeAbbr]: [], hitsA: 0, errA: 0, hitsH: 0, errH: 0 };
  const awayInn = (ls.innings || []).map(i => i.away?.runs ?? 0);
  const homeInn = (ls.innings || []).map(i => (i.home?.runs === undefined ? null : i.home.runs));
  // Trim trailing null in home if not played yet
  while (homeInn.length && homeInn[homeInn.length - 1] === null) homeInn.pop();
  return {
    [awayAbbr]: awayInn,
    [homeAbbr]: homeInn.map(v => v == null ? 0 : v),
    hitsA: ls.teams?.away?.hits ?? 0,
    errA: ls.teams?.away?.errors ?? 0,
    hitsH: ls.teams?.home?.hits ?? 0,
    errH: ls.teams?.home?.errors ?? 0,
  };
}

function transformPitch(ev) {
  const pd = ev.pitchData || {};
  const details = ev.details || {};
  return {
    type: details.type?.code || details.type?.description?.slice(0, 2).toUpperCase() || '',
    speed: pd.startSpeed ? Math.round(pd.startSpeed) : 0,
    result: (details.description || details.call?.description || '').toLowerCase() || 'unknown',
    x: typeof pd.coordinates?.pX === 'number' ? pd.coordinates.pX : 0,
    y: typeof pd.coordinates?.pZ === 'number' ? pd.coordinates.pZ : 2.5,
  };
}

function transformPlays(feed) {
  const plays = feed.liveData?.plays?.allPlays || [];
  // Grab last ~6 completed plays with descriptions
  const recent = plays.slice(-12).reverse().filter(p => p.result?.description).slice(0, 6);
  return recent.map(p => {
    const half = (p.about?.halfInning || 'top').toLowerCase();
    const inning = p.about?.inning || 0;
    return {
      inning: `${half === 'bottom' ? 'B' : 'T'}${inning}`,
      desc: p.result?.description || '',
      atBatIndex: p.atBatIndex,
      _delta: 0,  // filled in later from ESPN WP
    };
  });
}

function transformRecentPitches(feed) {
  // Pull pitches from current play + last completed play (up to ~8 total)
  const plays = feed.liveData?.plays;
  if (!plays) return [];
  const cur = plays.currentPlay;
  const all = plays.allPlays || [];
  const events = [];
  if (cur?.playEvents) events.push(...cur.playEvents);
  // If current has few pitches, borrow from prior plays
  let i = all.length - 1;
  while (events.filter(e => e.isPitch).length < 5 && i >= 0) {
    const p = all[i];
    if (p && p.atBatIndex !== cur?.atBatIndex) {
      events.unshift(...(p.playEvents || []));
    }
    i -= 1;
  }
  const pitchEvs = events.filter(e => e.isPitch);
  // Keep last 8
  return pitchEvs.slice(-8).map(transformPitch);
}

function onDeckInHole(feed) {
  const linescore = feed.liveData?.linescore;
  const offense = linescore?.offense || {};
  return {
    onDeck: offense.onDeck?.fullName || '',
    inHole: offense.inHole?.fullName || '',
  };
}

function buildGameDetail(feed) {
  const g = feed.gameData || {};
  const ld = feed.liveData || {};
  const teams = g.teams || {};
  const awayAbbr = ID_TO_ABBR[teams.away?.id] || teams.away?.abbreviation?.toUpperCase() || '';
  const homeAbbr = ID_TO_ABBR[teams.home?.id] || teams.home?.abbreviation?.toUpperCase() || '';

  const ls = ld.linescore || {};
  const box = ld.boxscore || {};
  const halfRaw = (ls.inningHalf || ls.halfInning || '').toLowerCase();
  const half = halfRaw.startsWith('bot') ? 'bottom' : 'top';

  // Runners on base
  const offense = ls.offense || {};
  const bases = {
    first: Boolean(offense.first),
    second: Boolean(offense.second),
    third: Boolean(offense.third),
  };

  // Which team is batting / fielding
  const battingSide = half === 'top' ? 'away' : 'home';
  const pitchingSide = half === 'top' ? 'home' : 'away';

  // Current pitcher and batter IDs from linescore.defense / offense
  const pitcherId = ls.defense?.pitcher?.id || box.teams?.[pitchingSide]?.pitchers?.slice(-1)[0];
  const batterId = offense.batter?.id || box.teams?.[battingSide]?.batters?.slice(-1)[0];

  const pitcherPlayer = pitcherId ? box.teams?.[pitchingSide]?.players?.[playerKey(pitcherId)] : null;
  const batterPlayer  = batterId  ? box.teams?.[battingSide ]?.players?.[playerKey(batterId )] : null;

  // Fallback names if players object is missing them
  const pitcher = pitcherStats(pitcherPlayer) || { name: ls.defense?.pitcher?.fullName || '', hand: '', era: 0, ip: '0.0', k: 0, bb: 0, h: 0, pitches: 0 };
  const batter  = batterStats(batterPlayer)  || { name: offense.batter?.fullName || '',       hand: '', avg: 0, hr: 0, rbi: 0, ops: 0, today: '0-0' };

  const line = transformLineScore(feed, awayAbbr, homeAbbr);
  const { onDeck, inHole } = onDeckInHole(feed);

  return {
    id: g.game?.pk || feed.gamePk || '',
    away: awayAbbr,
    home: homeAbbr,
    awayScore: ls.teams?.away?.runs ?? teams.away?.record?.runs ?? 0,
    homeScore: ls.teams?.home?.runs ?? teams.home?.record?.runs ?? 0,
    state: classifyState(g.status),
    inning: ls.currentInning ?? 0,
    half,
    outs: ls.outs ?? 0,
    balls: ls.balls ?? 0,
    strikes: ls.strikes ?? 0,
    bases,
    startUtc: g.datetime?.dateTime || '',
    venue: g.venue?.name ? `${g.venue.name}${g.venue.location?.city ? ', ' + g.venue.location.city : ''}` : '',
    broadcast: broadcastString(g.broadcasts || []),
    pitcher,
    batter,
    onDeck,
    inHole,
    line,
    recentPitches: transformRecentPitches(feed),
    plays: transformPlays(feed),
    winProb: 0.5,     // filled from ESPN
    leverage: 1.0,    // filled from ESPN
  };
}

/* ============================================================
 * ESPN WP merge
 * ============================================================ */
async function findEspnEventId(gamePk, awayAbbr, homeAbbr, isoStart) {
  // Use game start date (UTC) but ESPN expects YYYYMMDD in their tz (ET).
  // Safer: try the ET date that MLB considers "game date".
  const d = new Date(isoStart || Date.now());
  const etDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d).replace(/-/g, '');

  const awayNick = (DEFAULT_TEAMS[awayAbbr]?.name || '').toLowerCase();
  const homeNick = (DEFAULT_TEAMS[homeAbbr]?.name || '').toLowerCase();

  // Try today, then +/- 1 day (handles late-night games crossing midnight ET)
  const candidates = [etDate];
  const base = new Date(d);
  for (const offset of [-1, 1]) {
    const dd = new Date(base); dd.setUTCDate(dd.getUTCDate() + offset);
    candidates.push(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(dd).replace(/-/g, '')
    );
  }

  for (const yyyymmdd of candidates) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${yyyymmdd}`;
    let data;
    try {
      data = await espnScoreboardCache.get(`sb:${yyyymmdd}`, () => httpJson(url, { timeoutMs: 8000 }));
    } catch (e) {
      continue;
    }
    for (const ev of (data.events || [])) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      const cs = comp.competitors || [];
      const names = cs.map(c => (c.team?.name || '').toLowerCase());
      if (names.includes(awayNick) && names.includes(homeNick)) {
        return ev.id;
      }
    }
  }
  return null;
}

async function fetchEspnWp(eventId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${eventId}`;
  const data = await httpJson(url, { timeoutMs: 10_000 });
  const wp = data.winprobability || [];
  const plays = (data.plays || []).reduce((m, p) => { m[p.id] = p; return m; }, {});
  // homeWinPercentage is 0..1 per play entry; play ids tie to plays array
  return wp.map(w => ({
    playId: w.playId,
    homeWp: typeof w.homeWinPercentage === 'number' ? w.homeWinPercentage : 0.5,
    desc: plays[w.playId]?.text || '',
  }));
}

function computeImpact(delta) {
  const pct = Math.round(delta * 100);
  if (pct === 0) return '0%';
  return pct > 0 ? `+${pct}%` : `\u2212${Math.abs(pct)}%`;   // U+2212 minus
}

async function mergeEspn(detail) {
  try {
    const eventId = await findEspnEventId(detail.id, detail.away, detail.home, detail.startUtc);
    if (!eventId) return detail;

    const wpSeries = await espnGameCache.get(`wp:${eventId}`, () => fetchEspnWp(eventId));
    if (!wpSeries.length) return detail;

    // Current home win prob = last value
    const lastHomeWp = wpSeries[wpSeries.length - 1].homeWp;
    detail.winProb = lastHomeWp;   // Design interprets winProb as home's probability

    // Compute leverage from max |delta| over recent plays
    const deltas = [];
    for (let i = 1; i < wpSeries.length; i++) {
      deltas.push(wpSeries[i].homeWp - wpSeries[i - 1].homeWp);
    }
    const recent = deltas.slice(-8);
    const maxRecent = recent.length ? Math.max(...recent.map(Math.abs)) : 0;
    const avgRecent = recent.length ? recent.map(Math.abs).reduce((a, b) => a + b, 0) / recent.length : 0;
    // Scale so a 5% max swing -> ~1.0, 15% -> ~3.0, boosted by avg
    let leverage = maxRecent * 18 + avgRecent * 8;
    // Late-inning bonus
    if (detail.inning >= 7 && Math.abs(lastHomeWp - 0.5) < 0.3) leverage *= 1.2;
    detail.leverage = Math.max(0.1, Math.min(6.0, leverage));

    // Attach impact to each play by text match (best-effort)
    for (const p of detail.plays) {
      // Find the ESPN play whose text most resembles this play's description
      const best = wpSeries.slice().reverse().find(w =>
        w.desc && p.desc && (w.desc.slice(0, 40).toLowerCase() === p.desc.slice(0, 40).toLowerCase())
      );
      if (best) {
        const idx = wpSeries.indexOf(best);
        const prev = idx > 0 ? wpSeries[idx - 1].homeWp : best.homeWp;
        p.impact = computeImpact(best.homeWp - prev);
      } else {
        p.impact = '';
      }
    }
    // For any without a match, leave impact blank (Scoreboard handles blanks OK)
  } catch (e) {
    console.warn(`[espn] merge failed for game ${detail.id}:`, e.message);
  }
  return detail;
}

/* ============================================================
 * Standings
 * ============================================================ */
async function fetchStandings() {
  const year = new Date().getFullYear();
  const url = `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}&standingsTypes=regularSeason`;
  const data = await httpJson(url);

  const out = { AL: { East: [], Central: [], West: [] }, NL: { East: [], Central: [], West: [] } };

  const divIdToKey = {
    200: ['AL', 'West'], 201: ['AL', 'East'], 202: ['AL', 'Central'],
    203: ['NL', 'West'], 204: ['NL', 'East'], 205: ['NL', 'Central'],
  };

  for (const rec of (data.records || [])) {
    const key = divIdToKey[rec.division?.id];
    if (!key) continue;
    const [lg, div] = key;
    for (const tr of (rec.teamRecords || [])) {
      const abbr = ID_TO_ABBR[tr.team?.id];
      if (!abbr) continue;
      const lastTen = (tr.records?.splitRecords || []).find(r => r.type === 'lastTen');
      out[lg][div].push({
        team: abbr,
        w: tr.wins ?? 0,
        l: tr.losses ?? 0,
        gb: tr.gamesBack === '-' || tr.gamesBack == null ? '-' : tr.gamesBack,
        wcgb: tr.wildCardGamesBack === '-' || tr.wildCardGamesBack == null ? '-' : tr.wildCardGamesBack,
        l10: lastTen ? `${lastTen.wins}-${lastTen.losses}` : '0-0',
        strk: tr.streak?.streakCode || '-',
      });
    }
    // Sort by division rank (pct descending if rank missing)
    out[lg][div].sort((a, b) => {
      const adiff = a.w - a.l, bdiff = b.w - b.l;
      return bdiff - adiff;
    });
  }

  return out;
}

/* ============================================================
 * Express wiring
 * ============================================================ */
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

/* --- Auth --- */
app.post('/api/auth', (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRate(ip)) return res.status(429).json({ ok: false, error: 'too many attempts' });
  const pin = String(req.body?.pin || '').trim();
  const admin = pin === ADMIN_PIN;
  const user = pin === USER_PIN;
  if (!admin && !user) return res.status(401).json({ ok: false, error: 'wrong pin' });

  const token = mkToken();
  sessions.set(token, { admin, exp: Date.now() + SESSION_TTL });
  res.json({ ok: true, token, admin });
});

app.post('/api/auth/check', (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ ok: false });
  res.json({ ok: true, admin: s.admin });
});

/* --- Colors / teams --- */
app.get('/api/colors', (req, res) => {
  res.json(getTeams());
});

app.post('/api/colors/reload', requireAdmin, (req, res) => {
  loadColors();
  res.json({ ok: true, teams: Object.keys(colorOverrides).length });
});

/* --- Scoreboard --- */
app.get('/api/scores', async (req, res) => {
  const date = todayEastern();
  try {
    const data = await scoresCache.get(`scores:${date}`, () => fetchScheduleForDate(date));
    res.json(data);
  } catch (e) {
    console.error('[scores]', e.message);
    res.status(502).json({ ok: false, error: 'upstream error', date });
  }
});

app.get('/api/scores/:date', async (req, res) => {
  const date = (req.params.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date must be YYYY-MM-DD' });
  }
  const today = todayEastern();
  const ttl = date === today ? 30_000 : 5 * 60_000;
  try {
    const data = await scoresCache.get(`scores:${date}`, () => fetchScheduleForDate(date), ttl);
    res.json(data);
  } catch (e) {
    console.error('[scores]', date, e.message);
    res.status(502).json({ ok: false, error: 'upstream error', date });
  }
});

/* --- Single game (merged MLB + ESPN) --- */
app.get('/api/game/:id', async (req, res) => {
  const id = (req.params.id || '').trim();
  if (!/^\d+$/.test(id)) return res.status(400).json({ ok: false, error: 'numeric gamePk required' });
  try {
    const detail = await gameCache.get(`game:${id}`, async () => {
      const feed = await fetchFeed(id);
      const d = buildGameDetail(feed);
      await mergeEspn(d);
      return d;
    });
    res.json(detail);
  } catch (e) {
    console.error('[game]', id, e.message);
    res.status(502).json({ ok: false, error: 'upstream error' });
  }
});

/* --- ESPN WP raw (for debugging / direct consumption) --- */
app.get('/api/espn/game/:id', async (req, res) => {
  const id = (req.params.id || '').trim();
  if (!/^\d+$/.test(id)) return res.status(400).json({ ok: false, error: 'numeric gamePk required' });
  try {
    // Look up the game first to get team abbrs + date
    const feed = await fetchFeed(id);
    const d = buildGameDetail(feed);
    const eventId = await findEspnEventId(id, d.away, d.home, d.startUtc);
    if (!eventId) return res.json({ ok: true, eventId: null, series: [] });
    const series = await espnGameCache.get(`wp:${eventId}`, () => fetchEspnWp(eventId));
    res.json({ ok: true, eventId, series });
  } catch (e) {
    console.error('[espn]', id, e.message);
    res.status(502).json({ ok: false, error: 'upstream error' });
  }
});

/* --- Standings --- */
app.get('/api/standings', async (req, res) => {
  try {
    const data = await standingsCache.get('standings', fetchStandings);
    res.json(data);
  } catch (e) {
    console.error('[standings]', e.message);
    res.status(502).json({ ok: false, error: 'upstream error' });
  }
});

/* --- Static files (index, styles, jsx, colors csv if exposed) --- */
app.use(express.static(__dirname, {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
      res.set('Cache-Control', 'no-cache');
    }
  },
}));

/* --- Fallback to index for root --- */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* --- Health --- */
app.get('/healthz', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

/* ============================================================
 * Start
 * ============================================================ */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[dugout] listening on :${PORT}`);
  console.log(`[dugout] user PIN set (${USER_PIN.replace(/./g, '*')}), admin PIN set (${ADMIN_PIN.replace(/./g, '*')})`);
});

/* Graceful shutdown */
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`[dugout] ${sig} received, shutting down`);
    process.exit(0);
  });
}
