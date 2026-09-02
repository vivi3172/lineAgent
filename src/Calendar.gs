/**
 * Google Calendar 提醒建立。
 */

function getCalendar_() {
  var id = prop_('CALENDAR_ID');
  if (id) {
    var cal = CalendarApp.getCalendarById(id);
    if (!cal) throw new Error('找不到日曆：' + id);
    return cal;
  }
  return CalendarApp.getDefaultCalendar();
}

/**
 * 依待辦建立行事曆事件，回傳 eventId；沒有日期則不建立、回傳 null。
 */
function createEvent_(item) {
  if (!item.date) return null;

  var title = '[' + item.category + '] ' + item.summary;
  var cal = getCalendar_();
  var event;

  if (item.time) {
    var start = parseLocalDateTime_(item.date, item.time);
    var end = new Date(start.getTime() + CONFIG.EVENT_DURATION_MINUTES * 60 * 1000);
    event = cal.createEvent(title, start, end, { description: item.note || '' });
    event.addPopupReminder(CONFIG.REMINDER_MINUTES_BEFORE);
  } else {
    if (!CONFIG.CREATE_ALLDAY_WHEN_NO_TIME) return null;
    event = cal.createAllDayEvent(title, parseLocalDateTime_(item.date, '00:00'),
      { description: item.note || '' });
  }

  return event.getId();
}

/**
 * 把 "2026-09-03" + "15:00" 依 CONFIG.TIMEZONE 轉成 Date。
 * 直接 new Date(字串) 會用指令碼所在時區解讀，跨時區時會差幾小時。
 */
function parseLocalDateTime_(dateStr, timeStr) {
  var offset = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'ZZZ'); // 例如 +0800
  var iso = dateStr + 'T' + timeStr + ':00' + offset.slice(0, 3) + ':' + offset.slice(3);
  var d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error('無法解析日期時間：' + dateStr + ' ' + timeStr);
  return d;
}
