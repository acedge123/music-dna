import { createServerFn } from "@tanstack/react-start";
import { supabase as publicSupabase } from "@/integrations/supabase/client";

export type OnboardingOpener = {
  variant_key: string;
  eyebrow: string;
  headline: string;
  sub: string | null;
  slot_labels: [string, string, string];
  cta: string;
};

const FALLBACK: OnboardingOpener = {
  variant_key: "fallback",
  eyebrow: "three songs · ranked",
  headline: "Name three songs you love.\nRank them.",
  sub: "The order matters. Your #1 says more than you think.",
  slot_labels: ["The one you'd save first", "The one right after", "And one more"],
  cta: "See what I think →",
};

// Public-readable: anyone (signed in or out) can fetch a random active opener.
// Weighted random pick is done in JS to keep the SQL simple.
export const getOnboardingOpener = createServerFn({ method: "GET" }).handler(
  async (): Promise<OnboardingOpener> => {
    const { data, error } = await publicSupabase
      .from("onboarding_openers")
      .select("variant_key,eyebrow,headline,sub,slot_labels,cta,weight")
      .eq("is_active", true);
    if (error || !data || data.length === 0) return FALLBACK;

    const total = data.reduce((s, r) => s + Math.max(1, (r as { weight: number }).weight), 0);
    let pick = Math.random() * total;
    for (const r of data) {
      pick -= Math.max(1, (r as { weight: number }).weight);
      if (pick <= 0) {
        const slots = (r as { slot_labels: unknown }).slot_labels as string[];
        if (!Array.isArray(slots) || slots.length < 3) return FALLBACK;
        return {
          variant_key: (r as { variant_key: string }).variant_key,
          eyebrow: (r as { eyebrow: string }).eyebrow,
          headline: (r as { headline: string }).headline,
          sub: (r as { sub: string | null }).sub,
          slot_labels: [slots[0], slots[1], slots[2]] as [string, string, string],
          cta: (r as { cta: string }).cta,
        };
      }
    }
    return FALLBACK;
  },
);
