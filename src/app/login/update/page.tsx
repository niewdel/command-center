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

  // The recovery link lands here with the session in the URL hash
  // (#access_token=...&refresh_token=...) or, if the link was bad, an error
  // (#error_code=...). Apply the tokens explicitly rather than relying on the
  // client's auto-detect, which is flow/timing dependent.
  useEffect(() => {
    async function init() {
      const raw = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : "";
      const params = new URLSearchParams(raw);

      if (params.get("error_code") || params.get("error")) {
        setStatus("invalid");
        return;
      }

      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        const { error: sessErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        // Clear the tokens out of the address bar.
        window.history.replaceState(null, "", window.location.pathname);
        if (!sessErr) { setStatus("ready"); return; }
      }

      // Auto-detect may have already consumed the hash — check for a session.
      const { data } = await supabase.auth.getSession();
      setStatus(data.session ? "ready" : "invalid");
    }
    init();
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
