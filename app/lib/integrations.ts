// app/lib/integrations.ts
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export type Provider = "google" | "zoom";

export type IntegrationRow = {
  id: string;
  employee_id: string;
  provider: Provider;

  provider_user_id: string | null;
  email: string | null;

  google_access_token: string | null;
  google_refresh_token: string | null;
  google_expiry: string | null;
  google_email: string | null;
  google_provider_user_id: string | null;

  zoom_access_token: string | null;
  zoom_refresh_token: string | null;
  zoom_expiry: string | null;
  zoom_user_id: string | null;
  zoom_email: string | null;

  scopes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

// ✅ provider を必須にする（ここが今回のポイント）
export type IntegrationUpsert =
  { provider: Provider } &
  Partial<Omit<IntegrationRow, "id" | "employee_id" | "provider">>;

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

export async function upsertIntegration(employeeId: string, patch: IntegrationUpsert) {
  // ✅ provider を一度取り出して、...patch で provider が上書きされないようにする
  const { provider, ...rest } = patch;

  const row = {
    employee_id: employeeId,
    provider,
    ...rest,
    updated_at: rest.updated_at ?? new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("employee_integrations")
    .upsert(row, { onConflict: "employee_id,provider" })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as IntegrationRow | null;
}
