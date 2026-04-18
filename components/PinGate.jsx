/* PinGate - authenticates against /api/auth. Keeps Design's ticket visual. */
window.PinGate = function PinGate({ onUnlock }) {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

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
        setTimeout(() => { setPin(''); setError(false); }, 700);
      }
    } catch (e) {
      setError(true);
      setTimeout(() => { setPin(''); setError(false); }, 700);
    } finally {
      setBusy(false);
    }
  }, [busy, onUnlock]);

  const append = (d) => {
    if (error || busy) return;
    setPin((prev) => {
      const next = (prev + d).slice(0, 4);
      if (next.length === 4) setTimeout(() => submit(next), 0);
      return next;
    });
  };
  const del = () => { if (!error && !busy) setPin((prev) => prev.slice(0, -1)); };

  React.useEffect(() => {
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) append(e.key);
      else if (e.key === 'Backspace') del();
      else if (e.key === 'Enter' && pin.length === 4) submit(pin);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pin, error, busy, submit]);

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  }).toUpperCase();

  return (
    <div className="gate">
      <div className="ticket">
        <div className="ticket-stub">
          <div>
            <div className="tbrand">Dug<span className="amp">&middot;</span>out</div>
            <div className="tmeta" style={{ marginTop: 6 }}>Admit One</div>
          </div>
          <div className="tseat">
            GATE<b>A</b>
          </div>
          <div className="tmeta" style={{ writingMode: 'horizontal-tb' }}>{dateStr}</div>
        </div>
        <div className="ticket-main">
          <div className="tprompt">Members Entrance</div>
          <div className="ttitle">Enter Your PIN</div>
          <div className="pin-row">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`pin-dot ${error ? 'error' : ''} ${pin.length === i ? 'active' : ''} ${pin.length > i ? 'filled' : ''}`}
              >
                {pin[i] && !error ? '\u25CF' : ''}
              </div>
            ))}
          </div>
          <div className="keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button key={n} onClick={() => append(String(n))}>{n}</button>
            ))}
            <button className="del" onClick={del}>DEL</button>
            <button onClick={() => append('0')}>0</button>
            <button className="del" onClick={() => pin.length === 4 && submit(pin)}>ENTER</button>
          </div>
          <div className="ticket-hint">
            {error
              ? <span className="err">Wrong PIN, try again</span>
              : busy
                ? <>Checking...</>
                : <>Tap, type, or paste</>
            }
          </div>
        </div>
      </div>
    </div>
  );
};
