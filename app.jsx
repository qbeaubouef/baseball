/* Dugout main App - wires live MLB data to Design components. */
(function () {
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  /* ---------- tweak defaults (admin-adjustable) ---------- */
  const TWEAK_DEFAULTS = {
    layout: 'grid',
    intensity: 'medium',
    density: 'dense',
    theme: 'auto',
  };

  /* ---------- storage ---------- */
  const TOKEN_KEY = 'dugout.token';
  const ADMIN_KEY = 'dugout.admin';
  const TWEAKS_KEY = 'dugout.tweaks';

  function loadTweaks() {
    try {
      const raw = sessionStorage.getItem(TWEAKS_KEY);
      if (!raw) return { ...TWEAK_DEFAULTS };
      return { ...TWEAK_DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...TWEAK_DEFAULTS };
    }
  }

  function saveTweaks(t) {
    try { sessionStorage.setItem(TWEAKS_KEY, JSON.stringify(t)); } catch {}
  }

  /* ---------- API helpers ---------- */
  async function apiJson(url, opts = {}) {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      opts.headers || {},
      token ? { Authorization: `Bearer ${token}` } : {},
    );
    const r = await fetch(url, { ...opts, headers });
    if (!r.ok) {
      const err = new Error(`HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    return r.json();
  }

  function isoToday() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function isoForDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function useSystemDark() {
    const [dark, setDark] = useState(() =>
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    );
    useEffect(() => {
      if (!window.matchMedia) return;
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const h = (e) => setDark(e.matches);
      mq.addEventListener('change', h);
      return () => mq.removeEventListener('change', h);
    }, []);
    return dark;
  }

  /* =======================================================
   * App
   * ===================================================== */
  function App() {
    const [unlocked, setUnlocked] = useState(() => Boolean(sessionStorage.getItem(TOKEN_KEY)));
    const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === '1');
    const [tab, setTab] = useState('scores');
    const [expanded, setExpanded] = useState(null);
    const [tweaks, setTweaks] = useState(loadTweaks);
    const [tweaksOpen, setTweaksOpen] = useState(false);
    const [showAdminPrompt, setShowAdminPrompt] = useState(false);

    const [teams, setTeams] = useState(null);
    const [scoreboard, setScoreboard] = useState(null);    // { date, games }
    const [scoreboardErr, setScoreboardErr] = useState(null);
    const [standings, setStandings] = useState(null);
    const [expandedDetail, setExpandedDetail] = useState(null);

    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const systemDark = useSystemDark();

    /* ---------- token check on mount (handles expired sessions) ---------- */
    useEffect(() => {
      if (!unlocked) return;
      apiJson('/api/auth/check', { method: 'POST', body: '{}' }).catch((e) => {
        if (e.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(ADMIN_KEY);
          setUnlocked(false);
          setIsAdmin(false);
        }
      });
    }, [unlocked]);

    /* ---------- theme application ---------- */
    useEffect(() => {
      const root = document.documentElement;
      root.setAttribute('data-theme', tweaks.theme);
      if (tweaks.theme === 'auto') root.classList.toggle('is-dark', systemDark);
      else root.classList.remove('is-dark');
    }, [tweaks.theme, systemDark]);

    useEffect(() => { saveTweaks(tweaks); }, [tweaks]);

    const setTweak = (k, v) => setTweaks((prev) => ({ ...prev, [k]: v }));

    const unlock = (token, admin) => {
      sessionStorage.setItem(TOKEN_KEY, token);
      if (admin) sessionStorage.setItem(ADMIN_KEY, '1');
      setUnlocked(true);
      setIsAdmin(Boolean(admin));
    };
    const lock = () => {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(ADMIN_KEY);
      setUnlocked(false);
      setIsAdmin(false);
      setTweaksOpen(false);
    };

    /* ---------- teams load ---------- */
    useEffect(() => {
      if (!unlocked) return;
      apiJson('/api/colors').then(setTeams).catch((e) => console.error('colors load failed', e));
    }, [unlocked]);

    /* ---------- scoreboard load for selectedDate ---------- */
    const selectedIso = isoForDate(selectedDate);
    const today = isoToday();
    const isToday = selectedIso === today;

    const loadScoreboard = useCallback(async () => {
      try {
        const data = await apiJson(`/api/scores/${selectedIso}`);
        setScoreboard(data);
        setScoreboardErr(null);
      } catch (e) {
        setScoreboardErr(e.message || 'failed to load');
      }
    }, [selectedIso]);

    useEffect(() => {
      if (!unlocked) return;
      setScoreboard(null);
      setExpanded(null);
      setExpandedDetail(null);
      loadScoreboard();
    }, [unlocked, selectedIso, loadScoreboard]);

    // Auto-refresh every 30s, but only for today
    useEffect(() => {
      if (!unlocked || !isToday) return;
      const id = setInterval(loadScoreboard, 30_000);
      return () => clearInterval(id);
    }, [unlocked, isToday, loadScoreboard]);

    /* ---------- standings load ---------- */
    useEffect(() => {
      if (!unlocked || (tab !== 'standings' && tab !== 'playoff')) return;
      apiJson('/api/standings').then(setStandings).catch((e) => console.error('standings load', e));
    }, [unlocked, tab]);

    /* ---------- expanded game detail ---------- */
    useEffect(() => {
      if (!expanded) { setExpandedDetail(null); return; }
      let cancelled = false;
      const g = scoreboard?.games?.find((x) => x.id === expanded);
      const isLive = g?.state === 'live';

      const load = async () => {
        try {
          const detail = await apiJson(`/api/game/${expanded}`);
          if (!cancelled) setExpandedDetail(detail);
        } catch (e) {
          console.error('game detail load', e);
        }
      };
      load();

      // Auto-refresh expanded detail every 15s for live games
      let timer = null;
      if (isLive) timer = setInterval(load, 15_000);

      return () => {
        cancelled = true;
        if (timer) clearInterval(timer);
      };
    }, [expanded, scoreboard?.games]);

    /* ---------- not unlocked => PinGate ---------- */
    if (!unlocked) {
      return <window.PinGate onUnlock={unlock} />;
    }

    /* ---------- main render ---------- */
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ');
    const dates = buildDateStrip(selectedDate);

    const games = (scoreboard?.games || []).map((g) => {
      // If this is the expanded one, merge the detail in so detail-level fields are available
      if (g.id === expanded && expandedDetail) return { ...g, ...expandedDetail };
      return g;
    });

    const liveCount = games.filter((g) => g.state === 'live').length;
    const finalCount = games.filter((g) => g.state === 'final').length;
    const layoutClass =
      tweaks.layout === 'grid' ? 'cols-3' :
      tweaks.layout === 'list' ? 'layout-list' : 'layout-hybrid';

    const mastDate = selectedDate
      .toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      .toUpperCase();

    return (
      <>
        <header className="masthead">
          <div className="masthead-inner">
            <div className="mast-left">
              {liveCount > 0 ? (
                <><span><span className="live-dot" />{liveCount} LIVE</span><span>&middot;</span></>
              ) : finalCount > 0 ? (
                <><span>{finalCount} FINAL</span><span>&middot;</span></>
              ) : null}
              <span>{mastDate}</span>
            </div>
            <div
              className="mast-title"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => { if (!isAdmin) setShowAdminPrompt(true); else setTweaksOpen(!tweaksOpen); }}
              title={isAdmin ? 'Tweaks' : ''}
            >
              Dug<span className="amp">&middot;</span>out
            </div>
            <div className="mast-right">
              <span className="tz">{tz}</span>
              {isAdmin && (
                <button className="btn" onClick={() => setTweaksOpen(!tweaksOpen)}>Tweaks</button>
              )}
              <button className="btn" onClick={lock} title="Return to PIN gate">Lock</button>
            </div>
          </div>
          <nav className="subnav">
            <button className={tab === 'scores' ? 'active' : ''} onClick={() => setTab('scores')}>Scoreboard</button>
            <button className={tab === 'standings' ? 'active' : ''} onClick={() => setTab('standings')}>Standings</button>
            <button className={tab === 'playoff' ? 'active' : ''} onClick={() => setTab('playoff')}>Playoff Picture</button>
            <div className="spacer" />
            {isAdmin && (
              <div className="themepick">
                {['light', 'auto', 'dark'].map((th) => (
                  <button key={th} className={tweaks.theme === th ? 'active' : ''} onClick={() => setTweak('theme', th)}>
                    {th === 'light' ? '\u2600' : th === 'dark' ? '\u263E' : '\u25D0'} {th}
                  </button>
                ))}
              </div>
            )}
          </nav>
        </header>

        {tab === 'scores' && (
          <div className="datestrip">
            {dates.map((d, i) => (
              <div
                key={i}
                className={
                  'datepill' +
                  (isoForDate(d) === today ? ' today' : '') +
                  (isoForDate(d) === selectedIso ? ' active' : '')
                }
                onClick={() => setSelectedDate(d)}
              >
                <div className="dow">{d.toLocaleDateString([], { weekday: 'short' })}</div>
                <div className="dnum">{d.getDate()}</div>
                <div className="dmo">
                  {isoForDate(d) === today ? 'today' : d.toLocaleDateString([], { month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        )}

        <main className="page">
          {tab === 'scores' && (
            <>
              <div className="section-head">
                <h2>{isToday ? "Today's Slate" : selectedDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                <div className="meta">
                  {scoreboard
                    ? `${games.length} GAMES${liveCount ? ` \u00B7 ${liveCount} LIVE` : ''}${finalCount ? ` \u00B7 ${finalCount} FINAL` : ''}`
                    : 'LOADING...'}
                </div>
              </div>
              {scoreboardErr && (
                <div style={{ padding: '20px', color: 'var(--neg)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                  Could not load scores: {scoreboardErr}
                </div>
              )}
              {scoreboard && games.length === 0 && !scoreboardErr && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.1em' }}>
                  NO GAMES SCHEDULED
                </div>
              )}
              {teams && scoreboard && games.length > 0 && (
                <div className={`games-grid ${layoutClass}`}>
                  {games.map((g) => (
                    <window.GameCard
                      key={g.id}
                      g={g}
                      teams={teams}
                      expanded={expanded === g.id}
                      detailLoaded={expanded === g.id && Boolean(expandedDetail)}
                      onToggle={(id) => setExpanded(id === expanded ? null : id)}
                      intensity={tweaks.intensity}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'standings' && (
            <>
              <div className="section-head">
                <h2>Division Standings</h2>
                <div className="meta">{standings ? `THROUGH ${today.toUpperCase()} \u00B7 YOUR TEAM \u00B7 HOUSTON ASTROS` : 'LOADING...'}</div>
              </div>
              {teams && standings && (
                <window.Standings teams={teams} standings={standings} dense={tweaks.density === 'dense'} />
              )}
            </>
          )}

          {tab === 'playoff' && (
            <>
              <div className="section-head">
                <h2>Playoff Picture</h2>
                <div className="meta">SEEDS 1&ndash;6 &middot; AS OF {today.toUpperCase()}</div>
              </div>
              {teams && standings && (
                <window.PlayoffPicture teams={teams} standings={standings} />
              )}
            </>
          )}
        </main>

        {isAdmin && (
          <div className={`tweaks-panel ${tweaksOpen ? 'show' : ''}`}>
            <h3>Tweaks</h3>
            <div className="tweak-row">
              <label>Scoreboard Layout</label>
              <div className="tweak-opts">
                {[['grid', 'Grid'], ['list', 'List'], ['hybrid', 'Hybrid']].map(([k, v]) => (
                  <button key={k} className={tweaks.layout === k ? 'on' : ''} onClick={() => setTweak('layout', k)}>{v}</button>
                ))}
              </div>
            </div>
            <div className="tweak-row">
              <label>Team Color Intensity</label>
              <div className="tweak-opts">
                {[['subtle', 'Subtle'], ['medium', 'Medium'], ['bold', 'Bold']].map(([k, v]) => (
                  <button key={k} className={tweaks.intensity === k ? 'on' : ''} onClick={() => setTweak('intensity', k)}>{v}</button>
                ))}
              </div>
            </div>
            <div className="tweak-row">
              <label>Standings Density</label>
              <div className="tweak-opts two">
                {[['roomy', 'Roomy'], ['dense', 'Dense']].map(([k, v]) => (
                  <button key={k} className={tweaks.density === k ? 'on' : ''} onClick={() => setTweak('density', k)}>{v}</button>
                ))}
              </div>
            </div>
            <div className="tweak-row">
              <label>Theme</label>
              <div className="tweak-opts">
                {[['light', 'Light'], ['auto', 'Auto'], ['dark', 'Dark']].map(([k, v]) => (
                  <button key={k} className={tweaks.theme === k ? 'on' : ''} onClick={() => setTweak('theme', k)}>{v}</button>
                ))}
              </div>
            </div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8,
              paddingTop: 8, borderTop: '1px solid var(--rule)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>ADMIN</span>
              <button
                onClick={() => { sessionStorage.removeItem(ADMIN_KEY); setIsAdmin(false); setTweaksOpen(false); }}
                style={{
                  background: 'none', border: '1px solid var(--rule-strong)', borderRadius: 3,
                  fontFamily: 'var(--mono)', fontSize: 9, padding: '3px 8px', cursor: 'pointer',
                  color: 'var(--ink-2)', letterSpacing: '0.1em', textTransform: 'uppercase',
                }}
              >Exit admin</button>
            </div>
          </div>
        )}

        {showAdminPrompt && (
          <AdminPrompt
            onCancel={() => setShowAdminPrompt(false)}
            onSuccess={(token) => {
              sessionStorage.setItem(TOKEN_KEY, token);
              sessionStorage.setItem(ADMIN_KEY, '1');
              setIsAdmin(true);
              setShowAdminPrompt(false);
              setTweaksOpen(true);
            }}
          />
        )}
      </>
    );
  }

  /* =======================================================
   * Admin PIN prompt (inline modal)
   * ===================================================== */
  function AdminPrompt({ onCancel, onSuccess }) {
    const [pin, setPin] = useState('');
    const [err, setErr] = useState(false);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const submit = async () => {
      if (busy || pin.length < 4) return;
      setBusy(true);
      try {
        const r = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });
        const data = await r.json();
        if (data.ok && data.admin) {
          onSuccess(data.token);
        } else {
          setErr(true);
          setPin('');
          setTimeout(() => setErr(false), 700);
        }
      } catch (e) {
        setErr(true);
      } finally {
        setBusy(false);
      }
    };

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 20,
      }} onClick={onCancel}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--card)', padding: '28px 32px', borderRadius: 6,
            border: '1px solid var(--rule-strong)', maxWidth: 360, width: '100%',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.18em',
          }}>Restricted</div>
          <h3 style={{
            fontFamily: 'var(--display)', fontSize: 26, fontWeight: 900,
            fontStyle: 'italic', margin: '4px 0 18px', letterSpacing: '-0.01em',
          }}>Admin PIN</h3>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
            className={err ? 'error' : ''}
            style={{
              width: '100%', padding: '12px 14px', fontFamily: 'var(--mono)',
              fontSize: 20, letterSpacing: '0.3em', textAlign: 'center',
              border: `1.5px solid ${err ? 'var(--live)' : 'var(--rule-strong)'}`,
              borderRadius: 4, background: 'var(--paper-2)', color: 'var(--ink)',
              outline: 'none', boxSizing: 'border-box',
              animation: err ? 'shake 0.4s' : 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1, padding: '10px 14px', background: 'var(--paper-2)',
                border: '1px solid var(--rule)', borderRadius: 4,
                fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', color: 'var(--ink-2)',
              }}
            >Cancel</button>
            <button
              onClick={submit}
              disabled={busy || pin.length < 4}
              style={{
                flex: 1, padding: '10px 14px',
                background: pin.length === 4 ? 'var(--ink)' : 'var(--paper-3)',
                color: pin.length === 4 ? 'var(--paper)' : 'var(--ink-3)',
                border: '1px solid var(--ink)', borderRadius: 4,
                fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600,
                cursor: pin.length === 4 ? 'pointer' : 'not-allowed',
              }}
            >{busy ? '...' : 'Enter'}</button>
          </div>
          {err && (
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--live)',
              textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 10,
            }}>Incorrect PIN</div>
          )}
        </div>
      </div>
    );
  }

  /* =======================================================
   * Utilities
   * ===================================================== */
  function buildDateStrip(center) {
    const out = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(center);
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
