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
  collection, doc, onSnapshot, getDoc, setDoc, deleteDoc, writeBatch,
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
  const owner = (u) => !!u && u.emailVerified && (CFG.owners || []).map((x) => x.toLowerCase()).includes(String(u.email || "").toLowerCase());
  let firstAuth = true;
  onAuthStateChanged(auth, (u) => {
    if (u && !allowed(u.email)) { showGate("Sign in with your work email address."); signOut(auth); return; }
    if (u) { if (gate) { gate.remove(); gate = null; } }
    if (CFG.openRead) {
      // Demo mode: anyone with the link can read. Signing in only unlocks editing (firestore.rules decide).
      resolveReady(platform);
      if (!firstAuth) { history.replaceState(null, "", location.pathname + location.hash); location.reload(); return; } // identity changed: let the app boot again as the new person
      firstAuth = false;
      accountPill(u);
      return;
    }
    if (u) resolveReady(platform); else showGate();
  });

  // Small account control for demo mode: sign in to edit, sign out, and (owner) load the data bundle.
  function accountPill(u) {
    const mount = () => {
      let el = document.getElementById("edi-acct");
      if (!el) { el = document.createElement("div"); el.id = "edi-acct"; document.body.appendChild(el); }
      el.innerHTML = `<style>
        #edi-acct{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:900;display:flex;gap:6px;font:500 12.5px "IBM Plex Sans",system-ui,sans-serif}
        #edi-acct button{font:inherit;padding:7px 11px;border-radius:999px;border:1px solid var(--line,#d8dcd4);background:var(--panel,#fff);color:var(--ink,#1b2228);cursor:pointer;box-shadow:0 2px 10px rgb(0 0 0/.12)}
        body.has-tabbar #edi-acct{bottom:calc(76px + env(safe-area-inset-bottom))}
        @media print{#edi-acct{display:none}}
      </style>${u ? `<button type="button" data-out title="${u.email}">Signed in · Sign out</button>${owner(u) ? '<button type="button" data-load>Load data</button>' : ""}`
               : '<button type="button" data-in>Sign in to edit</button>'}
      <input type="file" accept=".json,application/json" hidden>`;
      const pick = el.querySelector("input");
      el.querySelector("[data-in]")?.addEventListener("click", () => showGate(null, true));
      el.querySelector("[data-out]")?.addEventListener("click", async () => { await signOut(auth); });
      el.querySelector("[data-load]")?.addEventListener("click", () => pick.click());
      pick.addEventListener("change", () => pick.files[0] && loadBundle(pick.files[0]));
    };
    if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  }

  // Data bundle: {collections: {name: {docId: data}}}, made by tools/bundle.py from the live data. Writes in batches of 400.
  async function loadBundle(file) {
    let B;
    try { B = JSON.parse(await file.text()); } catch (e) { alert("That file is not a data bundle."); return; }
    const cols = B.collections || {};
    const n = Object.values(cols).reduce((s, c) => s + Object.keys(c).length, 0);
    if (!n || !confirm(`Load ${n} records into this app? Records with the same id are replaced.`)) return;
    let done = 0, batch = writeBatch(db), inBatch = 0;
    try {
      for (const [c, docs] of Object.entries(cols)) for (const [id, data] of Object.entries(docs)) {
        batch.set(doc(db, c, id), data); inBatch++; done++;
        if (inBatch >= 400) { await batch.commit(); batch = writeBatch(db); inBatch = 0; }
      }
      if (inBatch) await batch.commit();
      alert(`Loaded ${done} records.`); location.reload();
    } catch (e) { alert(`Stopped after ${done - inBatch} records (${e.code || e.message}).`); }
  }

  function showGate(msg, closable) {
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
          <h1>${CFG.appName || "Division Insight"}</h1>
          <p>HCFMO Prevention Bureau. Sign in with your work email and we will send you a one-time link. Signing in is only needed to make changes.</p>
          <input type="email" name="email" autocomplete="email" placeholder="First.Last@fmo.hctx.net" required>
          <button type="submit">Email me a sign-in link</button>
          ${CFG.microsoftTenant ? '<button type="button" class="alt" data-ms>Sign in with Microsoft</button>' : ""}
          <div class="msg" role="status"></div>
          ${closable ? '<button type="button" class="alt" data-close>Not now</button>' : ""}
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
      gate.querySelector("[data-close]")?.addEventListener("click", () => { gate.remove(); gate = null; });
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
