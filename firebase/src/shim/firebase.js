/*
 * Firebase entry point, bundled by scripts/build.mjs into public/shim.js (a classic script loaded in <head>,
 * before the app's own inline script, so window.claude exists when the app boots).
 *
 * Sign-in: email link (passwordless) to a work address. Optionally Microsoft (Entra ID) when
 * EDI_CONFIG.microsoftTenant is set and the provider is enabled in the Firebase console.
 */
import { initializeApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  signOut, connectAuthEmulator, OAuthProvider, signInWithPopup, browserLocalPersistence, setPersistence,
} from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  collection, doc, onSnapshot, getDoc, setDoc, deleteDoc,
} from "firebase/firestore";
import { makePlatform, installClaudeShim } from "./platform.js";

const CFG = window.EDI_CONFIG || {};
let resolveReady;
const ready = new Promise((r) => { resolveReady = r; });
installClaudeShim(ready);

if (!CFG.firebase || !CFG.firebase.apiKey) {
  // No configuration yet: the app shows its "Not connected" screen.
  console.warn("EDI: public/config.js has no Firebase settings. See README.");
  resolveReady(null);
} else {
  const app = initializeApp(CFG.firebase);
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (CFG.useEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  const platform = makePlatform({ db, collection, doc, onSnapshot, getDoc, setDoc, deleteDoc }, { currentUser: () => auth.currentUser });
  window.ediAuth = { signOut: async () => { await signOut(auth); location.reload(); }, auth };

  const allowed = (email) => {
    const doms = CFG.allowedEmailDomains || [];
    return !doms.length || doms.some((d) => String(email || "").toLowerCase().endsWith("@" + d.toLowerCase()));
  };

  // Finish an email-link sign-in if this page load came from the link.
  if (isSignInWithEmailLink(auth, location.href)) {
    let email = localStorage.getItem("edi-signin-email");
    if (!email) email = window.prompt("Confirm the email address you used to sign in");
    signInWithEmailLink(auth, email, location.href)
      .then(() => { localStorage.removeItem("edi-signin-email"); history.replaceState(null, "", location.pathname + location.hash); })
      .catch((e) => showGate("That sign-in link did not work (" + (e.code || "error") + "). Request a new one."));
  }

  let gate = null;
  onAuthStateChanged(auth, (u) => {
    if (u) {
      if (!allowed(u.email)) { showGate("Sign in with your work email address."); signOut(auth); return; }
      if (gate) { gate.remove(); gate = null; }
      resolveReady(platform);
    } else {
      showGate();
    }
  });

  function showGate(msg) {
    if (!gate) {
      gate = document.createElement("div");
      gate.id = "edi-gate";
      gate.innerHTML = `
        <style>
          #edi-gate{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:var(--paper,#f3f4f1);padding:16px;font-family:"IBM Plex Sans",system-ui,sans-serif;color:var(--ink,#1b2228)}
          #edi-gate .card{width:min(420px,100%);background:var(--panel,#fff);border:1px solid var(--line,#d8dcd4);border-radius:12px;padding:28px 24px;display:flex;flex-direction:column;gap:14px;box-shadow:0 4px 24px rgb(0 0 0/.08)}
          #edi-gate img{width:72px;align-self:center}
          #edi-gate h1{margin:0;text-align:center;font:700 26px/1.1 "Barlow Condensed",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.02em}
          #edi-gate p{margin:0;font-size:14px;color:var(--ink2,#4c5761);text-align:center}
          #edi-gate input{font:inherit;font-size:16px;padding:11px 12px;border:1px solid var(--line,#d8dcd4);border-radius:8px;background:var(--panel,#fff);color:inherit}
          #edi-gate button{font:inherit;font-weight:600;font-size:15px;padding:11px 14px;border-radius:8px;border:1px solid transparent;cursor:pointer;background:var(--accent,#24459c);color:var(--on-accent,#fff)}
          #edi-gate button.alt{background:transparent;color:var(--ink,#1b2228);border-color:var(--line,#d8dcd4)}
          #edi-gate .msg{font-size:13px;color:var(--bad,#bf3229);text-align:center;min-height:1em}
          #edi-gate .ok{color:var(--ok,#2c7a4b)}
        </style>
        <form class="card" novalidate>
          <img src="icons/badge.png" alt="">
          <h1>Education Division Insight</h1>
          <p>HCFMO Prevention Bureau. Sign in with your work email and we will send you a one-time link.</p>
          <input type="email" name="email" autocomplete="email" placeholder="First.Last@fmo.hctx.net" required>
          <button type="submit">Email me a sign-in link</button>
          ${CFG.microsoftTenant ? '<button type="button" class="alt" data-ms>Sign in with Microsoft</button>' : ""}
          <div class="msg" role="status"></div>
        </form>`;
      if (document.body) document.body.appendChild(gate); else document.addEventListener("DOMContentLoaded", () => document.body.appendChild(gate));
      const form = gate.querySelector("form");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = form.email.value.trim();
        const out = gate.querySelector(".msg");
        if (!allowed(email)) { out.className = "msg"; out.textContent = "Use your work email address."; return; }
        try {
          await sendSignInLinkToEmail(auth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
          localStorage.setItem("edi-signin-email", email);
          out.className = "msg ok"; out.textContent = "Check your inbox for the sign-in link. Open it on this device.";
        } catch (err) { out.className = "msg"; out.textContent = "Could not send the link (" + (err.code || "error") + ")."; }
      });
      const ms = gate.querySelector("[data-ms]");
      if (ms) ms.addEventListener("click", async () => {
        const p = new OAuthProvider("microsoft.com"); p.setCustomParameters({ tenant: CFG.microsoftTenant, prompt: "select_account" });
        try { await signInWithPopup(auth, p); } catch (err) { gate.querySelector(".msg").textContent = "Microsoft sign-in failed (" + (err.code || "error") + ")."; }
      });
    }
    if (msg) gate.querySelector(".msg").textContent = msg;
  }
}

// Offline app shell
if ("serviceWorker" in navigator && !CFG.useEmulators) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
