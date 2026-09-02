/**
 * LINE AI 待辦助理 — Webhook 進入點。
 *
 * 資料流：
 *   LINE 訊息 → doPost → Gemini 解析 → 試算表 → 行事曆 → LINE 回覆
 */

/** 部署後可用瀏覽器開啟確認部署成功。 */
function doGet() {
  return ContentService.createTextOutput('LINE AI 待辦助理運作中');
}

function doPost(e) {
  // 不論成功失敗都要回 200，否則 LINE 會判定 webhook 失敗並不斷重送
  try {
    handleWebhook_(e);
  } catch (err) {
    console.error('doPost 例外：%s\n%s', err && err.message, err && err.stack);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleWebhook_(e) {
  // Apps Script 的 doPost 拿不到 HTTP header，因此無法驗證 X-Line-Signature。
  // 退而求其次：Webhook URL 帶一組只有你知道的 token。
  var expected = prop_('WEBHOOK_TOKEN');
  if (expected) {
    var got = e && e.parameter && e.parameter.token;
    if (got !== expected) {
      console.warn('token 不符，忽略此次請求');
      return;
    }
  }

  if (!e || !e.postData || !e.postData.contents) return;

  var body = JSON.parse(e.postData.contents);
  var events = body.events || [];

  for (var i = 0; i < events.length; i++) {
    try {
      handleEvent_(events[i]);
    } catch (err) {
      console.error('處理事件失敗：%s\n%s', err && err.message, err && err.stack);
      lineReply_(events[i].replyToken, '⚠️ 處理失敗：' + (err && err.message ? err.message : err));
    }
  }
}

function handleEvent_(event) {
  if (event.type !== 'message') return;

  // LINE 逾時會重送同一個事件，沒去重會重複記錄
  if (isDuplicate_(event.webhookEventId)) {
    console.log('略過重複事件 %s', event.webhookEventId);
    return;
  }

  var userId = (event.source && event.source.userId) || '';
  if (!isAllowedUser_(userId)) {
    lineReply_(event.replyToken, '⚠️ 此帳號未在允許清單中。');
    return;
  }

  var message = event.message || {};
  var items;
  var source;
  var rawText = '';

  if (message.type === 'text') {
    rawText = message.text || '';
    if (handleCommand_(rawText, event.replyToken)) return;
    source = 'text';
    items = geminiParseText_(rawText);
  } else if (message.type === 'image') {
    source = 'image';
    rawText = '(圖片 ' + message.id + ')';
    var img = lineFetchMessageContent_(message.id);
    items = geminiParseImage_(img.base64, img.mimeType);
  } else {
    lineReply_(event.replyToken, '目前只看得懂文字和圖片喔。');
    return;
  }

  if (!items.length) {
    lineReply_(event.replyToken, '🤔 沒有讀到待辦事項，可以說得更具體一點嗎？\n例如「明天下午三點要開會」');
    return;
  }

  lineReply_(event.replyToken, saveItems_(items, { source: source, userId: userId, rawText: rawText }));
}

/** 寫入試算表與行事曆，回傳要回覆給使用者的文字。 */
function saveItems_(items, meta) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // 避免多筆訊息同時 appendRow 互相蓋掉
  try {
    var lines = ['⭕ 已記錄'];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var rowIndex = appendTodo_(item, meta);

      var calendarNote = '';
      try {
        var eventId = createEvent_(item);
        if (eventId) {
          setCalendarEventId_(rowIndex, eventId);
          calendarNote = item.time ? '　📅 已建立提醒' : '　📅 已建立整天事件';
        }
      } catch (err) {
        // 行事曆失敗不該讓已寫入試算表的紀錄看起來像整筆失敗
        console.error('建立行事曆失敗：%s', err && err.message);
        calendarNote = '　⚠️ 行事曆建立失敗';
      }

      lines.push(
        '・' + item.summary +
        '（' + item.category + '）' +
        (item.date ? '\n　🗓 ' + item.date + (item.time ? ' ' + item.time : '') : '\n　🗓 未指定日期') +
        (calendarNote ? '\n' + calendarNote : '')
      );
    }
    return lines.join('\n');
  } finally {
    lock.releaseLock();
  }
}

/** 少數不需要經過 AI 的指令。回傳 true 表示已處理完畢。 */
function handleCommand_(text, replyToken) {
  var t = text.trim();
  if (t === '說明' || t === 'help' || t === '?' || t === '？') {
    lineReply_(replyToken, [
      '📝 用法',
      '直接傳一句話就好，例如：',
      '・明天下午三點要開會',
      '・明天早上十點要交房租，記得轉帳給房東',
      '也可以直接傳行程截圖，我會讀出來。',
      '',
      '輸入「清單」可看最近 5 筆。'
    ].join('\n'));
    return true;
  }
  if (t === '清單' || t === 'list') {
    lineReply_(replyToken, recentTodosText_(5));
    return true;
  }
  return false;
}

function recentTodosText_(n) {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return '目前沒有任何待辦。';
  var start = Math.max(2, last - n + 1);
  var rows = sheet.getRange(start, 1, last - start + 1, CONFIG.HEADERS.length).getValues();
  var out = ['📋 最近 ' + rows.length + ' 筆'];
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    out.push('・' + r[1] + '（' + r[2] + '）' + (r[3] ? ' ' + r[3] + ' ' + r[4] : ''));
  }
  return out.join('\n');
}

function isDuplicate_(webhookEventId) {
  if (!webhookEventId) return false;
  var cache = CacheService.getScriptCache();
  var key = 'evt_' + webhookEventId;
  if (cache.get(key)) return true;
  cache.put(key, '1', CONFIG.DEDUPE_TTL_SECONDS);
  return false;
}

function isAllowedUser_(userId) {
  var allow = prop_('ALLOWED_USER_IDS');
  if (!allow) return true;
  return allow.split(',').map(function (s) { return s.trim(); })
    .filter(String).indexOf(userId) !== -1;
}
