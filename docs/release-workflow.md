# 發布流程與加速

- 重用已開啟的乾淨 Site checkout 與已安裝套件；每次仍先以 Sites source helper 同步最新遠端資料。
- 使用 Node 22.13 以上，先核對版本與電腦架構。桌面 bundled runtime 可由 load_workspace_dependencies 取得；不要混用舊 Node 或其他架構的 node_modules。
- 僅在套件缺失或依賴輸入變更時安裝，不要每次重新安裝。
- 程式修改完成後一次執行 JavaScript 檢查、Python、Worker 測試及 TypeScript 檢查；通過後執行 npm run build。正式建置已包含靜態重建，不需事先再單獨重建。
- 無來源異動時沿用已完成的檢查與建置；source helper 打包時 commands 傳空陣列，避免再跑一次正式建置。
- 合併來源同步、提交及打包所需操作，憑證只由 stdin 傳入。保存已有版本與部署 ID；重試既有部署，不重建同份來源。
- 發布後用同一次 HTTP 檢查比對首頁內嵌版本及 /api/version 的 version、buildNumber、releaseId 與快取設定。
- 核准與託管發布的等待仍由服務控制；不能略過同步、測試或版本核對來加速。
