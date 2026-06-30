"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Montserrat, Inter } from "next/font/google";
import { supabase } from "@/lib/supabase";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-montserrat",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
});

// Where to land after a successful sign in. SEO tool for now; the rest of the
// workspace comes later.
const LANDING = "/seo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      // Deliberately generic — never reveal whether it was the email or the
      // password, and never reveal that an account exists.
      setError("That email or password didn't match.");
      setPassword("");
      setLoading(false);
      return;
    }

    router.push(LANDING);
    router.refresh();
  }

  return (
    <div className={`${montserrat.variable} ${inter.variable} lg-root`}>
      {/* ── Brand panel: the "n" arch as a lit portal ── */}
      <aside className="lg-brand" aria-hidden>
        <div className="lg-wash" />
        <Image
          src="/logos/niewdel-icon.png"
          alt=""
          width={1100}
          height={1100}
          className="lg-portal"
          priority
        />
        <Image
          src="/logos/niewdel-wordmark.png"
          alt="Niewdel"
          width={880}
          height={186}
          className="lg-brand-mark"
          priority
        />
        <div className="lg-brand-foot">
          <p className="lg-eyebrow">The studio</p>
          <p className="lg-brand-line">
            We build what you can&rsquo;t imagine yet.
          </p>
          <p className="lg-brand-meta">Charlotte, NC</p>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="lg-panel">
        <div className="lg-form-stage">
          <Image
            src="/logos/niewdel-wordmark.png"
            alt="Niewdel"
            width={880}
            height={186}
            className="lg-form-mark"
            priority
          />

          <p className="lg-eyebrow">Secure access</p>
          <h1 className="lg-title">
            Welcome back<span className="lg-dot" aria-hidden>.</span>
          </h1>
          <p className="lg-sub">Sign in to your Niewdel workspace.</p>

          <span className="lg-rule" aria-hidden />

          <form onSubmit={handleSubmit} className="lg-form" noValidate>
            <div className="lg-field">
              <label htmlFor="email" className="lg-label">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@niewdel.com"
                className="lg-input"
                aria-invalid={!!error}
              />
            </div>

            <div className="lg-field">
              <div className="lg-label-row">
                <label htmlFor="password" className="lg-label">Password</label>
                <button
                  type="button"
                  className="lg-forgot"
                  onClick={() => router.push("/login/reset")}
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••••"
                className="lg-input"
                aria-invalid={!!error}
              />
            </div>

            {error && <p className="lg-error" role="alert">{error}</p>}

            <button
              type="submit"
              disabled={!email.trim() || !password || loading}
              className="lg-cta"
            >
              {loading ? "Signing in" : "Sign in"}
              <span aria-hidden>{loading ? "" : " →"}</span>
            </button>
          </form>

          <p className="lg-foot">
            <span className="lg-lock" aria-hidden />
            Private workspace. Encrypted and yours.
          </p>
        </div>
      </main>

      <style>{`
        .lg-root {
          --jet: #0D0D0D;
          --onyx: #1A1A1A;
          --elevated: #141719;
          --blue: #3B86DB;
          --navy: #1B4D8F;
          --cloud: #F5F5F5;
          --muted: #9AA3A8;
          --faint: #5C666D;
          --hairline: #262B2E;
          position: fixed;
          inset: 0;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          background: var(--jet);
          color: var(--cloud);
          font-family: var(--font-inter), system-ui, sans-serif;
        }

        /* ── Brand panel ── */
        .lg-brand {
          position: relative;
          overflow: hidden;
          border-right: 1px solid var(--hairline);
          padding: clamp(32px, 4vw, 56px);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .lg-wash {
          position: absolute;
          top: -30%;
          right: -25%;
          width: 80%;
          height: 80%;
          background: radial-gradient(circle at center,
            rgba(59,134,219,0.20), rgba(27,77,143,0.06) 45%, transparent 70%);
          pointer-events: none;
        }
        .lg-portal {
          position: absolute;
          left: -16%;
          bottom: -22%;
          width: clamp(520px, 46vw, 760px);
          height: auto;
          opacity: 0.05;
          pointer-events: none;
          user-select: none;
        }
        .lg-brand-mark {
          position: relative;
          width: 150px;
          height: auto;
        }
        .lg-brand-foot { position: relative; max-width: 30ch; }
        .lg-brand-line {
          margin: 12px 0 0;
          font-family: var(--font-montserrat), system-ui, sans-serif;
          font-weight: 700;
          font-size: clamp(1.5rem, 2.6vw, 2rem);
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--cloud);
          text-wrap: balance;
        }
        .lg-brand-meta {
          margin: 16px 0 0;
          font-size: 12px;
          color: var(--faint);
        }

        /* ── Shared brand bits ── */
        .lg-eyebrow {
          margin: 0;
          font-family: var(--font-montserrat), system-ui, sans-serif;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--blue);
        }

        /* ── Form panel ── */
        .lg-panel {
          background: var(--onyx);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(28px, 5vw, 56px);
        }
        .lg-form-stage { width: 100%; max-width: 364px; }
        .lg-form-mark { display: none; width: 132px; height: auto; margin-bottom: 36px; }

        .lg-title {
          margin: 14px 0 0;
          font-family: var(--font-montserrat), system-ui, sans-serif;
          font-weight: 800;
          font-size: clamp(2rem, 4vw, 2.5rem);
          letter-spacing: -0.02em;
          line-height: 1.1;
        }
        .lg-dot { color: var(--blue); }
        .lg-sub { margin: 10px 0 0; font-size: 15px; color: var(--muted); }
        .lg-rule {
          display: block;
          width: 44px;
          height: 3px;
          margin: 26px 0 0;
          border-radius: 2px;
          background: linear-gradient(135deg, var(--blue), var(--navy));
        }

        .lg-form { margin-top: 26px; display: flex; flex-direction: column; gap: 18px; }
        .lg-field { display: flex; flex-direction: column; gap: 8px; }
        .lg-label-row { display: flex; align-items: baseline; justify-content: space-between; }
        .lg-label {
          font-family: var(--font-montserrat), system-ui, sans-serif;
          font-weight: 600;
          font-size: 13px;
          color: var(--cloud);
        }
        .lg-forgot {
          background: none;
          border: 0;
          padding: 0;
          font-size: 12px;
          color: var(--muted);
          cursor: pointer;
          transition: color 150ms ease;
        }
        .lg-forgot:hover { color: var(--blue); }
        .lg-input {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border-radius: 9px;
          background: var(--elevated);
          border: 1px solid var(--hairline);
          color: var(--cloud);
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 15px;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .lg-input::placeholder { color: var(--faint); }
        .lg-input:focus {
          outline: none;
          border-color: var(--blue);
          box-shadow: 0 0 0 3px rgba(59,134,219,0.18);
        }
        .lg-input[aria-invalid="true"] { border-color: #C0413A; }

        .lg-error { margin: -2px 0 0; font-size: 13px; color: #E06A63; }

        .lg-cta {
          margin-top: 4px;
          height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          border: 0;
          border-radius: 40px;
          background: var(--blue);
          color: #fff;
          font-family: var(--font-montserrat), system-ui, sans-serif;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: background-color 150ms ease;
        }
        .lg-cta:hover:not(:disabled) { background: var(--navy); }
        .lg-cta:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
        .lg-cta:disabled { opacity: 0.5; cursor: not-allowed; }

        .lg-foot {
          margin: 28px 0 0;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--faint);
        }
        .lg-lock {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--blue);
          flex: none;
        }

        /* ── Mobile ── */
        @media (max-width: 880px) {
          .lg-root { grid-template-columns: 1fr; }
          .lg-brand { display: none; }
          .lg-panel { background: var(--jet); align-items: flex-start; padding-top: 14vh; }
          .lg-form-mark { display: block; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lg-input, .lg-cta, .lg-forgot { transition: none; }
        }
      `}</style>
    </div>
  );
}
