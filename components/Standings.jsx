window.Standings = function Standings({ teams, standings, dense, myTeam }) {
  const myTeamAbbr = myTeam || "HOU";
  const myTeamObj = teams?.[myTeamAbbr];
  const myLeague = myTeamObj?.league;
  const myDiv = myTeamObj?.div;
  return (
    <div className={`standings-wrap ${dense ? "dense" : ""}`}>
      {["AL", "NL"].map(lg => (
        <div key={lg} className="standings-league">
          <h3>{lg === "AL" ? "American League" : "National League"}</h3>
          {["East", "Central", "West"].map(div => {
            const rows = (standings?.[lg]?.[div]) || [];
            const focus = lg === myLeague && div === myDiv;
            return (
              <div key={div} className={`standings-div ${focus ? "focus" : ""}`}>
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
                    {rows.map(r => {
                      const t = teams[r.team] || { abbr: r.team, name: r.team, primary: "#333", secondary: "#888" };
                      const isMine = r.team === myTeamAbbr;
                      const gamesPlayed = (r.w || 0) + (r.l || 0);
                      const pct = gamesPlayed > 0 ? (r.w / gamesPlayed).toFixed(3).replace(/^0/, "") : ".000";
                      return (
                        <tr key={r.team} className={isMine ? "focus-row" : ""}
                            style={{ "--team-primary": t.primary, "--team-secondary": t.secondary }}>
                          <td className="team">
                            <div className="cbar" />
                            <span className="tname">{t.abbr} <span style={{ color: "var(--ink-3)", fontWeight: 400, fontSize: "0.85em" }}>{t.name}</span></span>
                          </td>
                          <td>{r.w}</td>
                          <td>{r.l}</td>
                          <td>{pct}</td>
                          <td>{r.gb}</td>
                          <td>{r.l10}</td>
                          <td className={String(r.strk || "").startsWith("W") ? "streak-w" : "streak-l"}>{r.strk}</td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr><td colSpan={7} style={{ color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 10, padding: "10px", textAlign: "center" }}>No data</td></tr>
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

// Compute playoff picture: top division winner + 2 other div winners + 3 wild cards per league.
function computePlayoff(teams, standings, league) {
  const divs = ["East", "Central", "West"];
  const rowsIn = (d) => (standings?.[league]?.[d]) || [];
  const winDiff = (r) => (r.w || 0) - (r.l || 0);

  const divWinners = divs
    .map(d => {
      const sorted = [...rowsIn(d)].sort((a, b) => winDiff(b) - winDiff(a));
      return sorted[0] ? { ...sorted[0], div: d } : null;
    })
    .filter(Boolean)
    .sort((a, b) => winDiff(b) - winDiff(a));

  const winnersSet = new Set(divWinners.map(w => w.team));
  const nonWinners = [];
  divs.forEach(d => {
    rowsIn(d).forEach(r => {
      if (!winnersSet.has(r.team)) nonWinners.push({ ...r, div: d });
    });
  });
  const wc = nonWinners.sort((a, b) => winDiff(b) - winDiff(a));
  const wildCards = wc.slice(0, 3);
  const bubble = wc.slice(3, 5);
  const out = wc.slice(5);

  return { divWinners, wildCards, bubble, out };
}

function magicNumber(team, behindTeam, gamesRemaining = 143) {
  const diff = (team.w - team.l) - (behindTeam.w - behindTeam.l);
  return Math.max(1, Math.ceil((gamesRemaining + 1 - diff) / 2) - 130);
}

window.PlayoffPicture = function PlayoffPicture({ teams, standings, myTeam }) {
  const myTeamAbbr = myTeam || "HOU";
  return (
    <div className="playoff">
      {["AL", "NL"].map(lg => {
        const { divWinners, wildCards, bubble, out } = computePlayoff(teams, standings, lg);
        const leader = divWinners[0];
        if (!leader) {
          return (
            <div key={lg} className="playoff-league">
              <h3>{lg === "AL" ? "American League" : "National League"}</h3>
              <div style={{ color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 11, padding: 10 }}>No standings data</div>
            </div>
          );
        }

        const seeds = [
          ...divWinners.map((w, i) => ({ ...w, seed: i + 1, tag: `${w.div} LEADER`, kind: "div-winner" })),
          ...wildCards.map((w, i) => ({ ...w, seed: 4 + i, tag: "WILD CARD", kind: "wildcard" })),
        ];

        return (
          <div key={lg} className="playoff-league">
            <h3>{lg === "AL" ? "American League" : "National League"}</h3>
            {seeds.map(s => {
              const t = teams[s.team] || { abbr: s.team, name: s.team, primary: "#333", secondary: "#888" };
              const isMine = s.team === myTeamAbbr;
              const diff = (leader.w - leader.l) - (s.w - s.l);
              const mn = s.seed === 1 ? "-" : `#${Math.max(1, 15 - Math.floor(diff/2))}`;
              return (
                <div key={s.team} className={`seed-row ${s.kind}`}
                     style={{ "--team-primary": t.primary, "--team-secondary": t.secondary }}>
                  <div className="snum">{s.seed}</div>
                  <div className="sbar" />
                  <div className="sname" style={isMine ? { color: t.primary, fontWeight: 800 } : {}}>
                    {t.abbr} {t.name}
                    <span className="stag">{s.tag}</span>
                  </div>
                  <div className="srec">{s.w}-{s.l}</div>
                  <div className="smn">{s.seed === 1 ? "CLINCH" : mn}</div>
                </div>
              );
            })}

            {bubble.length > 0 && <>
              <div className="seed-divider">On the Bubble</div>
              {bubble.map(s => {
                const t = teams[s.team] || { abbr: s.team, name: s.team, primary: "#333", secondary: "#888" };
                const isMine = s.team === myTeamAbbr;
                const gb = wildCards[2] ? ((wildCards[2].w - wildCards[2].l) - (s.w - s.l)) / 2 : 0;
                return (
                  <div key={s.team} className="seed-row bubble"
                       style={{ "--team-primary": t.primary, "--team-secondary": t.secondary }}>
                    <div className="snum">-</div>
                    <div className="sbar" />
                    <div className="sname" style={isMine ? { color: t.primary, fontWeight: 800 } : {}}>
                      {t.abbr} {t.name}<span className="stag">{s.div}</span>
                    </div>
                    <div className="srec">{s.w}-{s.l}</div>
                    <div className="smn">{gb > 0 ? `${gb} GB` : "TIED"}</div>
                  </div>
                );
              })}
            </>}

            {out.length > 0 && <>
              <div className="seed-divider">Out</div>
              {out.map(s => {
                const t = teams[s.team] || { abbr: s.team, name: s.team, primary: "#333", secondary: "#888" };
                const gb = wildCards[2] ? ((wildCards[2].w - wildCards[2].l) - (s.w - s.l)) / 2 : 0;
                return (
                  <div key={s.team} className="seed-row eliminated"
                       style={{ "--team-primary": t.primary, "--team-secondary": t.secondary }}>
                    <div className="snum">-</div>
                    <div className="sbar" />
                    <div className="sname">{t.abbr} {t.name}<span className="stag">{s.div}</span></div>
                    <div className="srec">{s.w}-{s.l}</div>
                    <div className="smn">{gb > 0 ? `${gb} GB` : "TIED"}</div>
                  </div>
                );
              })}
            </>}
          </div>
        );
      })}
    </div>
  );
};
