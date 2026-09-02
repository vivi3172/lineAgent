/**
 * Google 試算表存取。
 */

function getSheet_() {
  var ss = SpreadsheetApp.openById(requireProp_('SHEET_ID'));
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    writeHeader_(sheet);
  }
  return sheet;
}

function writeHeader_(sheet) {
  sheet.getRange(1, 1, 1, CONFIG.HEADERS.length)
    .setValues([CONFIG.HEADERS])
    .setFontWeight('bold')
    .setBackground('#e8eaed');
  sheet.setFrozenRows(1);
}

/**
 * 寫入一筆待辦，回傳列號。
 * 日期／時間都以純文字寫入，避免試算表自動轉成本地格式後對不起來。
 */
function appendTodo_(item, meta) {
  var sheet = getSheet_();
  var row = [
    Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
    item.summary,
    item.category,
    item.date || '',
    item.time || '',
    '待辦',
    (meta && meta.source) || '',
    (meta && meta.userId) || '',
    (meta && meta.rawText) || '',
    ''
  ];
  sheet.appendRow(row);
  var rowIndex = sheet.getLastRow();
  sheet.getRange(rowIndex, 4, 1, 2).setNumberFormat('@'); // 日期、時間欄位保持文字
  return rowIndex;
}

function setCalendarEventId_(rowIndex, eventId) {
  var col = CONFIG.HEADERS.indexOf('行事曆事件ID') + 1;
  if (col > 0) {
    getSheet_().getRange(rowIndex, col).setValue(eventId);
  }
}

/**
 * 手動執行一次即可：建立工作表與標題列，並完成 Google 授權。
 */
function initSheet() {
  var sheet = getSheet_();
  writeHeader_(sheet);
  sheet.autoResizeColumns(1, CONFIG.HEADERS.length);
  console.log('已初始化工作表「%s」，欄位：%s', CONFIG.SHEET_NAME, CONFIG.HEADERS.join(' / '));
}
