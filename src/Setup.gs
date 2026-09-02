/**
 * 測試與檢查用的函式，在 Apps Script 編輯器手動執行。
 */

/**
 * STEP 2.1：測試 AI → 試算表。
 * 執行後到試算表確認是否多了一列「交房租 / 繳費 / 明天日期 / 10:00」。
 */
function testParseSample() {
  var text = '明天早上十點要交房租，記得轉帳給房東';
  var items = geminiParseText_(text);
  console.log('Gemini 解析結果：%s', JSON.stringify(items, null, 2));
  if (!items.length) throw new Error('解析不到任何待辦，請檢查 GEMINI_API_KEY 與模型名稱');
  console.log(saveItems_(items, { source: 'test', userId: '', rawText: text }));
}

/** 只測 AI 解析，不寫入試算表與行事曆。 */
function testParseOnly() {
  console.log(JSON.stringify(geminiParseText_('下星期五下午兩點提醒我開會'), null, 2));
}

/** 逐項檢查設定是否齊全，部署前先跑這個。 */
function checkSetup() {
  var results = [];

  ['GEMINI_API_KEY', 'SHEET_ID', 'LINE_CHANNEL_ACCESS_TOKEN'].forEach(function (key) {
    results.push((prop_(key) ? '✅ ' : '❌ ') + key + (prop_(key) ? ' 已設定' : ' 未設定'));
  });

  try {
    var sheet = getSheet_();
    results.push('✅ 試算表可存取，工作表「' + sheet.getName() + '」共 ' + sheet.getLastRow() + ' 列');
  } catch (e) {
    results.push('❌ 試算表：' + e.message);
  }

  try {
    results.push('✅ 日曆可存取：' + getCalendar_().getName());
  } catch (e) {
    results.push('❌ 日曆：' + e.message);
  }

  try {
    var items = geminiParseText_('明天下午三點要開會');
    results.push(items.length
      ? '✅ Gemini 解析正常：' + JSON.stringify(items[0])
      : '⚠️ Gemini 有回應但解析不到待辦');
  } catch (e) {
    results.push('❌ Gemini：' + e.message);
  }

  results.push(prop_('WEBHOOK_TOKEN')
    ? '✅ WEBHOOK_TOKEN 已設定（Webhook URL 記得帶 ?token=...）'
    : '⚠️ 未設定 WEBHOOK_TOKEN，任何知道網址的人都能寫入你的試算表');

  console.log(results.join('\n'));
  return results.join('\n');
}
