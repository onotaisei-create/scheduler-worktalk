// app/lib/integrations.ts
import { supabaseAdmin } from "./supabaseAdmin";

export type Provider = "google" | "zoom";

export type IntegrationRow = {
  id: string;
  employee_id: string;
  provider: Provider;

  provider_user_id: string | null;
  email: string | null;

  google_access_token: string | null;
  google_refresh_token: string | null;
  google_expiry: string | null; // ←あなたのテーブルは google_expiry（timestamptz）想定
  google_email: string | null;
  google_provider_user_id: string | null;

  zoom_access_token: string | null;
  zoom_refresh_token: string | null;
  zoom_expiry_ts: string | null; // ←テーブルにあるのは zoom_expiry_ts
  zoom_user_id: string | null;
  zoom_email: string | null;

  scopes: string | null;

  created_at: string;
  updated_at: string;
};

export type IntegrationUpsert = Partial<Omit<IntegrationRow, "id" | "employee_id" | "provider" | "created_at">>;

export async function getIntegration(employeeId: string, provider: Provider) {
  const { data, error } = await supabaseAdmin
    .from("employee_integrations")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw error;
  return data as IntegrationRow | null;
}

export async function upsertIntegration(employeeId: string, provider: Provider, patch: IntegrationUpsert) {
  const row = {
    employee_id: employeeId,
    provider,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("employee_integrations")
    .upsert(row, { onConflict: "employee_id,provider" })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as IntegrationRow | null;
}
