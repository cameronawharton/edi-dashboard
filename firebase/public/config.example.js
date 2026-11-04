// Copy to public/config.js (build does this on first run) and fill in from
// Firebase console > Project settings > Your apps > Web app > SDK setup and configuration.
// These values are not secrets: Firebase web config is public by design. Security comes from firestore.rules.
window.EDI_CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },
  allowedEmailDomains: ["fmo.hctx.net"], // sign-in is refused for any other address (also enforced in firestore.rules)
  microsoftTenant: "",                  // optional: Entra ID tenant id, once county IT registers the app
  useEmulators: false,                   // true only for local testing with `npm run emulators`
};
