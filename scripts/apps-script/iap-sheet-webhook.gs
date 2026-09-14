/**
 * IAP Monitoring — push edit langsung dari Google Sheets ke Supabase.
 *
 * Dipasang di spreadsheet Tracker sebagai installable trigger. Setiap edit sel,
 * insert row, atau delete row memanggil Edge Function `iap-google-mirror`
 * dengan {"force":true}, sehingga siklus mirror jalan saat itu juga dan tidak
 * menunggu cooldown 50 detik atau cron menit berikutnya.
 *
 * Setup (sekali):
 *   1. Extensions > Apps Script pada spreadsheet Tracker, tempel file ini.
 *   2. Project Settings > Script properties, isi:
 *        MIRROR_URL  = https://<project>.supabase.co/functions/v1/iap-google-mirror
 *        SYNC_TOKEN  = nilai yang sama dengan IAP_SYNC_TOKEN / vault iap_sync_token
 *        TRACKER_TAB = Tracker      (opsional, default "Tracker")
 *   3. Jalankan installTriggers() satu kali dan setujui permission-nya.
 *   4. Jalankan checkConfig() untuk memastikan webhook terjawab 200.
 */

/** Jeda untuk menggabungkan rentetan ketikan menjadi satu siklus sync. */
var COALESCE_MS = 1500;
/** Sync di-skip saat cron/worker lain memegang lease; coba lagi sebentar. */
var SKIP_RETRY_MS = 2500;
var MAX_ATTEMPTS = 4;
/** Batas putaran agar edit terus-menerus tidak menahan trigger selamanya. */
var MAX_ROUNDS = 3;

function onSheetEdit(event) {
  var sheet = event && event.range ? event.range.getSheet() : SpreadsheetApp.getActiveSheet();
  if (!isTrackerTab_(sheet)) return;
  requestSync_();
}

function onSheetChange(event) {
  // INSERT_ROW / REMOVE_ROW / REMOVE_GRID tidak terlihat oleh onEdit.
  var type = event && event.changeType ? event.changeType : '';
  if (['EDIT', 'INSERT_ROW', 'REMOVE_ROW', 'INSERT_GRID', 'REMOVE_GRID', 'OTHER'].indexOf(type) === -1) return;
  if (type !== 'REMOVE_GRID' && !isTrackerTab_(SpreadsheetApp.getActiveSheet())) return;
  requestSync_();
}

function isTrackerTab_(sheet) {
  return !!sheet && sheet.getName() === (config_().TRACKER_TAB || 'Tracker');
}

function config_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  if (!props.MIRROR_URL || !props.SYNC_TOKEN) {
    throw new Error('Script properties MIRROR_URL dan SYNC_TOKEN belum diisi.');
  }
  return props;
}

/**
 * Satu eksekusi saja yang boleh memanggil webhook. Trigger lain cukup menandai
 * `pending`; pemegang lock akan menyapunya sebelum selesai, sehingga edit yang
 * datang saat sync berjalan tidak pernah hilang.
 */
function requestSync_() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('pending', '1');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return;
  try {
    for (var round = 0; round < MAX_ROUNDS && props.getProperty('pending'); round++) {
      props.deleteProperty('pending');
      Utilities.sleep(COALESCE_MS);
      push_();
    }
  } finally {
    lock.releaseLock();
  }
}

function push_() {
  var settings = config_();
  var lastSkip = null;
  for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    var response = UrlFetchApp.fetch(settings.MIRROR_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-iap-sync-token': settings.SYNC_TOKEN },
      payload: JSON.stringify({ force: true }),
      muteHttpExceptions: true,
    });
    var code = response.getResponseCode();
    var text = response.getContentText() || '';
    if (code === 429 || code >= 500) {
      Utilities.sleep(Math.min(8000, 1000 * Math.pow(2, attempt)));
      continue;
    }
    if (code !== 200) throw new Error('Mirror menolak (' + code + '): ' + text.slice(0, 200));
    var body = {};
    try { body = JSON.parse(text); } catch (error) { body = {}; }
    // skipped berarti lease sedang dipegang cron, atau mirror sedang backoff
    // karena error. Backoff disengaja, jadi cukup dicatat, bukan dipaksa.
    if (!body.skipped) return body;
    lastSkip = body;
    Utilities.sleep(SKIP_RETRY_MS);
  }
  console.warn('Sync belum sempat berjalan setelah ' + MAX_ATTEMPTS + ' percobaan; cron akan menyusul.');
  return lastSkip;
}

/** Pasang ulang trigger dengan aman: yang lama dihapus dulu agar tidak dobel. */
function installTriggers() {
  var spreadsheet = SpreadsheetApp.getActive();
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    var name = existing[i].getHandlerFunction();
    if (name === 'onSheetEdit' || name === 'onSheetChange') ScriptApp.deleteTrigger(existing[i]);
  }
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(spreadsheet).onEdit().create();
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(spreadsheet).onChange().create();
  console.log('Trigger onEdit dan onChange terpasang untuk tab ' + (config_().TRACKER_TAB || 'Tracker') + '.');
}

/** Uji manual: memaksa satu siklus dan menampilkan jawabannya. */
function checkConfig() {
  console.log(JSON.stringify(push_()));
}
