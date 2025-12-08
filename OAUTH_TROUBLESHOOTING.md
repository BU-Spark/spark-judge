# OAuth "Invalid State" Error - Troubleshooting Guide

## The Problem

You're seeing this error in Convex logs:

```
Uncaught Error: Invalid state
    at userOAuthImpl
```

This happens when the OAuth state parameter doesn't match between the initial request and the callback.

## Quick Fixes (Try These First)

### 1. Clear Browser Cookies & Cache

**This fixes 90% of cases:**

1. Open DevTools (F12 or Cmd+Option+I)
2. Go to Application → Storage → Clear site data
3. Or manually delete cookies for `localhost:5173`
4. **Hard refresh** the page (Cmd+Shift+R / Ctrl+Shift+F5)
5. Try signing in again

### 2. Check Browser Console for Cookie Warnings

1. Open DevTools Console
2. Look for warnings about:
   - `SameSite` cookie warnings
   - Blocked cookies
   - Third-party cookie restrictions

### 3. Try Incognito/Private Window

- Open an incognito window
- Navigate to your app
- Try Google sign-in
- If this works, it's a cookie issue in your main browser

### 4. Verify Redirect URI in Google Cloud Console

The redirect URI **MUST** match EXACTLY:

```
https://mild-loris-998.convex.site/api/auth/callback/google
```

Common mistakes:

- ❌ `http://` instead of `https://`
- ❌ Trailing slash: `...callback/google/`
- ❌ Wrong deployment name
- ❌ Missing `/api/auth` prefix

### 5. Check Your SITE_URL Environment Variable

Run this to verify:

```bash
npx convex env list | grep SITE_URL
```

Should show:

```
SITE_URL=http://localhost:5173
```

If not, set it:

```bash
npx convex env set SITE_URL http://localhost:5173
```

### 6. Restart Everything

Sometimes the simplest fix works:

```bash
# Stop all running processes (Ctrl+C)
# Then restart:
npm run dev
```

## Advanced Troubleshooting

### Check Cookie Settings in Browser

**Chrome/Edge:**

1. Settings → Privacy and security → Cookies and other site data
2. Make sure it's NOT set to "Block all cookies"
3. Should be "Allow all cookies" or "Block third-party cookies"

**Firefox:**

1. Settings → Privacy & Security
2. Under "Enhanced Tracking Protection", choose "Standard" or "Custom"
3. Don't block all cookies

**Safari:**

1. Preferences → Privacy
2. Uncheck "Block all cookies"

### Enable Detailed Logging

Add this to your `convex/auth.ts` for debugging:

```typescript
export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Google],
  callbacks: {
    async redirect({ redirectTo }) {
      console.log("OAuth redirectTo:", redirectTo);
      return redirectTo;
    },
  },
});
```

### Check Network Tab

1. Open DevTools → Network tab
2. Click "Sign in with Google"
3. Look for the `/api/auth/signin/google` request
4. Check if cookies are being set in the response headers
5. Look for the callback request `/api/auth/callback/google`
6. Verify the `state` parameter is present in the callback URL

### Verify Convex Deployment

Make sure your Convex backend is deployed:

```bash
npx convex dev
```

Look for output like:

```
✓ Deployment URL: https://mild-loris-998.convex.site
```

This URL MUST match what's in Google Cloud Console.

### Test with cURL

Test the OAuth flow manually:

```bash
# Get your Convex URL
CONVEX_URL=$(npx convex env list | grep CONVEX_SITE_URL | cut -d'=' -f2)

# Test the signin endpoint
curl -v "${CONVEX_URL}/api/auth/signin/google"
```

Should return a redirect to Google with a `state` parameter.

## Common Root Causes

### 1. Browser Extensions Blocking Cookies

- Disable ad blockers
- Disable privacy extensions (Privacy Badger, uBlock Origin, etc.)
- Disable cookie-blocking extensions

### 2. Localhost vs 127.0.0.1

Make sure you're using the same domain everywhere:

- Use `localhost:5173` consistently
- OR use `127.0.0.1:5173` consistently
- Don't mix them

### 3. Multiple Tabs/Windows

- Close all tabs of your app
- Clear cookies
- Open fresh in a single tab

### 4. Development vs Production Mismatch

Make sure:

- `SITE_URL` in Convex = `http://localhost:5173` for dev
- Google redirect URI = `https://[convex-deployment].convex.site/api/auth/callback/google`
- NOT mixing production and dev URLs

### 5. Stale Convex Deployment

Force redeploy:

```bash
npx convex dev --once
npx convex dev
```

## Still Not Working?

### 1. Check Convex Logs in Real-Time

```bash
npx convex logs --watch
```

Look for detailed error messages when clicking "Sign in with Google".

### 2. Verify @auth/core Version

```bash
npm list @auth/core
```

Should be `0.37.0`. If not:

```bash
npm install @auth/core@0.37.0
```

### 3. Try a Different Browser

- Chrome/Edge
- Firefox
- Safari

### 4. Check Google OAuth Consent Screen

In Google Cloud Console:

1. Go to "OAuth consent screen"
2. Make sure:
   - App is in "Testing" mode (for development)
   - Your email is added as a test user
   - Required scopes (email, profile) are included

### 5. Recreate OAuth Credentials

Sometimes Google credentials get corrupted:

1. Delete the old OAuth 2.0 Client ID
2. Create a new one
3. Update `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in Convex

## Emergency Workaround

If nothing works, you can temporarily enable anonymous login for testing:

```typescript
// convex/auth.ts
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import Google from "@auth/core/providers/google";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Google, Anonymous], // Anonymous as fallback
});
```

Then in your frontend, add a "Continue as Guest" button for testing.

## Success Checklist

✓ Cookies enabled in browser  
✓ No browser extensions blocking cookies  
✓ Correct redirect URI in Google Console  
✓ SITE_URL environment variable set  
✓ Convex backend running (`npm run dev:backend`)  
✓ Frontend running (`npm run dev:frontend`)  
✓ Using same domain (localhost vs 127.0.0.1)  
✓ Hard refresh after clearing cookies  
✓ Added as test user in Google OAuth consent screen

## Need More Help?

1. Check Convex Auth docs: https://labs.convex.dev/auth
2. Check Convex Discord: https://convex.dev/community
3. Share your Convex logs (from `npx convex logs`)



