"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
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
    color: "from-indigo-500 to-purple-600",
  },
  {
    title: "How It Works",
    subtitle: "Three rituals to take back your day.",
    icon: Sunrise,
    color: "from-indigo-500 to-purple-600",
  },
  {
    title: "Set Your Capacity",
    subtitle: "How many productive hours do you have?",
    icon: Clock,
    color: "from-emerald-500 to-teal-600",
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
    const { data: user } = await supabase.auth.getUser();
    if (user?.user) {
      await supabase.from("user_settings").upsert(
        {
          user_id: user.user.id,
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Welcome to Command Center
              </h1>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                One calm, intentional view of your entire life. Work and personal, unified.
              </p>
            </div>
            <Button
              onClick={() => setStep(1)}
              className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 rounded-xl shadow-lg shadow-indigo-500/25"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 1: How it works */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Your Daily Rhythm</h2>
              <p className="text-sm text-muted-foreground">
                Three intentional moments that change everything.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: Sunrise,
                  color: "from-indigo-500 to-purple-600",
                  title: "Morning Planning",
                  desc: "Review overdue, pick your top 3, estimate time, check capacity. Know exactly what your day looks like before it starts.",
                },
                {
                  icon: Star,
                  color: "from-amber-500 to-orange-600",
                  title: "Focused Execution",
                  desc: "Your Today view shows only what matters. Focus tasks highlighted, capacity bar keeps you honest.",
                },
                {
                  icon: Moon,
                  color: "from-violet-500 to-indigo-700",
                  title: "Evening Shutdown",
                  desc: "Celebrate wins, process what didn't get done, capture loose ends. Create a clean break between work and life.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-xl border border-border/50 bg-card/50 p-4"
                >
                  <div
                    className={`h-10 w-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg shrink-0`}
                  >
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button
              onClick={() => setStep(2)}
              className="w-full gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 rounded-xl shadow-lg shadow-indigo-500/25"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Set capacity */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Set Your Capacity</h2>
              <p className="text-sm text-muted-foreground">
                This helps us warn you before you overcommit.
              </p>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
              className="w-full gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 rounded-xl shadow-lg shadow-indigo-500/25"
            >
              {saving ? (
                "Setting up..."
              ) : (
                <>
                  <Check className="h-4 w-4" />
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
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-indigo-500" : "w-1.5 bg-muted"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
