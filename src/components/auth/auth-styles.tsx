// Shared brand styling for the compact auth cards (reset + update password).
// The main /login page carries its own (two-panel) styles.
export function AuthStyles() {
  return (
    <style>{`
      .au-root {
        --jet:#0D0D0D; --onyx:#1A1A1A; --elevated:#141719; --blue:#3B86DB; --navy:#1B4D8F;
        --cloud:#F5F5F5; --muted:#9AA3A8; --faint:#5C666D; --hairline:#262B2E;
        position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
        background:var(--jet); color:var(--cloud);
        font-family:var(--font-inter),system-ui,sans-serif; padding:clamp(24px,5vw,48px);
      }
      .au-card { width:100%; max-width:380px; }
      .au-mark { width:140px; height:auto; margin-bottom:34px; }
      .au-eyebrow { margin:0; font-family:var(--font-montserrat),system-ui,sans-serif; font-weight:700;
        font-size:12px; letter-spacing:0.2em; text-transform:uppercase; color:var(--blue); }
      .au-title { margin:14px 0 0; font-family:var(--font-montserrat),system-ui,sans-serif; font-weight:800;
        font-size:clamp(1.9rem,4vw,2.3rem); letter-spacing:-0.02em; line-height:1.1; }
      .au-dot { color:var(--blue); }
      .au-rule { display:block; width:44px; height:3px; margin:22px 0 0; border-radius:2px;
        background:linear-gradient(135deg,var(--blue),var(--navy)); }
      .au-sub { margin:22px 0 0; font-size:15px; line-height:1.5; color:var(--muted); }
      .au-form { margin-top:24px; display:flex; flex-direction:column; gap:18px; }
      .au-field { display:flex; flex-direction:column; gap:8px; }
      .au-label { font-family:var(--font-montserrat),system-ui,sans-serif; font-weight:600; font-size:13px; color:var(--cloud); }
      .au-input { width:100%; height:48px; padding:0 14px; border-radius:9px; background:var(--elevated);
        border:1px solid var(--hairline); color:var(--cloud); font-family:var(--font-inter),system-ui,sans-serif;
        font-size:15px; transition:border-color 150ms ease, box-shadow 150ms ease; }
      .au-input::placeholder { color:var(--faint); }
      .au-input:focus { outline:none; border-color:var(--blue); box-shadow:0 0 0 3px rgba(59,134,219,0.18); }
      .au-input[aria-invalid="true"] { border-color:#C0413A; }
      .au-error { margin:-2px 0 0; font-size:13px; color:#E06A63; }
      .au-ok { margin:-2px 0 0; font-size:13px; color:#5BB98B; }
      .au-cta { margin-top:4px; height:50px; display:inline-flex; align-items:center; justify-content:center;
        border:0; border-radius:40px; background:var(--blue); color:#fff;
        font-family:var(--font-montserrat),system-ui,sans-serif; font-weight:700; font-size:15px; cursor:pointer;
        transition:background-color 150ms ease; }
      .au-cta:hover:not(:disabled) { background:var(--navy); }
      .au-cta:focus-visible { outline:2px solid var(--blue); outline-offset:3px; }
      .au-cta:disabled { opacity:0.5; cursor:not-allowed; }
      .au-back { display:inline-block; margin-top:24px; font-size:13px; color:var(--muted); text-decoration:none;
        transition:color 150ms ease; }
      .au-back:hover { color:var(--blue); }
      @media (prefers-reduced-motion: reduce) { .au-input,.au-cta,.au-back { transition:none; } }
    `}</style>
  );
}
