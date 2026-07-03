/* 排行榜模組(Firebase Firestore + 匿名登入)
   未設定 FIREBASE_CONFIG 時自動降級為離線模式;
   SDK 以動態 import 載入,不影響離線遊玩與載入速度。 */
window.LB = (() => {
  'use strict';
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  let fb = null;            // { db, uid, fs }
  let initPromise = null;
  let lastError = null;

  function available() { return !!window.FIREBASE_CONFIG; }

  async function init() {
    if (!available()) { lastError = 'no-config'; return null; }
    if (fb) return fb;
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        const [appMod, authMod, fsMod] = await Promise.all([
          import(SDK + 'firebase-app.js'),
          import(SDK + 'firebase-auth.js'),
          import(SDK + 'firebase-firestore.js'),
        ]);
        const app = appMod.initializeApp(window.FIREBASE_CONFIG);
        const auth = authMod.getAuth(app);
        const cred = await authMod.signInAnonymously(auth);
        const db = fsMod.getFirestore(app);
        fb = { db, uid: cred.user.uid, fs: fsMod };
        return fb;
      } catch (e) {
        lastError = (e && e.message) ? e.message : String(e);
        initPromise = null;
        return null;
      }
    })();
    return initPromise;
  }

  // 上傳/更新自己的成績(合併寫入,離線或失敗時靜默略過)
  async function submit(profile) {
    const f = await init();
    if (!f) return false;
    try {
      await f.fs.setDoc(
        f.fs.doc(f.db, 'players', f.uid),
        { ...profile, updatedAt: f.fs.serverTimestamp() },
        { merge: true }
      );
      return true;
    } catch (e) { lastError = e.message; return false; }
  }

  // 取前 n 名(依總分排序)
  async function top(n = 50) {
    const f = await init();
    if (!f) return null;
    try {
      const q = f.fs.query(
        f.fs.collection(f.db, 'players'),
        f.fs.orderBy('totalScore', 'desc'),
        f.fs.limit(n)
      );
      const snap = await f.fs.getDocs(q);
      const rows = [];
      snap.forEach(d => rows.push({ uid: d.id, ...d.data() }));
      return rows;
    } catch (e) { lastError = e.message; return null; }
  }

  return {
    available,
    init,
    submit,
    top,
    uid: () => (fb ? fb.uid : null),
    error: () => lastError,
  };
})();
