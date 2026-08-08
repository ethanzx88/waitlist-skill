/**
 * Waitlist 收集端 —— 粘到你自己的 Google Sheet 里，部署成 Web App。
 *
 * 数据只进你自己的表格，不经过任何第三方服务，也不需要谁的 API key。
 * 朋友拿这套模板去用，各自建各自的表，互不相干。
 *
 * 部署步骤见 references/setup-sheet.md（4 步，两分钟）。
 */

const SHEET_NAME = 'waitlist';

const HEADERS = [
  '时间',
  '事件',
  '邮箱',
  '现在怎么解决这个问题',
  '来源',
  '页面',
  '浏览器',
  '项目',
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const data = parseBody(e);
    const sheet = getSheet();

    sheet.appendRow([
      new Date(),
      data.event || 'signup',
      data.email || '',
      data.context || '',
      data.referrer || '',
      data.page || '',
      data.ua || '',
      data.project || '',
    ]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** 浏览器直接打开这个 URL 时给个确认页，方便你验证部署成功。 */
function doGet() {
  return ContentService
    .createTextOutput('waitlist endpoint is live')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * 落地页用 text/plain 发 JSON（这样是 CORS simple request，不触发 preflight）。
 * 同时兼容普通表单的 urlencoded 提交。
 */
function parseBody(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      // 不是 JSON，落到下面的 parameter 分支
    }
  }
  return (e && e.parameter) || {};
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
