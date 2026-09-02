/**
 * LINE Messaging API 相關操作。
 */

function lineToken_() {
  return requireProp_('LINE_CHANNEL_ACCESS_TOKEN');
}

/**
 * 用 replyToken 回覆訊息。
 * replyToken 只能用一次、且大約 1 分鐘內有效。
 */
function lineReply_(replyToken, text) {
  if (!replyToken) return;
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + lineToken_() },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: String(text).slice(0, 4900) }]
    }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    console.error('LINE reply 失敗 %s %s', res.getResponseCode(), res.getContentText());
  }
}

/**
 * 下載使用者傳來的圖片內容。
 * 注意網域是 api-data.line.me，不是 api.line.me。
 */
function lineFetchMessageContent_(messageId) {
  var res = UrlFetchApp.fetch(
    'https://api-data.line.me/v2/bot/message/' + encodeURIComponent(messageId) + '/content',
    {
      method: 'get',
      headers: { Authorization: 'Bearer ' + lineToken_() },
      muteHttpExceptions: true
    }
  );
  if (res.getResponseCode() !== 200) {
    throw new Error('取得圖片失敗：' + res.getResponseCode() + ' ' + res.getContentText());
  }
  var blob = res.getBlob();
  return {
    base64: Utilities.base64Encode(res.getContent()),
    mimeType: blob.getContentType() || 'image/jpeg'
  };
}
