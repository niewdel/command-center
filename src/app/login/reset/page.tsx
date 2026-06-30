"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Montserrat, Inter } from "next/font/google";
import { supabase } from "@/lib/supabase";
import { AuthStyles } from "@/components/auth/auth-styles";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-montserrat" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-inter" });

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login/update`,
    });
    // Always show the same message — never reveal whether the account exists.
    setSent(true);
    setLoading(false);
  }

  return (
    <div className={`${montserrat.variable} ${inter.variable} au-root`}>
      <div className="au-card">
        <Image src="/logos/niewdel-wordmark.png" alt="Niewdel" width={880} height={186} className="au-mark" priority />
        <p className="au-eyebrow">Reset password</p>
        <h1 className="au-title">Forgot it<span className="au-dot" aria-hidden>?</span></h1>
        <span className="au-rule" aria-hidden />

        {sent ? (
          <>
            <p className="au-sub">If an account exists for that email, a reset link is on its way. Check your inbox.</p>
            <Link href="/login" className="au-back">&larr; Back to sign in</Link>
          </>
        ) : (
          <>
            <p className="au-sub">Enter your email and we&rsquo;ll send a secure link to set a new password.</p>
            <form onSubmit={handleSubmit} className="au-form" noValidate>
              <div className="au-field">
                <label htmlFor="email" className="au-label">Email</label>
                <input id="email" type="email" autoComplete="username" autoFocus
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@niewdel.com" className="au-input" />
              </div>
              <button type="submit" disabled={!email.trim() || loading} className="au-cta">
                {loading ? "Sending" : "Send reset link"}<span aria-hidden>{loading ? "" : " →"}</span>
              </button>
            </form>
            <Link href="/login" className="au-back">&larr; Back to sign in</Link>
          </>
        )}
      </div>
      <AuthStyles />
    </div>
  );
}
