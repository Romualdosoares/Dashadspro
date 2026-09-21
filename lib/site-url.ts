export function resolveSiteOrigin(requestUrl: string, configuredUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  const requestOrigin = new URL(requestUrl).origin;
  if (!configuredUrl) return requestOrigin;
  try {
    const configured = new URL(configuredUrl);
    if (configured.protocol !== "http:" && configured.protocol !== "https:") return requestOrigin;
    return configured.origin;
  } catch {
    return requestOrigin;
  }
}
