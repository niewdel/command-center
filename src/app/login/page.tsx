"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("Wrong PIN");
      setPin("");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[340px] space-y-7 p-8 rounded-lg border border-border bg-card shadow-sm">
        <div className="space-y-3">
          <span className="mono-tag">Command Center · v2</span>
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-bold text-foreground text-balance tracking-tight font-heading">
              Welcome back, Justin.
            </h1>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-pretty">
            Enter your PIN to unlock.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            autoFocus
            type="password"
            inputMode="numeric"
            maxLength={10}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError("");
            }}
            placeholder="••••"
            className="bg-background border-border rounded h-12 text-center text-lg tracking-[0.4em] font-mono focus-visible:border-primary focus-visible:ring-primary/30"
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <Button
            type="submit"
            disabled={!pin.trim() || loading}
            className="w-full bg-primary hover:bg-[var(--rust-hot)] text-primary-foreground border-0 rounded h-11 font-medium"
          >
            {loading ? "Checking" : "Enter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
