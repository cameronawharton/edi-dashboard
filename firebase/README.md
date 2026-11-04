# Education Division Insight

HCFMO Prevention Bureau school inspection tracking. One web app, installable on iPhone, Android and desktop (Progressive Web App), backed by Firebase.

## First-time setup (about 30 minutes)

1. **Firebase project.** At console.firebase.google.com create a project (Blaze plan not required to start). Then:
   - Build > Authentication > Sign-in method: enable **Email link (passwordless)**. Add your hosting domain under Authorized domains after the first deploy.
   - Build > Firestore Database: create in `us-central1` (or nearest), production mode.
   - Project settings > Your apps > Add web app. Copy the config object.
2. **This repo.** Install Node 20+ and Java 11+ (Java is only for the local emulators).
   ```
   npm install
   npx playwright install chromium     # for the tests
   npm run build                       # creates public/config.js from the example
   ```
   Paste the Firebase config into `public/config.js`. Put your project id in `.firebaserc`.
3. **Data.** Unzip the data bundle inside the repo folder; it creates `data/` (it holds `export/`, `photos/`, `source/`, `team-emails.json`). Never commit it.
4. **Check the security rules, then deploy.**
   ```
   npm run test:rules
   npx firebase login
   npm run deploy
   gcloud auth application-default login     # or use a service account key
   npm run import -- --project <your-project-id>
   ```
5. **Sign in.** Open the hosting URL, enter your work email, open the link, choose your profile. Then Monthly stats > Import Emergency Reporting with the October files in `data/source/stat-tracking/`.
6. **Install on devices.** iPhone: open in Safari > Share > Add to Home Screen. Android: Chrome menu > Install app. Desktop: the install icon in Chrome or Edge's address bar.

## Day to day

- `npm run emulators` then `npm run import:emulator` runs everything locally (set `useEmulators: true` in config.js).
- `npm test` runs the adapter test and the full-app smoke test.
- Change the app in `src/app.html`, then `npm run deploy`. Bump `VERSION` in `public/sw.js` so installed copies pick up the change.

## Before the team relies on it

County inspection records, school contact details and staff photos will live in this Firebase project. Get Harris County IT's sign-off on where it is hosted and who owns the account, and keep the GitHub repo private. See CLAUDE.md for architecture and docs/domain.md for the inspection rules.
