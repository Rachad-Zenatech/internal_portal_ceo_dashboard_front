export interface ComplianceBrand {
  code: string;
  name: string;
}

export interface ApprovedContentItem {
  id: string;
  reference_code: string;
  title: string;
  content_type: string;
  brand_code?: string | null;
  brand_codes: string[];
  brand_name: string;
  brand_names: string[];
  platforms: string[];
  status: string;
  caption_text: string;
  audience?: string | null;
  audiences: string[];
  region?: string | null;
  publish_at?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by_name: string;
  created_by_email?: string | null;
  latest_score?: number | null;
  latest_traffic_light?: string | null;
  file_count: number;
  comment_count: number;
}

export interface ApprovedContentPayload {
  items: ApprovedContentItem[];
  brands: ComplianceBrand[];
  total: number;
}

export interface ApprovedContentResponse {
  status: "connected" | "stale" | "disconnected" | "timeout";
  data: ApprovedContentPayload;
  last_updated?: string | null;
  error?: string | null;
}

export type PublicMoodScrapeScope = "all" | "financial" | "today";
export type PublishingRecommendation = "POST" | "WAIT" | "HOLD";

export interface PublicMoodListeningPost {
  network: string;
  author: string;
  text: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  confidence?: number | null;
  engagements: number;
  posted_on?: string | null;
  url?: string | null;
}

export interface PublicMoodTrend {
  topic_id?: string | null;
  external_id: string;
  name: string;
  description?: string | null;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
  net_sentiment: number;
  volume: number;
  volume_change_pct?: number | null;
  is_spike: boolean;
  recommendation: PublishingRecommendation;
  recommendation_reason: string;
  can_jump_on_trend: boolean;
  trend_angle: string;
  top_posts: PublicMoodListeningPost[];
  scrape_track?: string | null;
  post_id?: string | null;
  post_title?: string | null;
  today_reason?: string | null;
  publish_at?: string | null;
}

export interface PublicMoodTodayPost {
  id: string;
  title: string;
  status: string;
  publish_at?: string | null;
  today_reason: string;
  has_searches: boolean;
}

export interface PublicMoodTrack {
  key: "financial_zenatech" | "today_posts";
  title: string;
  subtitle: string;
  status: string;
  collected_at?: string | null;
  empty_reason?: string | null;
  posts: PublicMoodTodayPost[];
  trends: PublicMoodTrend[];
}

export interface PublicMoodOverview {
  financial_zenatech: PublicMoodTrack;
  today_posts: PublicMoodTrack;
  scrape_state: string;
  schedule_enabled?: boolean;
  schedule_label?: string | null;
  next_scrape_at?: string | null;
}

export interface PublicMoodApiResponse {
  status: "connected" | "stale" | "disconnected" | "timeout";
  data: PublicMoodOverview;
  last_updated?: string | null;
  error?: string | null;
}
