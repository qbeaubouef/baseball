// Format game time in user's local timezone
window.fmtLocalTime = function(utcStr) {
  if (!utcStr) return "";
  const d = new Date(utcStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

window.GameCard = function GameCard({ g, teams, expanded, detailLoaded, onToggle, intensity }) {
  const away = teams[g.away] || _fallbackTeam(g.away);
  const home = teams[g.home] || _fallbackTeam(g.home);
  const awayWinning = g.awayScore > g.homeScore;
  const homeWinning = g.homeScore > g.awayScore;
  const isLive = g.state === "live";
  const isPre = g.state === "pre";
  const isFinal = g.state === "final";
  const isBetween = isLive && (g.half === "mid" || g.half === "end");

  const tint = intensity === "bold"
    ? `color-mix(in oklab, ${home.primary} 16%, transparent)`
    : "transparent";

  const statusLabel =
    isPre ? (window.fmtLocalTime(g.startUtc) || (g.statusDetail || "SCHEDULED").toUpperCase())
    : isFinal ? `FINAL${g.inning > 9 ? ` / ${g.inning}` : ""}`
    : g.state === "postponed" ? "POSTPONED"
    : g.half === "top" ? `TOP ${ordinal(g.inning)}`
    : g.half === "bottom" ? `BOT ${ordinal(g.inning)}`
    : g.half === "mid" ? `MID ${ordinal(g.inning)}`
    : `END ${ordinal(g.inning)}`;

  return (
    <div
      className={`game ${expanded ? "expanded" : ""} ${isBetween ? "between" : ""}`}
      data-intensity={intensity}
      style={{ "--tint": tint }}
      onClick={(e) => { if (!expanded) onToggle(g.id); }}
    >
      <div className="accent" aria-hidden>
        <div className="hseg"><div className="p1" style={{ background: away.primary }} /><div className="p2" style={{ background: away.secondary }} /></div>
        <div className="hseg"><div className="p1" style={{ background: home.primary }} /><div className="p2" style={{ background: home.secondary }} /></div>
      </div>

      <div className="game-body">
        <div className="game-status">
          {isLive ? (
            <span className={isBetween ? "live between" : "live"}>{isBetween ? "\u25CF " : ""}{isBetween ? "BETWEEN" : "LIVE"} &middot; {statusLabel}</span>
          ) : (
            <span style={{ color: isFinal ? "var(--ink-2)" : "var(--ink-3)", fontWeight: isFinal ? 700 : 400 }}>{statusLabel}</span>
          )}
          <span>{(g.venue || "").split(",")[0]}</span>
        </div>

        {expanded && <div className="close-detail" onClick={(e) => { e.stopPropagation(); onToggle(null); }}>&times;</div>}

        <TeamRow t={away} score={isPre ? "\u2014" : g.awayScore} loser={!isPre && homeWinning} />
        <TeamRow t={home} score={isPre ? "\u2014" : g.homeScore} loser={!isPre && awayWinning} />

        <div className="live-bar">
          {isLive ? (
            <>
              <BaseDiamond bases={g.bases || { first: false, second: false, third: false }} outs={g.outs || 0} awayColor={away.primary} homeColor={home.primary} battingTop={g.half === "top"} dimmed={isBetween} />
              <div className="count-disp">
                {isBetween ? (
                  <span className="mid-msg">Changing sides&hellip;</span>
                ) : (
                  <>
                    <span><b>{g.balls}</b>B</span>
                    <span><b>{g.strikes}</b>S</span>
                    <span><b>{g.outs}</b>O</span>
                  </>
                )}
              </div>
              <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {(g.broadcast || "").split(" \u00B7 ")[0]}
              </div>
            </>
          ) : (
            <div style={{ gridColumn: "1 / -1", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
              <span>{isPre ? "SCHEDULED" : isFinal ? "COMPLETED" : (g.statusDetail || "").toUpperCase()}</span>
              <span>{(g.broadcast || "").split(" \u00B7 ")[0]}</span>
            </div>
          )}
        </div>
      </div>

      {expanded && (detailLoaded
        ? <GameDetail g={g} teams={teams} />
        : <DetailLoading />
      )}
    </div>
  );
};

function _fallbackTeam(abbr) {
  return { abbr: abbr || "?", name: abbr || "?", city: "", primary: "#333", secondary: "#888", ink: "#fff" };
}

function DetailLoading() {
  return (
    <div className="detail" style={{ textAlign: "center", padding: "32px", color: "var(--ink-3)" }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        Loading game details&hellip;
      </div>
    </div>
  );
}

function TeamRow({ t, score, loser }) {
  return (
    <div className={`team-row ${loser ? "loser" : ""}`} style={{ "--team-primary": t.primary, "--team-secondary": t.secondary, "--team-ink": t.ink }}>
      <div className="team-badge">{t.abbr}</div>
      <div>
        <div className="team-name">{t.name}</div>
        <div className="team-record">{t.city}</div>
      </div>
      <div className="team-score">{score}</div>
    </div>
  );
}

function BaseDiamond({ bases, outs, awayColor, homeColor, battingTop, dimmed }) {
  const accent = battingTop ? awayColor : homeColor;
  const alt = battingTop ? homeColor : awayColor;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: dimmed ? 0.35 : 1 }}>
      <div className="diamond" style={{ "--accent": accent, "--accent-alt": alt }}>
        <div className={`b second ${bases.second ? "occupied" : ""}`} />
        <div className={`b first ${bases.first ? "occupied" : ""}`} />
        <div className={`b third ${bases.third ? "occupied" : ""}`} />
        <div className="b home" />
      </div>
      <div className="outs-pips">
        {[0,1,2].map(i => <div key={i} className={`pip ${i < outs ? "on" : ""}`} />)}
      </div>
    </div>
  );
}

function ordinal(n) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

function GameDetail({ g, teams }) {
  const away = teams[g.away] || _fallbackTeam(g.away);
  const home = teams[g.home] || _fallbackTeam(g.home);
  const winProb = typeof g.winProb === "number" ? g.winProb : 0.5;
  const awayWP = Math.round((1 - winProb) * 100);
  const homeWP = Math.round(winProb * 100);

  const pitcher = g.pitcher || { name: "", hand: "", era: 0, ip: "0.0", k: 0, bb: 0, h: 0, pitches: 0 };
  const batter = g.batter || { name: "", hand: "", avg: 0, hr: 0, rbi: 0, ops: 0, today: "0-0" };
  const recentPitches = g.recentPitches || [];
  const plays = g.plays || [];
  const scoringPlays = g.scoringPlays || [];
  const wpHistory = g.wpHistory || [];
  const boxData = g.box || { awayBatters: [], awayPitchers: [], homeBatters: [], homePitchers: [] };
  const line = g.line || { [away.abbr]: [], [home.abbr]: [], hitsA: 0, errA: 0, hitsH: 0, errH: 0 };
  const leverage = typeof g.leverage === "number" ? g.leverage : 1.0;

  const isLive = g.state === "live";
  const isBetween = isLive && (g.half === "mid" || g.half === "end");
  // When mid (between top & bottom), home bats next. When end, away bats next.
  const nextHalf = g.half === "mid" ? "bottom" : g.half === "end" ? "top" : g.half;
  const nextInning = g.half === "end" ? g.inning + 1 : g.inning;
  const battingTeam = (g.half === "top" || nextHalf === "top") ? away : home;
  const pitchingTeam = (g.half === "top" || nextHalf === "top") ? home : away;

  const leader = homeWP >= 50 ? home : away;
  const leaderWP = Math.max(homeWP, awayWP);

  return (
    <div className="detail">
      <div className="detail-grid">
        <div className="dcard matchup-card">
          {isBetween ? (
            <>
              <h3>Between Innings</h3>
              <div className="between-block">
                <div className="between-big">
                  {g.half === "mid" ? "Middle" : "End"} of the {ordinal(g.inning)}
                </div>
                <div className="between-sub">
                  Up next · <b style={{ color: battingTeam.primary }}>{battingTeam.abbr}</b> batting{" "}
                  ({nextHalf === "top" ? "Top" : "Bottom"} {ordinal(nextInning)})
                </div>
                <div className="between-meta">
                  <span>Waiting for first pitch…</span>
                  <span>Pitcher TBD · probable <b>{pitchingTeam.abbr}</b> reliever</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <h3>At Bat</h3>
              <div className="vs-split">
                <div className="person" style={{ color: pitchingTeam.primary }}>
                  <div className="role">PITCHING &middot; {pitchingTeam.abbr}</div>
                  <div className="pname" style={{ color: "var(--ink)" }}>{pitcher.name}</div>
                  <div className="stats">
                    {pitcher.hand && <span>{pitcher.hand}HP</span>}
                    <span><b>{Number(pitcher.era || 0).toFixed(2)}</b> ERA</span>
                    <span><b>{pitcher.ip || "0.0"}</b> IP</span>
                    <span><b>{pitcher.k ?? 0}</b> K</span>
                    <span><b>{pitcher.pitches ?? 0}</b> P</span>
                  </div>
                </div>
                <div className="vs-slash">/</div>
                <div className="person right">
                  <div className="role" style={{ color: battingTeam.primary }}>AT BAT &middot; {battingTeam.abbr}</div>
                  <div className="pname">{batter.name}</div>
                  <div className="stats right">
                    {batter.hand && <span>{batter.hand}HB</span>}
                    <span><b>.{String(Math.round((batter.avg || 0)*1000)).padStart(3,"0")}</b></span>
                    <span><b>{batter.hr ?? 0}</b> HR</span>
                    <span><b>{Number(batter.ops || 0).toFixed(3)}</b> OPS</span>
                    <span>TODAY <b>{batter.today || "0-0"}</b></span>
                  </div>
                </div>
              </div>
            </>
          )}

          <h3 style={{ marginTop: 22 }}>Strike Zone &middot; Last {recentPitches.length} Pitches {isBetween ? "(Prev. inning)" : ""}</h3>
          <div className="zonebox">
            <StrikeZone pitches={recentPitches} />
          </div>

          <div className="venue-meta">
            <span>{g.venue}</span>
            <span>TV &middot; {g.broadcast}</span>
            {!isBetween && g.onDeck && <span>ON DECK &middot; {g.onDeck}</span>}
          </div>
        </div>

        <div>
          <div className="dcard">
            <h3>Pitch Log {isBetween ? "(Prev. inning)" : ""}</h3>
            <div className="pitchlog">
              {recentPitches.length === 0
                ? <div style={{ color: "var(--ink-3)", fontSize: 11, padding: "6px 0" }}>&mdash;</div>
                : recentPitches.map((p, i) => {
                    const isStrike = /strike|foul|swinging/i.test(p.result || "");
                    return (
                      <div key={i} className="prow">
                        <div className="pn">#{i+1}</div>
                        <div className="pt">{p.type || "-"}</div>
                        <div className={`pr ${isStrike ? "strike" : "ball"}`}>{p.result || "-"}</div>
                        <div className="ps">{p.speed ? `${p.speed} mph` : ""}</div>
                      </div>
                    );
                  })
              }
            </div>
          </div>

          <div className="dcard" style={{ marginTop: 14 }}>
            <h3>Line Score</h3>
            <LineScore line={line} away={away} home={home} curInning={g.inning} curHalf={g.half} awayScore={g.awayScore} homeScore={g.homeScore} />
          </div>

          <div className="dcard" style={{ marginTop: 14 }}>
            <h3>Box Score</h3>
            <CollapsibleBox team={away} batters={boxData.awayBatters} pitchers={boxData.awayPitchers} defaultOpen={true} />
            <CollapsibleBox team={home} batters={boxData.homeBatters} pitchers={boxData.homePitchers} defaultOpen={false} />
          </div>
        </div>

        <div>
          <div className="dcard wp-card" style={{
            "--leader-color": leader.primary, "--leader-stripe": leader.secondary,
            "--away-color": away.primary, "--home-color": home.primary
          }}>
            <div className="wp-header">
              <h3>Win Probability</h3>
              <div className="wp-leader">
                <span className="wp-ld-badge" style={{ background: leader.primary, boxShadow: `0 0 0 2px ${leader.secondary}, 0 0 0 3px ${leader.primary}` }}>{leader.abbr}</span>
                <span className="wp-ld-pct">{leaderWP}.0%</span>
              </div>
            </div>
            <WPChart history={wpHistory} away={away} home={home} />
            {isLive && (
              <div className="leverage">
                <span>Leverage Index <b>{leverage.toFixed(1)}</b></span>
                <span>{leverage > 2.5 ? "HIGH" : leverage > 1 ? "MED" : "LOW"}</span>
              </div>
            )}
          </div>

          <div className="dcard" style={{ marginTop: 14 }}>
            <h3>Scoring Plays</h3>
            <div className="plays scoring">
              {scoringPlays.length === 0
                ? <div style={{ color: "var(--ink-3)", fontSize: 11, padding: "6px 0" }}>No runs yet</div>
                : scoringPlays.map((p, i) => (
                    <div key={i} className="play">
                      <div className="pinning">{p.inning}</div>
                      <div className="pdesc">{p.desc}</div>
                      <div className="pimp scoring-score" style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>
                        <span style={{ color: away.primary }}>{p.awayScore ?? ""}</span>
                        <span style={{ color: "var(--ink-3)", margin: "0 3px", fontWeight: 400 }}>-</span>
                        <span style={{ color: home.primary }}>{p.homeScore ?? ""}</span>
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>

          <div className="dcard" style={{ marginTop: 14 }}>
            <h3>Recent Plays</h3>
            <div className="plays">
              {plays.map((p, i) => {
                const impact = p.impact || "";
                const neg = impact.includes("\u2212") || impact.startsWith("-");
                return (
                  <div key={i} className="play">
                    <div className="pinning">{p.inning}</div>
                    <div className="pdesc">{p.desc}</div>
                    <div className={`pimp ${neg ? "neg" : "pos"}`}>{impact}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollapsibleBox({ team, batters, pitchers, defaultOpen }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="collapsibox" data-open={open}>
      <button className="collapsibox-head" onClick={() => setOpen(!open)} style={{
        "--team-primary": team.primary, "--team-secondary": team.secondary
      }}>
        <span className="cb-badge" style={{ background: team.primary, boxShadow: `inset 0 0 0 2px ${team.primary}, 0 0 0 1px ${team.secondary}, 0 0 0 2px ${team.primary}` }}>{team.abbr}</span>
        <span className="cb-name">{team.city} {team.name}</span>
        <span className="cb-meta">{batters.length} BAT · {pitchers.length} PIT</span>
        <span className="cb-chev" aria-hidden>{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="collapsibox-body">
          <div className="cb-subhead">Batters</div>
          <BatterTable team={team} rows={batters} />
          <div className="cb-subhead" style={{ marginTop: 10 }}>Pitchers</div>
          <PitcherTable team={team} rows={pitchers} />
        </div>
      )}
    </div>
  );
}

function BatterTable({ team, rows }) {
  return (
    <div className="boxtbl">
      <div className="boxhead" style={{ color: team.primary }}>
        <span className="bh-team">{team.abbr}</span>
        <span>AB</span><span>R</span><span>H</span><span>RBI</span><span>BB</span><span>SO</span><span>BA</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="boxrow">
          <span className="bh-team"><b>{r.pos}</b> {r.name}</span>
          <span>{r.ab}</span><span>{r.r}</span><span>{r.h}</span><span>{r.rbi}</span><span>{r.bb}</span><span>{r.so}</span><span>{r.ba}</span>
        </div>
      ))}
    </div>
  );
}

function PitcherTable({ team, rows }) {
  return (
    <div className="boxtbl pitchers">
      <div className="boxhead" style={{ color: team.primary }}>
        <span className="bh-team">{team.abbr}</span>
        <span>IP</span><span>H</span><span>R</span><span>ER</span><span>BB</span><span>SO</span><span>P-S</span><span>ERA</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="boxrow">
          <span className="bh-team">{r.name}</span>
          <span>{r.ip}</span><span>{r.h}</span><span>{r.r}</span><span>{r.er}</span><span>{r.bb}</span><span>{r.so}</span><span>{r.ps}</span><span>{Number(r.era || 0).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function WPChart({ history, away, home }) {
  // Render a small SVG line chart. y = probability of "home winning", 0..100.
  // Line drawn in home color above 50; away color below 50 (via clip paths).
  const W = 280, H = 130, padL = 4, padR = 4, padT = 8, padB = 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = (history || []).length;
  if (n === 0) {
    return (
      <div className="wpchart-wrap" style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        No win probability data
      </div>
    );
  }
  const maxInning = Math.max(...history.map(p => p.inning || 0), 9);
  const xFor = (i) => padL + (i / Math.max(n - 1, 1)) * plotW;
  const yFor = (wp) => padT + (1 - wp) * plotH;

  // Build line path for home wp.
  const pts = history.map((p, i) => ({ x: xFor(i), y: yFor(p.wp), wp: p.wp, inning: p.inning, half: p.half }));
  const lineD = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");

  // Area fills: above 50 → home color, below 50 → away color.
  // We'll split by clipping. For simplicity, draw two areas with clip rects.
  const midY = yFor(0.5);

  const areaD = lineD + ` L ${pts[pts.length-1].x.toFixed(1)} ${midY.toFixed(1)} L ${pts[0].x.toFixed(1)} ${midY.toFixed(1)} Z`;

  const ticks = [];
  for (let inn = 1; inn <= maxInning; inn++) {
    // Position: use inning proxy based on how many points are at that inning
    const idx = history.findIndex(p => p.inning === inn);
    if (idx >= 0) ticks.push({ inn, x: xFor(idx) });
  }

  const currentPt = pts[pts.length - 1];

  return (
    <div className="wpchart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="wpchart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wp-home-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={home.primary} stopOpacity="0.25" />
            <stop offset="100%" stopColor={home.primary} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="wp-away-fill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={away.primary} stopOpacity="0.25" />
            <stop offset="100%" stopColor={away.primary} stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="wp-clip-home">
            <rect x={padL} y={padT} width={plotW} height={midY - padT} />
          </clipPath>
          <clipPath id="wp-clip-away">
            <rect x={padL} y={midY} width={plotW} height={padT + plotH - midY} />
          </clipPath>
        </defs>
        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <line key={v} x1={padL} x2={W - padR} y1={yFor(v)} y2={yFor(v)}
            stroke={v === 0.5 ? "var(--ink-2)" : "var(--rule)"}
            strokeWidth={v === 0.5 ? 1 : 0.5}
            strokeDasharray={v === 0.5 ? "0" : "2 3"}
          />
        ))}
        {/* Area fills */}
        <path d={areaD} fill="url(#wp-home-fill)" clipPath="url(#wp-clip-home)" />
        <path d={areaD} fill="url(#wp-away-fill)" clipPath="url(#wp-clip-away)" />
        {/* Line */}
        <path d={lineD} fill="none" stroke={home.primary} strokeWidth="2" clipPath="url(#wp-clip-home)" />
        <path d={lineD} fill="none" stroke={away.primary} strokeWidth="2" clipPath="url(#wp-clip-away)" />
        {/* Current point */}
        <circle cx={currentPt.x} cy={currentPt.y} r="3.5" fill={currentPt.wp >= 0.5 ? home.primary : away.primary} stroke="var(--card)" strokeWidth="1.5" />
        {/* Inning ticks */}
        {ticks.map(t => (
          <text key={t.inn} x={t.x} y={H - 6} fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)" textAnchor="middle">{t.inn}</text>
        ))}
        {/* 100 / 50 labels */}
        <text x={W - padR - 2} y={padT + 9} fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)" textAnchor="end">100</text>
        <text x={W - padR - 2} y={midY - 2} fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)" textAnchor="end">50</text>
        <text x={W - padR - 2} y={padT + plotH - 2} fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)" textAnchor="end">100</text>
      </svg>
      <div className="wpchart-legend">
        <span><i className="sw" style={{ background: home.primary, boxShadow: `0 0 0 1px ${home.secondary}` }} /> {home.abbr}</span>
        <span><i className="sw" style={{ background: away.primary, boxShadow: `0 0 0 1px ${away.secondary}` }} /> {away.abbr}</span>
      </div>
    </div>
  );
}

function StrikeZone({ pitches }) {
  // Coord system: x in [-2, 2] feet, y in [0, 5] feet (height above plate)
  // Zone box roughly x in [-0.83, 0.83], y in [1.5, 3.5]
  const W = 180, H = 220;
  const xToPx = (x) => ((x + 2) / 4) * W;
  const yToPx = (y) => H - (y / 5) * H;

  return (
    <div className="zone">
      <div className="box">
        <div className="vline" style={{ left: "33.33%" }} />
        <div className="vline" style={{ left: "66.66%" }} />
        <div className="hline" style={{ top: "33.33%" }} />
        <div className="hline" style={{ top: "66.66%" }} />
      </div>
      <div className="plate" />
      {pitches.map((p, i) => {
        const isStrike = /strike|foul/i.test(p.result);
        const isCurrent = i === pitches.length - 1;
        return (
          <div
            key={i}
            className={`pitch ${isStrike ? "strike" : "ball"} ${isCurrent ? "current" : ""}`}
            style={{ left: xToPx(p.x), top: yToPx(p.y) }}
            title={`${p.type} ${p.speed} · ${p.result}`}
          >
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}

function LineScore({ line, away, home, curInning, curHalf, awayScore, homeScore }) {
  const awayArr = line[away.abbr] || [];
  const homeArr = line[home.abbr] || [];
  const maxInn = Math.max(awayArr.length, homeArr.length, 9);
  const innings = Array.from({ length: maxInn }, (_, i) => i + 1);
  const cellAway = (i) => {
    const v = awayArr[i-1];
    if (v === undefined) {
      if (i === curInning && curHalf === "top") return "·";
      return "";
    }
    return v;
  };
  const cellHome = (i) => {
    const v = homeArr[i-1];
    if (v === undefined) {
      if (i === curInning && curHalf === "bottom") return "·";
      return "";
    }
    return v;
  };

  return (
    <table className="linescore">
      <thead>
        <tr>
          <th></th>
          {innings.map(i => <th key={i}>{i}</th>)}
          <th style={{ borderLeft: "1px solid var(--rule-strong)", paddingLeft: 10 }}>R</th>
          <th>H</th>
          <th>E</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="team" style={{ color: away.primary, fontWeight: 800 }}>{away.abbr}</td>
          {innings.map(i => {
            const isCur = i === curInning && curHalf === "top";
            return <td key={i}><span className={isCur ? "cur" : ""} style={isCur ? { padding: "1px 5px" } : {}}>{cellAway(i)}</span></td>;
          })}
          <td className="total" style={{ borderLeft: "1px solid var(--rule-strong)" }}>{awayScore}</td>
          <td className="total">{line.hitsA}</td>
          <td className="total">{line.errA}</td>
        </tr>
        <tr>
          <td className="team" style={{ color: home.primary, fontWeight: 800 }}>{home.abbr}</td>
          {innings.map(i => {
            const isCur = i === curInning && curHalf === "bottom";
            return <td key={i}><span className={isCur ? "cur" : ""} style={isCur ? { padding: "1px 5px" } : {}}>{cellHome(i)}</span></td>;
          })}
          <td className="total" style={{ borderLeft: "1px solid var(--rule-strong)" }}>{homeScore}</td>
          <td className="total">{line.hitsH}</td>
          <td className="total">{line.errH}</td>
        </tr>
      </tbody>
    </table>
  );
}
