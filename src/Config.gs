/**
 * 設定與常數。
 *
 * 所有機密都放在「專案設定 → 指令碼屬性」，不要寫死在程式碼裡。
 *
 * 必填：
 *   GEMINI_API_KEY              Google AI Studio 取得
 *   SHEET_ID                    試算表網址 /d/ 與 /edit 之間那段
 *   LINE_CHANNEL_ACCESS_TOKEN   LINE Developers Console 取得
 *
 * 選填：
 *   WEBHOOK_TOKEN        自訂字串。設定後 Webhook URL 要加上 ?token=xxx，
 *                        用來擋掉亂打你網址的人（見 README 的安全性說明）。
 *   ALLOWED_USER_IDS     逗號分隔的 LINE userId 白名單。留空代表不限制。
 *   CALENDAR_ID          要寫入的日曆 ID，留空用預設日曆。
 *   GEMINI_MODEL         預設 gemini-2.5-flash。
 */

var CONFIG = {
  TIMEZONE: 'Asia/Taipei',
  SHEET_NAME: '待辦',

  // 試算表欄位順序，改這裡就會一併影響 initSheet 與寫入
  HEADERS: [
    '建立時間', '事項', '分類', '日期', '時間', '狀態',
    '來源', 'UserId', '原始訊息', '行事曆事件ID'
  ],

  CATEGORIES: ['繳費', '會議', '學習', '工作', '家庭', '就醫', '旅遊', '理財', '生日', '其他'],

  DEFAULT_MODEL: 'gemini-2.5-flash',

  // 行事曆行為
  EVENT_DURATION_MINUTES: 30,
  REMINDER_MINUTES_BEFORE: 30,
  // 只有日期沒有時間時，是否建立整天事件（教學版本是不建立）
  CREATE_ALLDAY_WHEN_NO_TIME: true,

  // LINE 會重送 webhook，用 Cache 去重（秒，上限 21600）
  DEDUPE_TTL_SECONDS: 21600
};

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function requireProp_(key) {
  var v = prop_(key);
  if (!v) {
    throw new Error('缺少指令碼屬性：' + key + '（專案設定 → 指令碼屬性）');
  }
  return v;
}
