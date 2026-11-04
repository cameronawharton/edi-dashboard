// In-memory stand-in for the Firestore modular API, enough for src/shim/platform.js.
// Mirrors Firestore semantics the app depends on: setDoc replaces, setDoc(..., {merge:true}) deep-merges maps
// (arrays replaced), snapshots fire on every change. Used by tests only.
export function makeFakeFirestore(seed = {}) {
  const store = new Map(); // path -> data
  for (const [col, docs] of Object.entries(seed)) for (const [id, d] of Object.entries(docs)) store.set(`${col}/${id}`, clone(d));
  const subs = new Set();
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function strip(x) { if (x && typeof x === "object" && !Array.isArray(x)) { for (const k of Object.keys(x)) { if (x[k] === undefined) delete x[k]; else strip(x[k]); } } return x; }
  function merge(a, b) { for (const k of Object.keys(b)) { const v = b[k]; if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) merge(a[k], v); else a[k] = clone(v); } return a; }
  const emit = () => queueMicrotask(() => subs.forEach((s) => s()));
  const db = { _store: store };
  const segs = (p) => p.split("/").filter(Boolean);
  const collection = (_db, path) => ({ kind: "col", path });
  const doc = (_db, path) => ({ kind: "doc", path, id: segs(path).pop() });
  const docSnap = (path) => ({ id: segs(path).pop(), exists: () => store.has(path), data: () => clone(store.get(path)) });
  const colSnap = (path) => {
    const n = segs(path).length;
    const docs = [...store.keys()].filter((k) => k.startsWith(path + "/") && segs(k).length === n + 1).sort().map(docSnap);
    return { docs };
  };
  function onSnapshot(ref, next, error) {
    const fire = () => { try { next(ref.kind === "col" ? colSnap(ref.path) : docSnap(ref.path)); } catch (e) { error && error(e); } };
    subs.add(fire); queueMicrotask(fire);
    return () => subs.delete(fire);
  }
  async function getDoc(ref) { return docSnap(ref.path); }
  async function setDoc(ref, data, opts) {
    if (segs(ref.path).length % 2) throw { code: "invalid-argument", message: "odd path" };
    const d = strip(clone(data));
    if (opts && opts.merge && store.has(ref.path)) store.set(ref.path, merge(store.get(ref.path), d)); else store.set(ref.path, d);
    emit();
  }
  async function deleteDoc(ref) { store.delete(ref.path); emit(); }
  return { db, collection, doc, onSnapshot, getDoc, setDoc, deleteDoc, store };
}
