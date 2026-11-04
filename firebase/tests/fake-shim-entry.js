// Browser test shim: same platform adapter as production, backed by the in-memory fake, seeded from window.__SEED.
import { makeFakeFirestore } from "./fake-firestore.js";
import { makePlatform, installClaudeShim } from "../src/shim/platform.js";
const F = makeFakeFirestore(window.__SEED || {});
window.__FAKE = F;
const U = window.__USER || { uid: "u_test", email: "Cameron.Wharton@fmo.hctx.net", displayName: "Cameron Wharton" };
installClaudeShim(Promise.resolve(makePlatform(F, { currentUser: () => U })));
window.ediAuth = { signOut: async () => {} };
