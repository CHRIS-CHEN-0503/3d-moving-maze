# 倒轉高塔專用語音包

- 由 Voicebox v0.5.0 在本機預先生成，遊戲執行時不連接 Voicebox，也不會上傳玩家資料。
- 使用 Voicebox 內建的 Qwen CustomVoice 0.6B `Serena` 合成聲線；未上傳、複製或模仿真人聲音。
- 遊戲只在需要時載入單一 MP3；若音檔無法播放，會自動改用裝置的中文語音朗讀。
- 生成指令：先啟動本機 Voicebox，再執行 `node tools/generate-voice-pack.mjs`。加上 `--force` 可重新生成全部音檔。
- 原始程式與生成流程見 Voicebox（MIT）；模型與合成聲線仍各自遵循其上游授權及使用規範。
