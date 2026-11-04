/*
 * Platform adapter.
 *
 * The app (src/app.html) was first built as a claude.ai Artifact. It reaches its backend only through
 * `window.claude.use(name)`, which resolves to small namespaces: "db", "user" and "downloads".
 * This file re-creates those three namespaces on top of any Firestore-like API, so the app runs
 * unchanged on Firebase. Keep the shapes here in sync with what the app calls:
 *
 *   db.collection(path).onSnapshot(next, error)      -> unsubscribe
 *   db.doc(path).onSnapshot(next, error)             -> unsubscribe
 *   db.doc(path).get() / set(data) / update(data) / delete()
 *   user.me() -> {id, name}   user.id()   user.can(name) -> true|false|null
 *   downloads.save({filename, data})
 *
 * Semantics the app relies on (do not change without changing the app):
 *   - update() deep-merges nested maps (the app writes {visits:{[id]:rec}} to add one visit).
 *   - update() on a document that does not exist rejects with {code:"invalid_argument"};
 *     the app catches that and falls back to set() with the document's full shape.
 *   - Errors reject with an object that has a string `code`.
 */
export function makePlatform(F, opts) {
  // F: {collection, doc, onSnapshot, getDoc, setDoc, deleteDoc, db}  (Firestore modular API or a fake)
  const mapErr = (e) => {
    const c = String((e && e.code) || "unknown").replace(/^firestore\//, "").replace(/-/g, "_");
    const out = { code: c === "permission_denied" ? "permission_denied" : c, message: (e && e.message) || "" };
    return out;
  };
  const snapDoc = (d) => ({ id: d.id, exists: d.exists(), data: () => d.data() });
  const db = {
    collection(path) {
      return {
        onSnapshot(next, error) {
          return F.onSnapshot(F.collection(F.db, path),
            (snap) => next({ docs: snap.docs.map((d) => ({ id: d.id, exists: true, data: () => d.data() })) }),
            (e) => error && error(mapErr(e)));
        },
      };
    },
    doc(path) {
      const ref = F.doc(F.db, path);
      return {
        onSnapshot(next, error) { return F.onSnapshot(ref, (d) => next(snapDoc(d)), (e) => error && error(mapErr(e))); },
        async get() { try { return snapDoc(await F.getDoc(ref)); } catch (e) { throw mapErr(e); } },
        async set(data) { try { await F.setDoc(ref, data); } catch (e) { throw mapErr(e); } },
        async update(data) {
          let snap;
          try { snap = await F.getDoc(ref); } catch (e) { throw mapErr(e); }
          if (!snap.exists()) throw { code: "invalid_argument", message: "document does not exist" };
          try { await F.setDoc(ref, data, { merge: true }); } catch (e) { throw mapErr(e); }
        },
        async delete() { try { await F.deleteDoc(ref); } catch (e) { throw mapErr(e); } },
      };
    },
  };
  const user = {
    async me() { const u = opts.currentUser(); return { id: u ? u.uid : null, name: u ? (u.displayName || u.email || "") : "", email: u ? u.email : null }; },
    async id() { const u = opts.currentUser(); return u ? u.uid : null; },
    async can() { return true; }, // Firestore security rules are the real gate; the app shows a toast when a write is refused.
    async isOwner() { return false; },
    async canEdit() { return true; },
  };
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/i.test(filename) ? "text/csv" : /\.json$/i.test(filename) ? "application/json" : "application/octet-stream" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return {};
    },
  };
  return { db, user, downloads };
}

/* Install window.claude synchronously so the app's boot() finds it; each use() waits for sign-in. */
export function installClaudeShim(ready) {
  window.claude = {
    async use(name) {
      const p = await ready; // resolves to the platform once a user is signed in
      return p && Object.prototype.hasOwnProperty.call(p, name) ? p[name] : null;
    },
  };
}
