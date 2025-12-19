// app/lib/tokenRefresh.ts
import { getIntegration, upsertIntegration } from "./integrations";

function isExpired(iso: string | null) {
  if (!iso) return true;
  return Date.now() >= new Date(iso).getTime() - 60_000; // 1分前倒しで更新
}

export async function getGoogleAccessToken(employeeId: string) {
  const integ = await getIntegration(employeeId);
  if (!integ?.google_refresh_token) throw new Error("Google not connected for this employee");

  if (integ.google_access_token && !isExpired(integ.google_expiry)) {
    return integ.google_access_token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: integ.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));

  const access = json.access_token as string;
  const exp = new Date(Date.now() + (json.expires_in as number) * 1000).toISOString();

  await upsertIntegration(employeeId, { google_access_token: access, google_expiry: exp });
  return access;
}

export async function getZoomAccessToken(employeeId: string) {
  const integ = await getIntegration(employeeId);
  if (!integ?.zoom_refresh_token) throw new Error("Zoom not connected for this employee");

  if (integ.zoom_access_token && !isExpired(integ.zoom_expiry)) {
    return integ.zoom_access_token;
  }

  const clientId = process.env.ZOOM_CLIENT_ID!;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: integ.zoom_refresh_token,
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));

  const access = json.access_token as string;
  const refresh = (json.refresh_token as string) || integ.zoom_refresh_token;
  const exp = new Date(Date.now() + (json.expires_in as number) * 1000).toISOString();

  await upsertIntegration(employeeId, {
    zoom_access_token: access,
    zoom_refresh_token: refresh,
    zoom_expiry: exp,
  });

  return access;
}
