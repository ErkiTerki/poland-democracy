# Turning on "Choose from Drive" (one-time, ~10 minutes)

Without this setup, every link field on the hub has **Open team Drive ↗** and **Paste link** buttons: you put the file
in the team Drive, copy its link and paste it. This setup adds **Choose from Drive**: Google's own file picker opens
on the site, you pick (or upload) a file in the team folder, and its link fills in by itself.

Anyone on the team with a Google account can do it. It's free. Do it on a computer, signed in to the Google account
that can open the team Drive folder.

## 1. Create a Google Cloud project
1. Go to https://console.cloud.google.com/ and accept the terms if asked.
2. Top bar → project picker → **New project**. Name: `Poland Democracy Hub`. Create, then make sure it's selected.

## 2. Switch on the two APIs
1. Menu → **APIs & Services → Library**.
2. Search **Google Picker API** → **Enable**.
3. Search **Google Drive API** → **Enable**.

## 3. Consent screen (who may sign in)
1. Menu → **APIs & Services → OAuth consent screen** (it may be called **Google Auth Platform**). Click **Get started**.
2. App name: `Poland Democracy Hub`. Support email: yours. Audience: **External**. Contact email: yours. Finish.
3. **Audience** tab → **Test users** → add the Google email addresses of the four of us. Only these accounts can use the picker.
4. **Data access** tab → **Add or remove scopes** → tick `.../auth/drive.file` → Update → Save.

The app stays in "Testing" mode: that's fine for our team. Google will show an "unverified app" warning the first
time each of us signs in: click **Continue**.

## 4. Create the two keys
1. Menu → **APIs & Services → Credentials**.
2. **Create credentials → API key**. Then click it to edit:
   - Application restrictions: **Websites** → add `https://erkiterki.github.io/*`
   - API restrictions: **Restrict key** → tick **Google Picker API**. Save.
3. **Create credentials → OAuth client ID**:
   - Application type: **Web application**. Name: `Hub`.
   - Authorised JavaScript origins: `https://erkiterki.github.io` (and `http://localhost:8000` for local testing).
   - Create. Copy the **Client ID** (ends in `.apps.googleusercontent.com`).
4. Menu → **IAM & Admin → Settings** (or the project dashboard): copy the **Project number** (digits only).

## 5. Put them in the site
Send the three values (API key, Client ID, project number) to whoever maintains the site, or edit `assets/app.js`
yourself, at the top:

```js
const DRIVE = {
  folderId: "1D73e04DwqlUc9RZlXp4l5BQ_n7mzED1f",
  apiKey: "AIza…",
  clientId: "1234…apps.googleusercontent.com",
  appId: "1234567890",
};
```

These values are not secrets: Google only accepts them from our website and only for the test users above, so they
can sit in the public repo. Never put a **client secret** or a personal password here.

Commit, wait a minute, refresh: link fields now show **Choose from Drive**.
