// app/lib/integrations.ts
import { supabaseAdmin } from "./supabaseAdmin";

export type EmployeeIntegration = {
  employee_id: string;

  google_email: string | null;
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_expiry: string | null;

  zoom_email: string | null;
  zoom_user_id: string | null;
  zoom_refresh_token: string | null;
  zoom_access_token: string | null;
  zoom_expiry: string | null;
};

export async function getIntegration(employeeId: string): Promise<EmployeeIntegration | null> {
  const { data, error } = await supabaseAdmin
    .from("employee_integrations")
    .select("*")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (error) throw error;
  return (data as EmployeeIntegration) ?? null;
}

export async function upsertIntegration(employeeId: string, patch: Partial<EmployeeIntegration>) {
  const { error } = await supabaseAdmin.from("employee_integrations").upsert({
    employee_id: employeeId,
    ...patch,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}
