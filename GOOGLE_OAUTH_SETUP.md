# Google OAuth Setup Instructions

## Prerequisites

- A Google Cloud Platform account
- Access to your Convex dashboard

## Step 1: Get Your Convex Deployment URL

1. Go to your Convex dashboard at https://dashboard.convex.dev
2. Select your project
3. Find your deployment URL (it will look like: `https://your-deployment-name.convex.site`)
4. Copy this URL - you'll need it for the next steps

## Step 2: Set Up Google Cloud Console

### Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Google+ API:

   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. Create OAuth 2.0 credentials:

   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - If prompted, configure the OAuth consent screen:
     - Choose "External" user type
     - Fill in the required app information
     - Add your email as a test user
   - Choose "Web application" as the application type
   - Give it a name (e.g., "HackJudge")

5. Add Authorized redirect URI:

   - In the "Authorized redirect URIs" section, click "Add URI"
   - Enter: `https://[your-deployment-name].convex.site/api/auth/callback/google`
   - **Important**: Replace `[your-deployment-name]` with your actual Convex deployment name
   - Example: `https://mild-loris-998.convex.site/api/auth/callback/google`

6. Click "Create"
7. Copy the **Client ID** and **Client Secret** that appear

## Step 3: Configure Convex Environment Variables

Run these commands in your terminal from your project root:

```bash
# Set your Google Client ID
npx convex env set AUTH_GOOGLE_ID <your-client-id>

# Set your Google Client Secret
npx convex env set AUTH_GOOGLE_SECRET <your-client-secret>

# Set your site URL for redirects (for local development)
npx convex env set SITE_URL http://localhost:5173
```

Replace `<your-client-id>` and `<your-client-secret>` with the actual values from Google Cloud Console.

## Step 4: Deploy Your Changes

```bash
# Deploy your backend
npm run dev:backend

# Or if using separate terminals, just run:
convex dev
```

## Step 5: Test the Authentication

1. Start your development server:

   ```bash
   npm run dev
   ```

2. Open your app in a browser
3. Click "Sign In"
4. Click "Sign in with Google"
5. You should be redirected to Google's sign-in page
6. After signing in, you'll be redirected back to your app

## Troubleshooting

### "redirect_uri_mismatch" Error

- **Cause**: The redirect URI in Google Cloud Console doesn't match exactly
- **Solution**:
  - Double-check your Convex deployment URL
  - Ensure the redirect URI is exactly: `https://[deployment].convex.site/api/auth/callback/google`
  - No trailing slashes
  - Must use `https://` (not `http://`)

### "Access blocked" Error

- **Cause**: App is not verified or user is not added as a test user
- **Solution**:
  - Go to OAuth consent screen in Google Cloud Console
  - Add yourself as a test user under "Test users"
  - Or publish your app (requires verification for production)

### Authentication Works But User Data Missing

- **Cause**: Scopes not configured properly
- **Solution**: Google OAuth automatically includes email and profile scopes, but verify in Google Cloud Console that these scopes are enabled

### Local Development Issues

- **Cause**: SITE_URL not set correctly
- **Solution**: Make sure you ran `npx convex env set SITE_URL http://localhost:5173`

## Production Deployment

When deploying to production:

1. Update your Google Cloud Console OAuth credentials:

   - Add your production domain to "Authorized JavaScript origins"
   - Add production redirect URI: `https://your-production-convex-deployment.convex.site/api/auth/callback/google`

2. Update your SITE_URL environment variable:

   ```bash
   npx convex env set SITE_URL https://your-production-domain.com
   ```

3. Consider publishing your OAuth consent screen for public use

## Security Notes

- Never commit your `AUTH_GOOGLE_SECRET` to version control
- Keep your Client Secret secure
- Only add trusted redirect URIs in Google Cloud Console
- Regularly review access in Google Cloud Console
- Consider implementing user role management for admin access

## Need Help?

- [Convex Auth Documentation](https://labs.convex.dev/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- Check Convex logs for detailed error messages



