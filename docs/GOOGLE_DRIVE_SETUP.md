# Google Drive backup and sync — setup

The app uses the user's own Google Drive for two things, both with the same client ID:
- **Backups** of every case (optionally encrypted) — `src/storage/driveBackup.js`,
  `src/panels/DriveBackupDialog.jsx`, folder "Cephalometry Studio backups".
- **Cross-device sync** of a profile linked to a Google account — `src/storage/driveSync.js`,
  `src/hooks/useDriveSync.js`, folder "Cephalometry Studio sync".

There is no server; the only thing the site needs is a Google OAuth **client ID**. Until
`VITE_GOOGLE_CLIENT_ID` is set, the Drive buttons are hidden.

## 1. Google Cloud project
1. Open <https://console.cloud.google.com/> and create a project (e.g. "Cephalometry Studio").
2. **APIs & Services → Library →** enable **Google Drive API**.

## 2. OAuth consent screen (Google Auth Platform)
1. **Branding:** app name, user-support email, developer contact email, and optionally the
   logo (`public/icon-512.png`).
   - App domain: the site's homepage URL, **privacy policy URL** and terms URL (public pages).
   - Authorized domains: the site's domain (e.g. `your-domain.com`, or `your-app.vercel.app`).
2. **Audience:** *External*. While the status is **Testing**, only the Google accounts added
   under *Test users* (up to 100) can sign in — add your own first.
3. **Data access:** add the scope `https://www.googleapis.com/auth/drive.file`
   ("See, edit, create and delete only the specific Google Drive files you use with this app").
   It is a non-sensitive scope, so no security assessment is needed.
4. When ready for everyone: **Publish app** (status *In production*). Google may ask to verify
   the branding (domain ownership, privacy policy); this usually takes a few days.

## 3. OAuth client ID
**Clients → Create client →** type **Web application**.
- **Authorized JavaScript origins** (exact, no wildcards, no trailing slash):
  - `http://localhost:5173` and `http://localhost:4173` (dev and preview)
  - `https://your-domain.com` (production; also the `*.vercel.app` URL if used)
  - Vercel preview URLs change per deployment and can't be listed, so Drive sign-in works only
    on the listed origins.
- **Authorized redirect URIs:** none (the app uses Google's popup token flow).

Copy the client ID (`….apps.googleusercontent.com`). It is not a secret.

## 4. Give the app the client ID
The project's client ID is committed in `.env` (`VITE_GOOGLE_CLIENT_ID`), so local builds
and Vercel builds use it with no extra setup. It is read at build time: restart `npm run dev`
after changing it. To try a different client, override it in `.env.local` (git-ignored) or in
Vercel → Project → Settings → Environment Variables.

The Google Cloud project is owned by the project account (cephalometrystudio@gmail.com);
add a second owner so access can't be lost.

## 5. Privacy policy
The consent screen needs a public privacy policy URL. It should say, at least:
- cases stay in the browser unless the user backs them up;
- Drive backups go only to the user's own Google Drive, using the `drive.file` permission
  (the app sees only files it created), encrypted with the user's passphrase before upload;
- the site operator never receives the data or the passphrase, and a lost passphrase cannot
  be recovered;
- how to revoke access (Google Account → Security → Third-party connections, or Disconnect
  in the app).

## Notes
- Sign-ins last about an hour and are kept in memory only; the app asks to connect again
  when needed. Backups run when the user clicks (no background uploads).
- The security policy in `vercel.json` already allows `accounts.google.com/gsi` and
  `www.googleapis.com`. If COOP is ever added, use `same-origin-allow-popups`, or the
  sign-in popup breaks.
