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
      <div className="w-full max-w-[320px] space-y-6 p-6 rounded border border-border hud-glow">
        <div className="text-center space-y-2">
          <div className="inline-flex size-12 items-center justify-center rounded border-2 border-primary/50" style={{ boxShadow: '0 0 16px -4px var(--hud-glow)' }}>
            <span className="text-primary font-bold text-lg font-mono">CC</span>
          </div>
          <h1 className="text-xl font-bold text-foreground font-mono text-balance">
            Command Center
          </h1>
          <p className="text-sm text-muted-foreground text-pretty font-mono">
            Enter your PIN to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="PIN"
            className="bg-card border-border rounded h-12 text-center text-lg tracking-widest font-mono focus-visible:border-primary focus-visible:ring-primary/30"
          />
          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
          <Button
            type="submit"
            disabled={!pin.trim() || loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded h-11 font-medium"
          >
            {loading ? "Checking..." : "Enter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
