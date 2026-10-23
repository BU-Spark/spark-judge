/** The public frontend and development frontend currently share authentication. */
export function authRedirect(redirectTo: string, siteUrl: string) {
  const configured = new URL(siteUrl);
  const destination = new URL(redirectTo, configured);
  const allowedOrigins = new Set([
    configured.origin,
    "https://hackjudge.netlify.app",
  ]);
  // Netlify draft deploys of this site (https://<id>--hackjudge.netlify.app)
  // are how releases are checked before they are published.
  const isNetlifyDraft =
    destination.protocol === "https:" &&
    !destination.port &&
    /^[a-z0-9-]+--hackjudge\.netlify\.app$/.test(destination.hostname);
  if (
    (!allowedOrigins.has(destination.origin) && !isNetlifyDraft) ||
    destination.username || destination.password
  ) {
    throw new Error("Invalid sign-in redirect destination");
  }
  return destination.href;
}
