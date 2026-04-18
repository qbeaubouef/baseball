/* Standings + Playoff Picture - computes seeds/bubble/out from live standings. */

window.Standings = function Standings({ teams, standings, dense }) {
  return (
    <div className={`standings-wrap ${dense ? 'dense' : ''}`}>
      {['AL', 'NL'].map((lg) => (
        <div key={lg} className="standings-league">
          <h3>{lg === 'AL' ? 'American League' : 'National League'}</h3>
          {['East', 'Central', 'West'].map((div) => {
            const rows = (standings?.[lg]?.[div]) || [];
            const focus = lg === 'AL' && div === 'West';   // Astros' division
            return (
              <div key={div} className={`standings-div ${focus ? 'focus' : ''}`}>
                <h4>{lg} {div}</h4>
                <table className="stable">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>W</th>
                      <th>L</th>
                      <th>PCT</th>
                      <th>GB</th>
                      <th>L10</th>
                      <th>STRK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const t = teams[r.team] || { abbr: r.team, name: r.team, primary: '#333', secondary: '#888' };
                      const isAstros = r.team === 'HOU';
                      const gamesPlayed = (r.w || 0) + (r.l || 0);
                      const pct = gamesPlayed > 0
                        ? (r.w / gamesPlayed).toFixed(3).replace(/^0/, '')
                        : '.000';
                      return (
                        <tr
                          key={r.team}
                          className={isAstros ? 'focus-row' : ''}
                          style={{ '--team-primary': t.primary, '--team-secondary': t.secondary }}
                        >
                          <td className="team">
                            <div className="cbar" />
                            <span className="tname">
                              {t.abbr}{' '}
                              <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: '0.85em' }}>{t.name}</span>
                            </span>
                          </td>
                          <td>{r.w}</td>
                          <td>{r.l}</td>
                          <td>{pct}</td>
                          <td>{r.gb}</td>
                          <td>{r.l10}</td>
                          <td className={String(r.strk || '').startsWith('W') ? 'streak-w' : 'streak-l'}>{r.strk}</td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 10, padding: '10px', textAlign: 'center' }}>
                          No data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------
 * Playoff picture: 3 div winners + 3 wild cards per league.
 * Seeds by win differential. Bubble = next 2, Out = remainder.
 * ---------------------------------------------------------- */
function computePlayoff(teams, standings, league) {
  const divs = ['East', 'Central', 'West'];
  const safeRows = (d) => (standings?.[league]?.[d]) || [];
  const winDiff = (r) => (r.w || 0) - (r.l || 0);

  const divWinners = divs
    .map((d) => {
      const sorted = [...safeRows(d)].sort((a, b) => winDiff(b) - winDiff(a));
      return sorted[0] ? { ...sorted[0], div: d } : null;
    })
    .filter(Boolean)
    .sort((a, b) => winDiff(b) - winDiff(a));

  const winnersSet = new Set(divWinners.map((w) => w.team));
  const nonWinners = [];
  divs.forEach((d) => {
    safeRows(d).forEach((r) => {
      if (!winnersSet.has(r.team)) nonWinners.push({ ...r, div: d });
    });
  });

  const wc = nonWinners.sort((a, b) => winDiff(b) - winDiff(a));
  const wildCards = wc.slice(0, 3);
  const bubble = wc.slice(3, 5);
  const out = wc.slice(5);

  return { divWinners, wildCards, bubble, out };
}

window.PlayoffPicture = function PlayoffPicture({ teams, standings }) {
  return (
    <div className="playoff">
      {['AL', 'NL'].map((lg) => {
        const { divWinners, wildCards, bubble, out } = computePlayoff(teams, standings, lg);
        const leader = divWinners[0];
        if (!leader) {
          return (
            <div key={lg} className="playoff-league">
              <h3>{lg === 'AL' ? 'American League' : 'National League'}</h3>
              <div style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11, padding: 10 }}>
                No standings data
              </div>
            </div>
          );
        }

        const seeds = [
          ...divWinners.map((w, i) => ({ ...w, seed: i + 1, tag: `${w.div} LEADER`, kind: 'div-winner' })),
          ...wildCards.map((w, i) => ({ ...w, seed: 4 + i, tag: 'WILD CARD', kind: 'wildcard' })),
        ];

        const last3WC = wildCards[2];   // #6 seed, the cutoff for bubble/out GB math

        return (
          <div key={lg} className="playoff-league">
            <h3>{lg === 'AL' ? 'American League' : 'National League'}</h3>
            {seeds.map((s) => {
              const t = teams[s.team] || { abbr: s.team, name: s.team, primary: '#333', secondary: '#888' };
              const isAstros = s.team === 'HOU';
              const diff = ((leader.w || 0) - (leader.l || 0)) - ((s.w || 0) - (s.l || 0));
              const mn = s.seed === 1 ? '\u2014' : `#${Math.max(1, 15 - Math.floor(diff / 2))}`;
              return (
                <div
                  key={s.team}
                  className={`seed-row ${s.kind}`}
                  style={{ '--team-primary': t.primary, '--team-secondary': t.secondary }}
                >
                  <div className="snum">{s.seed}</div>
                  <div className="sbar" />
                  <div className="sname" style={isAstros ? { color: t.primary, fontWeight: 800 } : {}}>
                    {t.abbr} {t.name}
                    <span className="stag">{s.tag}</span>
                  </div>
                  <div className="srec">{s.w}-{s.l}</div>
                  <div className="smn">{s.seed === 1 ? 'CLINCH' : mn}</div>
                </div>
              );
            })}

            {bubble.length > 0 && (
              <>
                <div className="seed-divider">On the Bubble</div>
                {bubble.map((s) => {
                  const t = teams[s.team] || { abbr: s.team, name: s.team, primary: '#333', secondary: '#888' };
                  const isAstros = s.team === 'HOU';
                  const gb = last3WC ? (((last3WC.w || 0) - (last3WC.l || 0)) - ((s.w || 0) - (s.l || 0))) / 2 : 0;
                  return (
                    <div
                      key={s.team}
                      className="seed-row bubble"
                      style={{ '--team-primary': t.primary, '--team-secondary': t.secondary }}
                    >
                      <div className="snum">&mdash;</div>
                      <div className="sbar" />
                      <div className="sname" style={isAstros ? { color: t.primary, fontWeight: 800 } : {}}>
                        {t.abbr} {t.name}<span className="stag">{s.div}</span>
                      </div>
                      <div className="srec">{s.w}-{s.l}</div>
                      <div className="smn">{gb > 0 ? `${gb} GB` : 'TIED'}</div>
                    </div>
                  );
                })}
              </>
            )}

            {out.length > 0 && (
              <>
                <div className="seed-divider">Out</div>
                {out.map((s) => {
                  const t = teams[s.team] || { abbr: s.team, name: s.team, primary: '#333', secondary: '#888' };
                  const gb = last3WC ? (((last3WC.w || 0) - (last3WC.l || 0)) - ((s.w || 0) - (s.l || 0))) / 2 : 0;
                  return (
                    <div
                      key={s.team}
                      className="seed-row eliminated"
                      style={{ '--team-primary': t.primary, '--team-secondary': t.secondary }}
                    >
                      <div className="snum">&mdash;</div>
                      <div className="sbar" />
                      <div className="sname">{t.abbr} {t.name}<span className="stag">{s.div}</span></div>
                      <div className="srec">{s.w}-{s.l}</div>
                      <div className="smn">{gb > 0 ? `${gb} GB` : 'TIED'}</div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
