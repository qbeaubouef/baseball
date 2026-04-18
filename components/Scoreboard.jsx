/* Scoreboard - renders game cards with Design's visual, handles pre/live/final states. */

window.fmtLocalTime = function (utcStr) {
  if (!utcStr) return '';
  const d = new Date(utcStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function statusLabel(g) {
  if (g.state === 'live') {
    // Prefer the API's own inningState if present
    if (g.inningState === 'Middle') return `MID ${ordinal(g.inning)}`;
    if (g.inningState === 'End') return `END ${ordinal(g.inning)}`;
    // Fallback: outs-based heuristic
    if (g.outs >= 3) return `${g.half === 'top' ? 'MID' : 'END'} ${ordinal(g.inning)}`;
    const half = g.half === 'top' ? 'TOP' : 'BOT';
    return `${half} ${ordinal(g.inning)}`;
  }
  if (g.state === 'final') {
    const extra = g.inning && g.inning > 9 ? ` / ${g.inning}` : '';
    return `FINAL${extra}`;
  }
  if (g.state === 'postponed') return 'POSTPONED';
  // pre-game
  return window.fmtLocalTime(g.startUtc) || (g.statusDetail || 'SCHEDULED').toUpperCase();
}

function venueShort(venue) {
  if (!venue) return '';
  return venue.split(',')[0].trim();
}

window.GameCard = function GameCard({ g, teams, expanded, detailLoaded, onToggle, intensity }) {
  const away = teams[g.away] || fallbackTeam(g.away);
  const home = teams[g.home] || fallbackTeam(g.home);

  const awayWinning = g.awayScore > g.homeScore;
  const homeWinning = g.homeScore > g.awayScore;

  const tint = intensity === 'bold'
    ? `color-mix(in oklab, ${home.primary} 16%, transparent)`
    : 'transparent';

  const status = statusLabel(g);
  const isLive = g.state === 'live';
  const isPre = g.state === 'pre';
  const isFinal = g.state === 'final';

  return (
    <div
      className={`game ${expanded ? 'expanded' : ''}`}
      data-intensity={intensity}
      style={{ '--tint': tint }}
      onClick={(e) => { if (!expanded) onToggle(g.id); }}
    >
      <div className="accent" aria-hidden>
        <div className="hseg">
          <div className="p1" style={{ background: away.primary }} />
          <div className="p2" style={{ background: away.secondary }} />
        </div>
        <div className="hseg">
          <div className="p1" style={{ background: home.primary }} />
          <div className="p2" style={{ background: home.secondary }} />
        </div>
      </div>

      <div className="game-body">
        <div className="game-status">
          {isLive
            ? <span className="live">LIVE &middot; {status}</span>
            : <span style={{ color: isFinal ? 'var(--ink-2)' : 'var(--ink-3)', fontWeight: isFinal ? 700 : 400 }}>{status}</span>
          }
          <span>{venueShort(g.venue)}</span>
        </div>

        {expanded && <div className="close-detail" onClick={(e) => { e.stopPropagation(); onToggle(null); }}>&times;</div>}

        <TeamRow t={away} score={isPre ? '\u2014' : g.awayScore} loser={!isPre && homeWinning} />
        <TeamRow t={home} score={isPre ? '\u2014' : g.homeScore} loser={!isPre && awayWinning} />

        <div className="live-bar">
          {isLive ? (
            <>
              <BaseDiamond
                bases={g.bases || { first: false, second: false, third: false }}
                outs={g.outs || 0}
                awayColor={away.primary}
                homeColor={home.primary}
                battingTop={g.half === 'top'}
              />
              <div className="count-disp">
                <span><b>{g.balls}</b>B</span>
                <span><b>{g.strikes}</b>S</span>
                <span><b>{g.outs}</b>O</span>
              </div>
              <div style={{
                textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10,
                color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {(g.broadcast || '').split(' \u00B7 ')[0]}
              </div>
            </>
          ) : (
            <div style={{
              gridColumn: '1 / -1', fontFamily: 'var(--mono)', fontSize: 10,
              color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>{isPre ? 'SCHEDULED' : isFinal ? 'COMPLETED' : (g.statusDetail || '').toUpperCase()}</span>
              <span>{(g.broadcast || '').split(' \u00B7 ')[0]}</span>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        detailLoaded
          ? <GameDetail g={g} teams={teams} />
          : <DetailLoading />
      )}
    </div>
  );
};

function fallbackTeam(abbr) {
  return { abbr: abbr || '?', name: abbr || '?', city: '', primary: '#333', secondary: '#888', ink: '#fff' };
}

function DetailLoading() {
  return (
    <div className="detail" style={{ textAlign: 'center', padding: '32px', color: 'var(--ink-3)' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        Loading game details...
      </div>
    </div>
  );
}

function TeamRow({ t, score, loser }) {
  return (
    <div
      className={`team-row ${loser ? 'loser' : ''}`}
      style={{ '--team-primary': t.primary, '--team-secondary': t.secondary, '--team-ink': t.ink }}
    >
      <div className="team-badge">{t.abbr}</div>
      <div>
        <div className="team-name">{t.name}</div>
        <div className="team-record">{t.city}</div>
      </div>
      <div className="team-score">{score}</div>
    </div>
  );
}

function BaseDiamond({ bases, outs, awayColor, homeColor, battingTop }) {
  const accent = battingTop ? awayColor : homeColor;
  const alt = battingTop ? homeColor : awayColor;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div className="diamond" style={{ '--accent': accent, '--accent-alt': alt }}>
        <div className={`b second ${bases.second ? 'occupied' : ''}`} />
        <div className={`b first ${bases.first ? 'occupied' : ''}`} />
        <div className={`b third ${bases.third ? 'occupied' : ''}`} />
        <div className="b home" />
      </div>
      <div className="outs-pips">
        {[0, 1, 2].map((i) => <div key={i} className={`pip ${i < outs ? 'on' : ''}`} />)}
      </div>
    </div>
  );
}

function GameDetail({ g, teams }) {
  const away = teams[g.away] || fallbackTeam(g.away);
  const home = teams[g.home] || fallbackTeam(g.home);
  const awayWP = Math.round((1 - (g.winProb ?? 0.5)) * 100);
  const homeWP = Math.round((g.winProb ?? 0.5) * 100);

  const pitcher = g.pitcher || {};
  const batter = g.batter || {};
  const battingTeam = g.half === 'top' ? away : home;
  const pitchingTeam = g.half === 'top' ? home : away;

  const recentPitches = g.recentPitches || [];
  const plays = g.plays || [];
  const line = g.line || { [away.abbr]: [], [home.abbr]: [], hitsA: 0, errA: 0, hitsH: 0, errH: 0 };
  const leverage = g.leverage ?? 1.0;

  const isLive = g.state === 'live';
  const isBetweenInnings = isLive && (g.inningState === 'Middle' || g.inningState === 'End' || (g.outs ?? 0) >= 3);
  const showMatchup = isLive && !isBetweenInnings && pitcher.name && batter.name;

  return (
    <div className="detail">
      <div className="detail-grid">
        <div className="dcard matchup-card">
          <h3>{isBetweenInnings ? 'Between Innings' : isLive ? 'At Bat' : 'Matchup'}</h3>
          {showMatchup ? (
            <div className="vs-split">
              <div className="person" style={{ color: pitchingTeam.primary }}>
                <div className="role">PITCHING &middot; {pitchingTeam.abbr}</div>
                <div className="pname" style={{ color: 'var(--ink)' }}>{pitcher.name}</div>
                <div className="stats">
                  {pitcher.hand && <span>{pitcher.hand}HP</span>}
                  <span><b>{Number(pitcher.era || 0).toFixed(2)}</b> ERA</span>
                  <span><b>{pitcher.ip || '0.0'}</b> IP</span>
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
                  <span><b>.{String(Math.round((batter.avg || 0) * 1000)).padStart(3, '0')}</b></span>
                  <span><b>{batter.hr ?? 0}</b> HR</span>
                  <span><b>{Number(batter.ops || 0).toFixed(3)}</b> OPS</span>
                  <span>TODAY <b>{batter.today || '0-0'}</b></span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '20px 0', fontFamily: 'var(--mono)', fontSize: 11,
              color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {g.state === 'final' ? 'Game completed'
                : g.state === 'pre' ? 'Game has not started'
                : isBetweenInnings ? `Waiting for ${g.half === 'top' ? 'bottom' : 'top'} of ${g.inning + (g.half === 'bottom' ? 1 : 0)}`
                : 'Between batters'}
            </div>
          )}

          <h3 style={{ marginTop: 22 }}>
            Strike Zone {recentPitches.length > 0 ? `\u00B7 Last ${recentPitches.length} Pitches` : ''}
          </h3>
          <div className="zonebox">
            <StrikeZone pitches={recentPitches} />
          </div>

          <div className="venue-meta">
            {g.venue && <span>{g.venue}</span>}
            {g.broadcast && <span>TV &middot; {g.broadcast}</span>}
            {isLive && g.onDeck && <span>ON DECK &middot; {g.onDeck}</span>}
          </div>
        </div>

        <div>
          <div className="dcard">
            <h3>Pitch Log</h3>
            <div className="pitchlog">
              {recentPitches.length === 0
                ? <div style={{ color: 'var(--ink-3)', fontSize: 11, padding: '6px 0' }}>No recent pitches</div>
                : recentPitches.map((p, i) => {
                    const isStrike = /strike|foul|swinging/i.test(p.result || '');
                    return (
                      <div key={i} className="prow">
                        <div className="pn">#{i + 1}</div>
                        <div className="pt">{p.type || '-'}</div>
                        <div className={`pr ${isStrike ? 'strike' : 'ball'}`}>{p.result || '-'}</div>
                        <div className="ps">{p.speed ? `${p.speed} mph` : ''}</div>
                      </div>
                    );
                  })
              }
            </div>
          </div>

          <div className="dcard" style={{ marginTop: 14 }}>
            <h3>Line Score</h3>
            <LineScore
              line={line}
              away={away}
              home={home}
              curInning={g.inning}
              curHalf={g.half}
              awayScore={g.awayScore}
              homeScore={g.homeScore}
            />
          </div>
        </div>

        <div>
          <div
            className="dcard"
            style={{
              '--away-color': away.primary, '--home-color': home.primary,
              '--away-stripe': away.secondary, '--home-stripe': home.secondary,
            }}
          >
            <h3>Win Probability</h3>
            <WPHeader wpSeries={g.wpSeries} fallbackWp={g.winProb ?? 0.5} away={away} home={home} />
            <WPChart wpSeries={g.wpSeries || []} away={away} home={home} />
            {isLive && (
              <div className="leverage">
                <span>Leverage Index <b>{leverage.toFixed(1)}</b></span>
                <span>{leverage > 2.5 ? 'HIGH' : leverage > 1 ? 'MED' : 'LOW'}</span>
              </div>
            )}
          </div>

          <div className="dcard" style={{ marginTop: 14 }}>
            <h3>Recent Plays</h3>
            <div className="plays">
              {plays.length === 0
                ? <div style={{ color: 'var(--ink-3)', fontSize: 11, padding: '6px 0' }}>No plays yet</div>
                : plays.map((p, i) => {
                    const impact = p.impact || '';
                    const neg = impact.includes('\u2212') || impact.startsWith('-');
                    return (
                      <div key={i} className="play">
                        <div className="pinning">{p.inning}</div>
                        <div className="pdesc">{p.desc}</div>
                        <div className={`pimp ${neg ? 'neg' : 'pos'}`}>{impact}</div>
                      </div>
                    );
                  })
              }
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Box Score + Scoring Plays */}
      <div className="detail-grid-2">
        <BoxScoreCard boxscore={g.boxscore} away={away} home={home} awayScore={g.awayScore} homeScore={g.homeScore} />
        <ScoringPlaysCard plays={g.scoringPlays || []} away={away} home={home} />
      </div>
    </div>
  );
}

function StrikeZone({ pitches }) {
  // x in [-2, 2] feet, y in [0, 5] feet
  const W = 180, H = 220;
  const xToPx = (x) => ((x + 2) / 4) * W;
  const yToPx = (y) => H - (y / 5) * H;

  return (
    <div className="zone">
      <div className="box">
        <div className="vline" style={{ left: '33.33%' }} />
        <div className="vline" style={{ left: '66.66%' }} />
        <div className="hline" style={{ top: '33.33%' }} />
        <div className="hline" style={{ top: '66.66%' }} />
      </div>
      <div className="plate" />
      {(pitches || []).map((p, i) => {
        const isStrike = /strike|foul|swinging/i.test(p.result || '');
        const isCurrent = i === pitches.length - 1;
        const left = xToPx(typeof p.x === 'number' ? p.x : 0);
        const top = yToPx(typeof p.y === 'number' ? p.y : 2.5);
        return (
          <div
            key={i}
            className={`pitch ${isStrike ? 'strike' : 'ball'} ${isCurrent ? 'current' : ''}`}
            style={{ left, top }}
            title={`${p.type || ''} ${p.speed || ''} mph \u00B7 ${p.result || ''}`}
          >
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}

function LineScore({ line, away, home, curInning, curHalf, awayScore, homeScore }) {
  const awayArr = line[away.abbr] || line[away?.abbr] || [];
  const homeArr = line[home.abbr] || line[home?.abbr] || [];
  const maxInn = Math.max(awayArr.length, homeArr.length, 9);
  const innings = Array.from({ length: maxInn }, (_, i) => i + 1);

  const cellAway = (i) => {
    const v = awayArr[i - 1];
    if (v === undefined || v === null) {
      if (i === curInning && curHalf === 'top') return '\u00B7';
      return '';
    }
    return v;
  };
  const cellHome = (i) => {
    const v = homeArr[i - 1];
    if (v === undefined || v === null) {
      if (i === curInning && curHalf === 'bottom') return '\u00B7';
      return '';
    }
    return v;
  };

  return (
    <table className="linescore">
      <thead>
        <tr>
          <th></th>
          {innings.map((i) => <th key={i}>{i}</th>)}
          <th style={{ borderLeft: '1px solid var(--rule-strong)', paddingLeft: 10 }}>R</th>
          <th>H</th>
          <th>E</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="team" style={{ color: away.primary, fontWeight: 800 }}>{away.abbr}</td>
          {innings.map((i) => {
            const isCur = i === curInning && curHalf === 'top';
            return (
              <td key={i}>
                <span className={isCur ? 'cur' : ''} style={isCur ? { padding: '1px 5px' } : {}}>
                  {cellAway(i)}
                </span>
              </td>
            );
          })}
          <td className="total" style={{ borderLeft: '1px solid var(--rule-strong)' }}>{awayScore}</td>
          <td className="total">{line.hitsA ?? 0}</td>
          <td className="total">{line.errA ?? 0}</td>
        </tr>
        <tr>
          <td className="team" style={{ color: home.primary, fontWeight: 800 }}>{home.abbr}</td>
          {innings.map((i) => {
            const isCur = i === curInning && curHalf === 'bottom';
            return (
              <td key={i}>
                <span className={isCur ? 'cur' : ''} style={isCur ? { padding: '1px 5px' } : {}}>
                  {cellHome(i)}
                </span>
              </td>
            );
          })}
          <td className="total" style={{ borderLeft: '1px solid var(--rule-strong)' }}>{homeScore}</td>
          <td className="total">{line.hitsH ?? 0}</td>
          <td className="total">{line.errH ?? 0}</td>
        </tr>
      </tbody>
    </table>
  );
}

/* ======================================================
 * Win Probability chart + header
 * ==================================================== */
function WPHeader({ wpSeries, fallbackWp, away, home }) {
  const hasSeries = Array.isArray(wpSeries) && wpSeries.length > 0;
  const homeWp = hasSeries ? wpSeries[wpSeries.length - 1].wp : fallbackWp;
  const leadingIsHome = homeWp >= 0.5;
  const team = leadingIsHome ? home : away;
  const pct = Math.round((leadingIsHome ? homeWp : 1 - homeWp) * 100);

  return (
    <div className="wp-header">
      <div className="wp-leader" style={{ color: team.primary }}>
        <span className="wp-abbr">{team.abbr}</span>
        <span className="wp-pct">{pct}<span className="wp-pct-unit">%</span></span>
      </div>
      <div className="wp-legend">
        <span><i style={{ background: away.primary }} />{away.abbr}</span>
        <span><i style={{ background: home.primary }} />{home.abbr}</span>
      </div>
    </div>
  );
}

function WPChart({ wpSeries, away, home }) {
  const n = wpSeries?.length || 0;
  if (n < 2) {
    return (
      <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 10,
        textTransform: 'uppercase', letterSpacing: '0.14em' }}>
        No data yet
      </div>
    );
  }

  const W = 400, H = 160;
  const pad = { top: 8, right: 10, bottom: 22, left: 32 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const xScale = (i) => pad.left + (i / Math.max(n - 1, 1)) * innerW;
  const yScale = (v) => pad.top + (1 - v) * innerH;

  // Build line path
  const linePath = wpSeries.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(p.wp).toFixed(1)}`).join(' ');

  // Home-fill area: clamp wp >= 0.5, fill between line and baseline (top-half)
  const homeArea =
    `M ${xScale(0).toFixed(1)} ${yScale(0.5).toFixed(1)} ` +
    wpSeries.map((p, i) => `L ${xScale(i).toFixed(1)} ${yScale(Math.max(p.wp, 0.5)).toFixed(1)}`).join(' ') +
    ` L ${xScale(n - 1).toFixed(1)} ${yScale(0.5).toFixed(1)} Z`;

  // Away-fill area: clamp wp <= 0.5, fill between line and baseline (bottom-half)
  const awayArea =
    `M ${xScale(0).toFixed(1)} ${yScale(0.5).toFixed(1)} ` +
    wpSeries.map((p, i) => `L ${xScale(i).toFixed(1)} ${yScale(Math.min(p.wp, 0.5)).toFixed(1)}`).join(' ') +
    ` L ${xScale(n - 1).toFixed(1)} ${yScale(0.5).toFixed(1)} Z`;

  // Inning tick positions: find first index where inning changes
  const ticks = [];
  let lastInning = 0;
  for (let i = 0; i < n; i++) {
    const inn = wpSeries[i].inning;
    if (inn && inn !== lastInning) {
      ticks.push({ inn, x: xScale(i) });
      lastInning = inn;
    }
  }

  // Current point
  const lastIdx = n - 1;
  const cx = xScale(lastIdx);
  const cy = yScale(wpSeries[lastIdx].wp);
  const currentIsHome = wpSeries[lastIdx].wp >= 0.5;
  const currentColor = currentIsHome ? home.primary : away.primary;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 6 }}>
      {/* Horizontal 50% reference line */}
      <line
        x1={pad.left} x2={W - pad.right}
        y1={yScale(0.5)} y2={yScale(0.5)}
        stroke="var(--rule-strong)" strokeDasharray="3,3" strokeWidth="1"
      />
      {/* Top/bottom border lines */}
      <line x1={pad.left} x2={W - pad.right} y1={yScale(1)} y2={yScale(1)} stroke="var(--rule)" strokeWidth="1" />
      <line x1={pad.left} x2={W - pad.right} y1={yScale(0)} y2={yScale(0)} stroke="var(--rule)" strokeWidth="1" />

      {/* Inning vertical ticks */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={t.x} x2={t.x} y1={pad.top} y2={H - pad.bottom} stroke="var(--rule)" strokeWidth="0.5" strokeDasharray="1,3" />
          <text x={t.x} y={H - 8} textAnchor="middle" fill="var(--ink-3)"
            style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em' }}>
            {t.inn}
          </text>
        </g>
      ))}

      {/* Y-axis labels */}
      <text x={pad.left - 6} y={yScale(1) + 3} textAnchor="end" fill="var(--ink-3)"
        style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>{home.abbr}</text>
      <text x={pad.left - 6} y={yScale(0.5) + 3} textAnchor="end" fill="var(--ink-3)"
        style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>50</text>
      <text x={pad.left - 6} y={yScale(0) + 3} textAnchor="end" fill="var(--ink-3)"
        style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>{away.abbr}</text>

      {/* Filled areas */}
      <path d={homeArea} fill={home.primary} opacity="0.22" />
      <path d={awayArea} fill={away.primary} opacity="0.22" />

      {/* Main line */}
      <path d={linePath} fill="none" stroke="var(--ink-2)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Current point */}
      <circle cx={cx} cy={cy} r="4" fill={currentColor} stroke="var(--card)" strokeWidth="2" />
    </svg>
  );
}

/* ======================================================
 * Scoring Plays
 * ==================================================== */
function ScoringPlaysCard({ plays, away, home }) {
  return (
    <div className="dcard">
      <h3>Scoring Plays</h3>
      <div className="scoring-plays">
        {plays.length === 0
          ? <div style={{ color: 'var(--ink-3)', fontSize: 11, padding: '6px 0' }}>No scoring plays yet</div>
          : plays.map((p, i) => (
              <div key={i} className="splay">
                <div className="sp-inn">{p.inning}</div>
                <div className="sp-desc">{p.desc}</div>
                <div className="sp-score">
                  <span style={{ color: away.primary, fontWeight: 700 }}>{p.awayScore}</span>
                  <span className="sp-sep">-</span>
                  <span style={{ color: home.primary, fontWeight: 700 }}>{p.homeScore}</span>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}

/* ======================================================
 * Box Score (with team tabs)
 * ==================================================== */
function BoxScoreCard({ boxscore, away, home, awayScore, homeScore }) {
  const [activeTeam, setActiveTeam] = React.useState('away');
  if (!boxscore) return null;

  const teamData = activeTeam === 'away' ? boxscore.away : boxscore.home;
  const activeMeta = activeTeam === 'away' ? away : home;
  const activeScore = activeTeam === 'away' ? awayScore : homeScore;

  const starters = teamData.batters.filter(b => b.starter);
  const subs = teamData.batters.filter(b => !b.starter);

  // Totals
  const totals = teamData.batters.reduce((t, b) => ({
    ab: t.ab + (b.ab || 0), r: t.r + (b.r || 0), h: t.h + (b.h || 0),
    rbi: t.rbi + (b.rbi || 0), bb: t.bb + (b.bb || 0), so: t.so + (b.so || 0),
  }), { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 });

  const pitchTotals = teamData.pitchers.reduce((t, p) => ({
    h: t.h + (p.h || 0), r: t.r + (p.r || 0), er: t.er + (p.er || 0),
    bb: t.bb + (p.bb || 0), so: t.so + (p.so || 0),
  }), { h: 0, r: 0, er: 0, bb: 0, so: 0 });

  return (
    <div className="dcard boxscore-card">
      <div className="bs-head">
        <h3>Box Score</h3>
        <div className="bs-tabs">
          <button
            className={activeTeam === 'away' ? 'active' : ''}
            onClick={() => setActiveTeam('away')}
            style={{ '--team-primary': away.primary, '--team-secondary': away.secondary }}
          >{away.abbr} <span>{awayScore}</span></button>
          <button
            className={activeTeam === 'home' ? 'active' : ''}
            onClick={() => setActiveTeam('home')}
            style={{ '--team-primary': home.primary, '--team-secondary': home.secondary }}
          >{home.abbr} <span>{homeScore}</span></button>
        </div>
      </div>

      <div className="bs-section-label">Batters</div>
      <table className="bs-table">
        <thead>
          <tr>
            <th className="bs-pos">POS</th>
            <th className="bs-name">Player</th>
            <th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>SO</th><th>BA</th>
          </tr>
        </thead>
        <tbody>
          {starters.map((b, i) => (
            <tr key={i}>
              <td className="bs-pos">{b.pos}</td>
              <td className="bs-name">{b.name}</td>
              <td>{b.ab}</td><td>{b.r}</td><td>{b.h}</td><td>{b.rbi}</td><td>{b.bb}</td><td>{b.so}</td>
              <td>{b.ba}</td>
            </tr>
          ))}
          {subs.length > 0 && subs.map((b, i) => (
            <tr key={`sub-${i}`} className="bs-sub">
              <td className="bs-pos">{b.pos}</td>
              <td className="bs-name">&nbsp;&nbsp;{b.name}</td>
              <td>{b.ab}</td><td>{b.r}</td><td>{b.h}</td><td>{b.rbi}</td><td>{b.bb}</td><td>{b.so}</td>
              <td>{b.ba}</td>
            </tr>
          ))}
          <tr className="bs-totals">
            <td colSpan={2}>TOTALS</td>
            <td>{totals.ab}</td><td>{totals.r}</td><td>{totals.h}</td><td>{totals.rbi}</td>
            <td>{totals.bb}</td><td>{totals.so}</td><td></td>
          </tr>
        </tbody>
      </table>

      <div className="bs-section-label">Pitchers</div>
      <table className="bs-table pitchers">
        <thead>
          <tr>
            <th className="bs-name">Player</th>
            <th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>SO</th><th>P-S</th><th>ERA</th>
          </tr>
        </thead>
        <tbody>
          {teamData.pitchers.map((p, i) => (
            <tr key={i}>
              <td className="bs-name">{p.name}</td>
              <td>{p.ip}</td><td>{p.h}</td><td>{p.r}</td><td>{p.er}</td>
              <td>{p.bb}</td><td>{p.so}</td><td>{p.ps}</td><td>{p.era}</td>
            </tr>
          ))}
          {teamData.pitchers.length === 0 && (
            <tr><td colSpan={9} style={{ color: 'var(--ink-3)', fontSize: 10, padding: '6px 0' }}>No pitching data</td></tr>
          )}
          {teamData.pitchers.length > 0 && (
            <tr className="bs-totals">
              <td>TOTALS</td>
              <td></td>
              <td>{pitchTotals.h}</td><td>{pitchTotals.r}</td><td>{pitchTotals.er}</td>
              <td>{pitchTotals.bb}</td><td>{pitchTotals.so}</td>
              <td></td><td></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
