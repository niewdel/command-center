"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M1 1h10.5v10.5H1z" fill="#F25022" />
      <path d="M12.5 1H23v10.5H12.5z" fill="#7FBA00" />
      <path d="M1 12.5h10.5V23H1z" fill="#00A4EF" />
      <path d="M12.5 12.5H23V23H12.5z" fill="#FFB900" />
    </svg>
  );
}

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLogin = mode === "login";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }

    router.push("/dashboard");
    router.refresh();
  };

  const handleOAuth = async (provider: "google" | "azure") => {
    setOauthLoading(provider);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex size-12 items-center justify-center rounded-lg bg-foreground shadow-sm">
            <span className="text-background font-bold text-lg">CC</span>
          </div>
          <h1 className="font-heading text-xl font-semibold text-balance">
            Command Center
          </h1>
          <p className="font-heading text-sm text-muted-foreground text-pretty">
            {isLogin ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuth("google")}
            disabled={!!oauthLoading}
            className="w-full h-11 gap-3 rounded-lg border-border/50 bg-card/50 hover:bg-accent/50 font-medium"
          >
            <GoogleIcon className="size-5" />
            {oauthLoading === "google"
              ? "Redirecting..."
              : `Continue with Google`}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuth("azure")}
            disabled={!!oauthLoading}
            className="w-full h-11 gap-3 rounded-lg border-border/50 bg-card/50 hover:bg-accent/50 font-medium"
          >
            <MicrosoftIcon className="size-4" />
            {oauthLoading === "azure"
              ? "Redirecting..."
              : `Continue with Microsoft`}
          </Button>
        </div>

        {/* Divider */}
        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
            or
          </span>
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isLogin ? "Your password" : "Create a password"}
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={6}
              className="h-11"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-pretty">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-foreground hover:bg-foreground/90 text-background shadow-sm border-0 font-heading font-medium"
          >
            {loading
              ? isLogin
                ? "Signing in..."
                : "Creating account..."
              : isLogin
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        {/* Toggle login/signup */}
        <p className="text-center text-sm text-muted-foreground text-pretty">
          {isLogin ? (
            <>
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-foreground hover:text-foreground/80 font-medium underline underline-offset-4 transition-colors"
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-foreground hover:text-foreground/80 font-medium underline underline-offset-4 transition-colors"
              >
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
