# LINE AI 待辦助理

在 LINE 傳一句「明天下午三點要開會」，自動記進 Google 試算表並建立 Google Calendar 提醒。
也可以直接丟行程截圖。

```
LINE 訊息 ──▶ Apps Script ──▶ Gemini ──▶ JSON ──▶ Google Sheet ──▶ Calendar ──▶ LINE 回覆
```

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `src/Code.gs` | Webhook 進入點、事件分派、指令處理 |
| `src/Gemini.gs` | 自然語言／圖片 → 結構化 JSON |
| `src/Sheet.gs` | 試算表讀寫、`initSheet` |
| `src/Calendar.gs` | 行事曆事件建立 |
| `src/Line.gs` | LINE 回覆、下載圖片 |
| `src/Config.gs` | 常數與指令碼屬性存取 |
| `src/Setup.gs` | `checkSetup` / `testParseSample` 等測試函式 |
| `src/appsscript.json` | 專案設定（時區、OAuth scope） |

## 建置步驟

### STEP 1　建立試算表與 Apps Script
1. 新增 Google 試算表，命名「LINE待辦助理」。
2. 從網址取得 `SHEET_ID`（`/d/` 與 `/edit` 之間那段）。
3. 擴充功能 → Apps Script，把 `src/` 底下每個 `.gs` 檔各建一個同名檔案貼進去。
   （要顯示 `appsscript.json`：專案設定 → 勾選「在編輯器中顯示 appsscript.json 資訊清單檔案」）

### STEP 2　設定 Gemini
1. 到 [Google AI Studio](https://aistudio.google.com/apikey) 建立 API Key。
2. Apps Script → 專案設定 → 指令碼屬性，新增：
   - `GEMINI_API_KEY`
   - `SHEET_ID`

### STEP 2.1　測試 AI → 試算表
1. 執行 `initSheet`（第一次會要求 Google 授權，選你的帳號 → 進階 → 前往）。
2. 確認試算表出現標題列。
3. 執行 `testParseSample`，試算表應多出一列「交房租 / 繳費 / 明天日期 / 10:00」。

### STEP 3　建立 LINE 官方帳號
1. [LINE Official Account Manager](https://manager.line.biz/) 建立官方帳號。
2. [LINE Developers Console](https://developers.line.biz/console/) 建立 Provider，啟用 Messaging API。
3. 取得 **Channel access token（long-lived）**。
4. 回到指令碼屬性新增 `LINE_CHANNEL_ACCESS_TOKEN`。
5. 順手新增 `WEBHOOK_TOKEN`，值自己取一串亂碼（例如 `openssl rand -hex 16` 的結果）。

### STEP 4　部署 Web App
1. 部署 → 新增部署作業 → 網頁應用程式。
2. 執行身分：**我**；誰可以存取：**所有人**。
3. 取得結尾是 `/exec` 的網址。

> 之後每次改程式碼，都要「部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署」才會生效。

### STEP 4.1　設定 Webhook
1. LINE Developers → Messaging API → Webhook URL 填入：
   `https://script.google.com/macros/s/xxxxx/exec?token=你的WEBHOOK_TOKEN`
2. 開啟 **Use webhook**。
3. LINE Official Account Manager → 回應設定 → 關閉「自動回應訊息」。

Verify 按鈕可能顯示 302（Apps Script 有轉址特性），這是正常的，直接用實際傳訊測試。

### STEP 4.2　驗收
加入官方帳號，傳「明天下午三點要開會」，應收到 `⭕ 已記錄`，並且試算表多一列、行事曆多一個提醒。

部署前建議先在編輯器執行 `checkSetup`，它會逐項檢查金鑰、試算表、日曆、Gemini 是否都通。

## 指令碼屬性

| 屬性 | 必填 | 說明 |
| --- | --- | --- |
| `GEMINI_API_KEY` | ✅ | Google AI Studio API Key |
| `SHEET_ID` | ✅ | 試算表 ID |
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | LINE Channel access token |
| `WEBHOOK_TOKEN` | 建議 | Webhook URL 的 `?token=` 參數值 |
| `ALLOWED_USER_IDS` | 選填 | 逗號分隔的 LINE userId 白名單 |
| `CALENDAR_ID` | 選填 | 指定日曆，留空用預設 |
| `GEMINI_MODEL` | 選填 | 預設 `gemini-2.5-flash` |

## LINE 指令

| 輸入 | 行為 |
| --- | --- |
| 任意句子 | AI 解析並記錄，一則訊息可含多件事 |
| 圖片 | 讀出截圖中的行程 |
| `說明` | 顯示用法 |
| `清單` | 列出最近 5 筆 |

## 幾個要知道的限制

- **無法驗證 LINE 簽章。** Apps Script 的 `doPost` 拿不到 HTTP header，所以標準的 `X-Line-Signature` 驗簽做不到。本專案改用網址裡的 `WEBHOOK_TOKEN` 擋掉隨機打你網址的人——這比不做好，但強度不如簽章驗證。網址本身要當成密碼保管，別貼到公開的地方。
- **LINE 會重送 webhook。** 已用 `CacheService` 依 `webhookEventId` 去重，快取有效 6 小時。
- **相對日期由程式碼負責。** prompt 裡會帶入今天的日期與星期，模型自己不知道今天幾號。
- **replyToken 約 1 分鐘失效**，Apps Script 免費版單次執行上限 6 分鐘。Gemini 偶爾變慢時可能來不及回覆，但試算表通常已寫入。
- **不要把密碼、卡號、身分證字號傳給它**，內容會送到 Gemini API。

## 檢查清單

- [ ] 1. Google Sheet 建立完成
- [ ] 2. Apps Script 程式碼貼上完成
- [ ] 3. `GEMINI_API_KEY` 設定完成
- [ ] 4. `SHEET_ID` 設定完成
- [ ] 5. `initSheet` 執行成功
- [ ] 6. `testParseSample` 執行成功
- [ ] 7. LINE 官方帳號建立完成
- [ ] 8. Messaging API 啟用
- [ ] 9. `LINE_CHANNEL_ACCESS_TOKEN` 設定完成
- [ ] 10. `WEBHOOK_TOKEN` 設定完成
- [ ] 11. Web App 部署完成
- [ ] 12. Webhook URL 設定完成、自動回應已關閉
- [ ] 13. 實際傳訊測試成功，行事曆提醒建立成功
