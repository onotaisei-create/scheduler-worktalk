// app/lib/integrations.ts
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * DBテーブル: public.employee_integrations
 * 想定カラム例:
 *  - employee_id (text)
 *  - provider (text)  // "google" | "zoom"
 *  - google_access_token, google_refresh_token, google_expiry, google_email, google_provider_user_id ...
 *  - zoom_access_token, zoom_refresh_token, zoom_expiry, zoom_email, zoom_user_id ...
 *
 * UNIQUE(employee_id, provider)
 */

export type IntegrationRow = {
  id?: string;
  employee_id: string;
  provider: string;

  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_expiry?: string | null;
  google_email?: string | null;
  google_provider_user_id?: string | null;

  zoom_access_token?: string | null;
  zoom_refresh_token?: string | null;
  zoom_expiry?: string | null;
  zoom_email?: string | null;
  zoom_user_id?: string | null;

  scopes?: string | null;

  created_at?: string;
  updated_at?: string;
};

type IntegrationMerged = {
  employee_id: string;

  google_access_token: string | null;
  google_refresh_token: string | null;
  google_expiry: string | null;
  google_email: string | null;
  google_provider_user_id: string | null;

  zoom_access_token: string | null;
  zoom_refresh_token: string | null;
  zoom_expiry: string | null;
  zoom_email: string | null;
  zoom_user_id: string | null;

  scopes: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function isGooglePatch(patch: Partial<IntegrationRow>) {
  return Object.keys(patch).some((k) => k.startsWith("google_"));
}
function isZoomPatch(patch: Partial<IntegrationRow>) {
  return Object.keys(patch).some((k) => k.startsWith("zoom_"));
}

/**
 * 既存の呼び出し側(tokenRefreshなど)が
 * getIntegration(employeeId) で「google/zoom両方の値」を期待している前提で
 * providerごとの2行を取り、1つに合体して返す。
 */
export async function getIntegration(employeeId: string): Promise<IntegrationMerged | null> {
  const { data, error } = await supabaseAdmin
    .from("employee_integrations")
    .select("*")
    .eq("employee_id", employeeId);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const google = data.find((r: IntegrationRow) => r.provider === "google") as IntegrationRow | undefined;
  const zoom = data.find((r: IntegrationRow) => r.provider === "zoom") as IntegrationRow | undefined;

  return {
    employee_id: employeeId,

    google_access_token: google?.google_access_token ?? null,
    google_refresh_token: google?.google_refresh_token ?? null,
    google_expiry: google?.google_expiry ?? null,
    google_email: google?.google_email ?? null,
    google_provider_user_id: google?.google_provider_user_id ?? null,

    zoom_access_token: zoom?.zoom_access_token ?? null,
    zoom_refresh_token: zoom?.zoom_refresh_token ?? null,
    zoom_expiry: zoom?.zoom_expiry ?? null,
    zoom_email: zoom?.zoom_email ?? null,
    zoom_user_id: zoom?.zoom_user_id ?? null,

    // scopesはgoogle側に寄せる（必要ならprovider別に分けてOK）
    scopes: google?.scopes ?? null,
  };
}

/**
 * tokenRefresh.ts から呼ばれる想定:
 *   upsertIntegration(employeeId, { google_access_token, google_expiry })
 *   upsertIntegration(employeeId, { zoom_access_token, zoom_refresh_token, zoom_expiry })
 *
 * ここで provider を自動判定して、(employee_id, provider) で upsert する。
 * → これで duplicate key 500 は消える。
 */
export async function upsertIntegration(employeeId: string, patch: Partial<IntegrationRow>) {
  const wantsGoogle = isGooglePatch(patch);
  const wantsZoom = isZoomPatch(patch);

  if (!wantsGoogle && !wantsZoom) {
    // どっちでもない更新は事故りやすいので明示的に落とす
    throw new Error("upsertIntegration: patch must include google_* or zoom_* fields");
  }

  // google更新
  if (wantsGoogle) {
    const row: Partial<IntegrationRow> = {
      employee_id: employeeId,
      provider: "google",
      ...patch,
      updated_at: nowIso(),
    };

    // created_at はDB defaultがあるなら不要。無い場合は付けてもOK
    const { error } = await supabaseAdmin
      .from("employee_integrations")
      .upsert(row, { onConflict: "employee_id,provider" });

    if (error) throw error;
  }

  // zoom更新
  if (wantsZoom) {
    const row: Partial<IntegrationRow> = {
      employee_id: employeeId,
      provider: "zoom",
      ...patch,
      updated_at: nowIso(),
    };

    const { error } = await supabaseAdmin
      .from("employee_integrations")
      .upsert(row, { onConflict: "employee_id,provider" });

    if (error) throw error;
  }
}
