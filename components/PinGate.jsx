window.PinGate = function PinGate({ onUnlock, myTeam, onPickTeam, teams }) {
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const submit = React.useCallback(async (val) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: val }),
      });
      const data = await r.json();
      if (data.ok) {
        setError(false);
        setTimeout(() => onUnlock(data.token, Boolean(data.admin)), 200);
      } else {
        setError(true);
        setTimeout(() => { setPin(""); setError(false); }, 700);
      }
    } catch (e) {
      setError(true);
      setTimeout(() => { setPin(""); setError(false); }, 700);
    } finally {
      setBusy(false);
    }
  }, [busy, onUnlock]);

  const append = (d) => {
    if (error || busy) return;
    setPin(prev => {
      const next = (prev + d).slice(0, 4);
      if (next.length === 4) setTimeout(() => submit(next), 0);
      return next;
    });
  };
  const del = () => { if (!error && !busy) setPin(prev => prev.slice(0, -1)); };

  React.useEffect(() => {
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) append(e.key);
      else if (e.key === "Backspace") del();
      else if (e.key === "Enter" && pin.length === 4) submit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pin, error, busy, submit]);

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase();

  // Team-stylized ticket CSS variables
  const t = myTeam || { abbr: "MLB", city: "League", name: "Baseball", primary: "#111", secondary: "#ccc" };
  const ticketStyle = {
    "--tkt-primary": t.primary,
    "--tkt-secondary": t.secondary,
    "--tkt-ink": "#fff",
  };

  return (
    <div className="gate" style={{ "--gate-bg": `color-mix(in oklab, ${t.primary} 8%, var(--bg))` }}>
      <div className="ticket teamified" style={ticketStyle}>
        <div className="ticket-stub">
          <div className="stub-top">
            <div className="tbrand">Dug<span className="amp">&middot;</span>out</div>
            <div className="tmeta" style={{ marginTop: 6 }}>Season Pass</div>
          </div>
          <div className="stub-middle">
            <div className="stub-badge" aria-hidden>
              <div className="stub-badge-abbr">{t.abbr}</div>
              <div className="stub-badge-stripe" />
            </div>
            <div className="stub-team-name">{t.name}</div>
            <div className="stub-team-city">{t.city}</div>
          </div>
          <div className="stub-bottom">
            <div className="tmeta">{dateStr}</div>
            <div className="tseat">GATE <b>{t.abbr.slice(0,1)}</b></div>
          </div>
        </div>

        <div className="ticket-main">
          <div className="tprompt">{t.city} {t.name} &middot; Member Gate</div>
          <div className="ttitle">Enter Your PIN</div>
          <div className="pin-row">
            {[0,1,2,3].map(i => (
              <div key={i} className={`pin-dot ${error ? "error" : ""} ${pin.length === i ? "active" : ""} ${pin.length > i ? "filled" : ""}`}>
                {pin[i] && !error ? "\u25CF" : ""}
              </div>
            ))}
          </div>
          <div className="keypad">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => append(String(n))}>{n}</button>
            ))}
            <button className="del" onClick={del}>DEL</button>
            <button onClick={() => append("0")}>0</button>
            <button className="del" onClick={() => pin.length === 4 && submit(pin)}>ENTER</button>
          </div>
          <div className="ticket-hint">
            {error ? <span className="err">Wrong PIN, try again</span>
              : busy ? <>Checking&hellip;</>
              : <>Tap, type, or paste</>}
          </div>

          {teams && onPickTeam && (
            <>
              <div className="ticket-teamrow">
                <span className="ticket-teamlabel">Your Team</span>
                <button className="ticket-teamswap" onClick={() => setPickerOpen(!pickerOpen)}>
                  {t.city} {t.name} <span className="swap-chev">{pickerOpen ? "\u25B2" : "\u25BC"}</span>
                </button>
              </div>
              {pickerOpen && (
                <div className="ticket-picker">
                  {Object.values(teams).map(tm => (
                    <button key={tm.abbr}
                      className={`ticket-picker-item ${tm.abbr === t.abbr ? "active" : ""}`}
                      onClick={() => { onPickTeam(tm.abbr); setPickerOpen(false); }}
                      style={{ "--tp-primary": tm.primary, "--tp-secondary": tm.secondary }}>
                      <span className="tpi-swatch" style={{ background: tm.primary, boxShadow: `inset 0 0 0 2px ${tm.primary}, 0 0 0 1px ${tm.secondary}, 0 0 0 2px ${tm.primary}` }}>{tm.abbr}</span>
                      <span>{tm.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
