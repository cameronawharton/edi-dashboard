// Firebase web settings for the published app. Not secret: Firebase web config is public by design.
// Security comes from firestore.rules. Fill the firebase block from
// Firebase console > Project settings > General > Your apps > Web app.
window.EDI_CONFIG = {
  appName: "CO/ED Division Insight",
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },
  openRead: true,                                  // demo: anyone with the link can read; signing in only unlocks edits
  owners: ["Cameron.Wharton@fmo.hctx.net"],       // may load the data bundle and edit everything
  allowedEmailDomains: ["fmo.hctx.net"],
  microsoftTenant: "",
  useEmulators: false,
};
