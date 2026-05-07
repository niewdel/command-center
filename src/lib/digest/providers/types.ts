export type TrendCandidate = {
  url: string;
  source: "youtube" | "tiktok" | "instagram";
  title: string | null;
  thumbnail_url: string | null;
  views: number | null;
  posted_at: string | null;
  creator_handle: string | null;
};

export type ProviderResult = {
  source: "youtube" | "tiktok" | "instagram";
  candidates: TrendCandidate[];
  errors: string[];
};
