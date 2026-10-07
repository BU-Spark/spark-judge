/** The public frontend and development frontend currently share authentication. */
export function authRedirect(redirectTo: string, siteUrl: string) {
  const configured = new URL(siteUrl);
  const destination = new URL(redirectTo, configured);
  const allowedOrigins = new Set([
    configured.origin,
    "https://hackjudge.netlify.app",
  ]);
  if (
    !allowedOrigins.has(destination.origin) ||
    destination.username || destination.password
  ) {
    throw new Error("Invalid sign-in redirect destination");
  }
  return destination.href;
}
