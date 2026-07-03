/* Firebase 設定 — 世界排行榜功能
   ================================
   1. 到 https://console.firebase.google.com 建立專案
   2. 專案設定 → 你的應用程式 → 新增「網頁」應用程式
   3. 把它給你的 firebaseConfig 物件貼到下方(取代 null)
   4. 啟用 Authentication → 匿名登入
   5. 啟用 Firestore Database(規則見 README)
   6. 改完後記得把 sw.js 的 CACHE 版本 +1 再部署

   保持 null 則排行榜為離線模式(仍可看本機成就)。 */
window.FIREBASE_CONFIG = null;

/* 範例(換成你自己的):
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxx"
};
*/
