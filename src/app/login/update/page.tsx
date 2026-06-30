"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Montserrat, Inter } from "next/font/google";
import { supabase } from "@/lib/supabase";
import { AuthStyles } from "@/components/auth/auth-styles";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-montserrat" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-inter" });

const MIN_LEN = 10;
const LANDING = "/seo";

type Status = "checking" | "ready" | "invalid";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The recovery link drops a session into the URL hash; the browser client
  // parses it on load (detectSessionInUrl) and fires PASSWORD_RECOVERY. Accept
  // either that event or an already-present session as proof the link is valid.
  useEffect(() => {
    let settled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        settled = true;
        setStatus("ready");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { settled = true; setStatus("ready"); }
    });
    const t = setTimeout(() => { if (!settled) setStatus("invalid"); }, 2500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN_LEN) { setError(`Use at least ${MIN_LEN} characters.`); return; }
    if (password !== confirm) { setError("Those passwords don't match."); return; }
    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      setError(updErr.message || "Couldn't update the password. Request a fresh link.");
      setLoading(false);
      return;
    }
    router.push(LANDING);
    router.refresh();
  }

  return (
    <div className={`${montserrat.variable} ${inter.variable} au-root`}>
      <div className="au-card">
        <Image src="/logos/niewdel-wordmark.png" alt="Niewdel" width={880} height={186} className="au-mark" priority />
        <p className="au-eyebrow">Set password</p>
        <h1 className="au-title">New password<span className="au-dot" aria-hidden>.</span></h1>
        <span className="au-rule" aria-hidden />

        {status === "invalid" ? (
          <>
            <p className="au-sub">This link is invalid or has expired. Request a fresh one.</p>
            <Link href="/login/reset" className="au-back">&larr; Request a new link</Link>
          </>
        ) : status === "checking" ? (
          <p className="au-sub">Verifying your link...</p>
        ) : (
          <>
            <p className="au-sub">Choose a strong password. At least {MIN_LEN} characters.</p>
            <form onSubmit={handleSubmit} className="au-form" noValidate>
              <div className="au-field">
                <label htmlFor="password" className="au-label">New password</label>
                <input id="password" type="password" autoComplete="new-password" autoFocus
                  value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••••" className="au-input" aria-invalid={!!error} />
              </div>
              <div className="au-field">
                <label htmlFor="confirm" className="au-label">Confirm password</label>
                <input id="confirm" type="password" autoComplete="new-password"
                  value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  placeholder="••••••••••" className="au-input" aria-invalid={!!error} />
              </div>
              {error && <p className="au-error" role="alert">{error}</p>}
              <button type="submit" disabled={!password || !confirm || loading} className="au-cta">
                {loading ? "Saving" : "Save password"}<span aria-hidden>{loading ? "" : " →"}</span>
              </button>
            </form>
          </>
        )}
      </div>
      <AuthStyles />
    </div>
  );
}
