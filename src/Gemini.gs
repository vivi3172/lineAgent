/**
 * Gemini：把自然語言／圖片轉成結構化待辦 JSON。
 */

var TODO_SCHEMA_ = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING', description: '事項，10 字以內的精簡描述' },
          category: { type: 'STRING', enum: CONFIG.CATEGORIES },
          date: { type: 'STRING', description: '西元日期 YYYY-MM-DD，無法判斷則空字串' },
          time: { type: 'STRING', description: '24 小時制 HH:mm，無法判斷則空字串' },
          note: { type: 'STRING', description: '補充說明，沒有則空字串' }
        },
        required: ['summary', 'category', 'date', 'time', 'note']
      }
    }
  },
  required: ['items']
};

function geminiModel_() {
  return prop_('GEMINI_MODEL') || CONFIG.DEFAULT_MODEL;
}

/**
 * 把「明天」「下星期五」換算成真正日期，靠的是這段 prompt 裡的今日資訊，
 * 不能指望模型自己知道今天幾號。
 */
function buildPrompt_() {
  var now = new Date();
  var today = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  // 用 UTC 重建當地日期來算星期，避免 formatDate 的語系差異
  var ymd = today.split('-');
  var dow = new Date(Date.UTC(Number(ymd[0]), Number(ymd[1]) - 1, Number(ymd[2]))).getUTCDay();
  var weekday = ['日', '一', '二', '三', '四', '五', '六'][dow];
  return [
    '你是待辦事項解析器。從輸入中抽出所有待辦事項，輸出 JSON。',
    '',
    '今天是 ' + today + '（星期' + weekday + '），時區 ' + CONFIG.TIMEZONE + '。',
    '所有相對時間都要換算成絕對日期：',
    '「今天」= ' + today + '、「明天」= 今天+1 天、「後天」= 今天+2 天、',
    '「下星期五」= 今天之後最近的下一個星期五，依此類推。',
    '',
    '規則：',
    '1. 一則訊息可能含多件事，全部列出；完全沒有待辦則回傳空陣列。',
    '2. summary 只寫要做的事本身，不要包含日期時間。',
    '3. 口語時間換算：「早上十點」=10:00、「下午三點」=15:00、「晚上八點半」=20:30。',
    '4. 只說日期沒說時間 → time 留空字串，不要自己編。',
    '5. category 只能是：' + CONFIG.CATEGORIES.join('、') + '。',
    '6. 圖片輸入時，讀出畫面上的行程或截圖文字，逐筆列出。'
  ].join('\n');
}

function geminiParseText_(text) {
  return geminiCall_([{ text: buildPrompt_() }, { text: '輸入訊息：\n' + text }]);
}

function geminiParseImage_(base64, mimeType) {
  return geminiCall_([
    { text: buildPrompt_() },
    { text: '請解析這張圖片中的行程／待辦：' },
    { inline_data: { mime_type: mimeType, data: base64 } }
  ]);
}

function geminiCall_(parts) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    geminiModel_() + ':generateContent';

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': requireProp_('GEMINI_API_KEY') },
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: TODO_SCHEMA_
      }
    }),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    throw new Error('Gemini 錯誤 ' + res.getResponseCode() + '：' + res.getContentText().slice(0, 500));
  }

  var body = JSON.parse(res.getContentText());
  var candidate = body.candidates && body.candidates[0];
  var raw = candidate && candidate.content && candidate.content.parts &&
    candidate.content.parts.map(function (p) { return p.text || ''; }).join('');

  if (!raw) {
    throw new Error('Gemini 沒有回傳內容：' + res.getContentText().slice(0, 500));
  }

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error('Gemini 回傳不是合法 JSON：' + raw.slice(0, 500));
  }

  return normalizeItems_(parsed.items || []);
}

/** 模型偶爾會給出格式怪異的值，這裡統一清乾淨再往下游送。 */
function normalizeItems_(items) {
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var summary = String(it.summary || '').trim();
    if (!summary) continue;

    var date = String(it.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = '';

    var time = String(it.time || '').trim();
    var m = time.match(/^(\d{1,2}):(\d{2})$/);
    if (m && Number(m[1]) <= 23 && Number(m[2]) <= 59) {
      time = ('0' + m[1]).slice(-2) + ':' + m[2];
    } else {
      time = '';
    }

    var category = String(it.category || '').trim();
    if (CONFIG.CATEGORIES.indexOf(category) === -1) category = '其他';

    out.push({
      summary: summary,
      category: category,
      date: date,
      time: time,
      note: String(it.note || '').trim()
    });
  }
  return out;
}
