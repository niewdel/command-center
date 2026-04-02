"use client";

import { useState } from "react";
import { supabase, getUserId } from "@/lib/supabase";
import { Workspace } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Sunrise,
  Moon,
  Clock,
  Star,
  Target,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";

type WelcomeFlowProps = {
  workspaces: Workspace[];
  onComplete: () => void;
};

const STEPS = [
  {
    title: "Welcome to Command Center",
    subtitle: "Your daily rhythm starts here.",
    icon: Sparkles,
    color: "bg-foreground",
  },
  {
    title: "How It Works",
    subtitle: "Three rituals to take back your day.",
    icon: Sunrise,
    color: "bg-foreground",
  },
  {
    title: "Set Your Capacity",
    subtitle: "How many productive hours do you have?",
    icon: Clock,
    color: "bg-foreground",
  },
];

export function WelcomeFlow({ workspaces, onComplete }: WelcomeFlowProps) {
  const [step, setStep] = useState(0);
  const [weekdayHours, setWeekdayHours] = useState(8);
  const [weekendHours, setWeekendHours] = useState(4);
  const [shutdownTime, setShutdownTime] = useState("17:00");
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    const userId = await getUserId();
    if (userId) {
      await supabase.from("user_settings").upsert(
        {
          user_id: userId,
          available_hours_weekday: weekdayHours,
          available_hours_weekend: weekendHours,
          shutdown_time: shutdownTime,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }
    setSaving(false);
    onComplete();
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-6">
            <div className="inline-flex size-16 items-center justify-center rounded-lg border-2 border-primary/50" style={{ boxShadow: '0 0 20px -4px var(--hud-glow)' }}>
              <Sparkles className="size-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-balance">
                Welcome to Command Center
              </h1>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto text-pretty">
                One calm, intentional view of your entire life. Work and personal, unified.
              </p>
            </div>
            <Button
              onClick={() => setStep(1)}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded"
            >
              Get Started
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        {/* Step 1: How it works */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-balance">Your Daily Rhythm</h2>
              <p className="text-sm text-muted-foreground text-pretty">
                Three intentional moments that change everything.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: Sunrise,
                  title: "Morning Planning",
                  desc: "Review overdue, pick your top 3, estimate time, check capacity. Know exactly what your day looks like before it starts.",
                  color: "border-amber-500/40",
                  iconColor: "text-amber-400",
                },
                {
                  icon: Star,
                  title: "Focused Execution",
                  desc: "Your Today view shows only what matters. Focus tasks highlighted, capacity bar keeps you honest.",
                  color: "border-primary/40",
                  iconColor: "text-primary",
                },
                {
                  icon: Moon,
                  title: "Evening Shutdown",
                  desc: "Celebrate wins, process what didn't get done, capture loose ends. Create a clean break between work and life.",
                  color: "border-violet-500/40",
                  iconColor: "text-violet-400",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded border border-border/50 bg-card/50 p-4 hud-glow-hover"
                >
                  <div
                    className={cn("size-10 rounded flex items-center justify-center border shrink-0", item.color)}
                  >
                    <item.icon className={cn("size-5", item.iconColor)} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 text-pretty">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button
              onClick={() => setStep(2)}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded"
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Set capacity */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-balance">Set Your Capacity</h2>
              <p className="text-sm text-muted-foreground text-pretty">
                This helps us warn you before you overcommit.
              </p>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase">
                    Weekday Hours
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={16}
                    step={0.5}
                    value={weekdayHours}
                    onChange={(e) => setWeekdayHours(parseFloat(e.target.value) || 8)}
                    className="bg-background/50 border-border/50 rounded-lg text-center text-lg font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase">
                    Weekend Hours
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={16}
                    step={0.5}
                    value={weekendHours}
                    onChange={(e) => setWeekendHours(parseFloat(e.target.value) || 4)}
                    className="bg-background/50 border-border/50 rounded-lg text-center text-lg font-semibold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">
                  When does your day end?
                </label>
                <Input
                  type="time"
                  value={shutdownTime}
                  onChange={(e) => setShutdownTime(e.target.value)}
                  className="w-[180px] bg-background/50 border-border/50 rounded-lg"
                />
              </div>
            </div>
            <Button
              onClick={handleFinish}
              disabled={saving}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded"
            >
              {saving ? (
                "Setting up..."
              ) : (
                <>
                  <Check className="size-4" />
                  Start Using Command Center
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step dots */}
        <div className="flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-colors",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
