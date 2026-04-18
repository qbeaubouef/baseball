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
    const half = g.half === 'top' ? 'TOP' : 'BOT';
    // Between innings when outs>=3 can show "MID"/"END"
    if (g.outs >= 3) {
      return `${g.half === 'top' ? 'MID' : 'END'} ${ordinal(g.inning)}`;
    }
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

  return (
    <div className="detail">
      <div className="detail-grid">
        <div className="dcard matchup-card">
          <h3>{isLive ? 'At Bat' : 'Matchup'}</h3>
          {isLive && pitcher.name && batter.name ? (
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
              {g.state === 'final' ? 'Game completed' : g.state === 'pre' ? 'Game has not started' : 'Between innings'}
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
            <div className="wp-wrap">
              <div className="wp-label">
                <span style={{ color: away.primary, fontWeight: 700 }}>{away.abbr}</span>
                <span style={{ color: home.primary, fontWeight: 700 }}>{home.abbr}</span>
              </div>
              <div className="wp-bar">
                <div className="away-bar" style={{ width: `${awayWP}%` }} />
                <div className="home-bar" style={{ width: `${homeWP}%` }} />
                <div className="tick" style={{ left: '50%' }} />
              </div>
              <div className="wp-vals">
                <span style={{ color: away.primary }}>{awayWP}%</span>
                <span style={{ color: home.primary }}>{homeWP}%</span>
              </div>
            </div>
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
