# 給 Claude 的轉移提示詞

以下內容可直接貼給 Claude：

> 「3D移動迷宮」已從原本的 `CHRIS-CHEN-0503/ziwei-test/3D迷宮/` 抽離，轉移成獨立專案。新的本機工作目錄是 `/Users/chenziwei/Desktop/自製程式工具/3D移動迷宮`；它包含根目錄 `index.html`、`lib/three.min.js`、`functions/api/scores.js`、生成的首頁迷宮背景與驗證工具。後續請不要再修改舊的 `ziwei-test/3D迷宮/`，也不要把英文測驗或其他小遊戲檔案帶進來。開始工作前請先讀新專案的 `README.md`、`docs/視覺與多人架構檢查.md` 與目前 Git 歷史，保留現有遊戲玩法、按鈕 ID、分數 API 路徑和 MQTT 多人協定；除非我另外授權，不要重寫功能或改成其他多人後端。每次修改後請執行 `npm run check`，並以實際瀏覽器確認首頁、開始遊戲與多人入口。
