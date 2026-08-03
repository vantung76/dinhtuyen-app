type AuthLinkProperties = {
  hashed_token?: string;
  verification_type?: string;
};

const DEFAULT_PUBLIC_SITE_URL = "https://app.dinhtuyen.com";

export function getPublicSiteUrl(): string {
  return (process.env["PUBLIC_SITE_URL"]?.trim() || DEFAULT_PUBLIC_SITE_URL).replace(/\/$/, "");
}

export function createAppAuthLink(
  siteUrl: string,
  properties: AuthLinkProperties | null | undefined,
  next: "/auth" | "/reset-password",
): string | null {
  const tokenHash = properties?.hashed_token;
  const type = properties?.verification_type;
  if (!siteUrl || !tokenHash || !type) return null;

  const url = new URL("/activate-account", siteUrl);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("next", next);
  return url.toString();
}