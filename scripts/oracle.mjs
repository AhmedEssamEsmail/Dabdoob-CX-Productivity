/**
 * Golden-oracle harness: runs the legacy Apps Script rule engines verbatim inside a
 * node:vm context, with the Google services they touch faked and every data seam
 * (settings, roster, tables, spreadsheets) driven by an injected __FIXTURES__ object.
 *
 * The point is equivalence proof, not simulation breadth: everything the ported
 * functions read is injectable, and everything they write is recorded (__WRITES__).
 * `Date` inside the vm is pinned to fixtures.nowMs so ISO outputs are deterministic.
 *
 * Usage (tests/golden/helpers-oracle.ts wraps this):
 *   const oracle = createOracle(['ProdValidation.js', 'ProdCore.js', 'productivity.js', 'ProductivityApp.js'])
 *   oracle.call('prodDetectFlags_', [intervals, casesByEmail, rule], fixtures) -> plain result
 */
import vm from 'node:vm'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const LEGACY_DIR =
  process.env.LEGACY_DIR ||
  ['original_deprecated', 'Productivity_Depricated']
    .map((d) => path.resolve(HERE, '..', '..', d))
    .find((d) => fs.existsSync(path.join(d, 'Config.js'))) ||
  path.resolve(HERE, '..', '..', 'original_deprecated')

/**
 * All legacy app dirs a bare filename can resolve against (the oracle loads
 * shared + module files for whichever app a module shard is porting).
 */
export const LEGACY_DIRS = (() => {
  const parent = path.resolve(LEGACY_DIR, '..')
  const dirs = [LEGACY_DIR]
  try {
    for (const d of fs.readdirSync(parent)) {
      const p = path.join(parent, d)
      if (/_deprecated$/i.test(d) && fs.statSync(p).isDirectory()) dirs.push(p)
    }
  } catch {
    /* no sibling dirs — LEGACY_DIR stands alone */
  }
  return dirs
})()

/** Legacy sources available to load verbatim: bare names search LEGACY_DIRS in order. */
export function legacyFile(name) {
  for (const dir of LEGACY_DIRS) {
    const p = path.join(dir, name)
    if (fs.existsSync(p)) return p
  }
  const p = path.join(LEGACY_DIR, name)
  if (!fs.existsSync(p)) throw new Error(`legacy file missing: ${name} (searched ${LEGACY_DIRS.join(', ')})`)
  return p
}

/**
 * The fake GAS environment, run inside the vm BEFORE the legacy files.
 * Pure JS only — no host imports.
 */
/**
 * Run before PRELUDE as its own script: captures the realm's real Date before PRELUDE's
 * `function Date()` hoists over it.
 */
const PRELUDE_A = String.raw`
var __RealDate = globalThis.Date;
`;

const PRELUDE = String.raw`
// ---------------------------------------------------------------- deterministic time
function __nowMs__() {
  return __FIXTURES__ && __FIXTURES__.nowMs !== undefined ? __FIXTURES__.nowMs : __RealDate.now();
}
function Date() {
  var args = Array.prototype.slice.call(arguments);
  if (!args.length) args = [__nowMs__()];
  return Reflect.construct(__RealDate, args, Date);
}
Date.prototype = __RealDate.prototype;
Date.now = function () { return __nowMs__(); };
Date.parse = function (s) { return __RealDate.parse(s); };
Date.UTC = function () { return __RealDate.UTC.apply(__RealDate, arguments); };

// ---------------------------------------------------------------- fixtures
var __FIXTURES__ = {};
var __WRITES__ = [];
var __LOGS__ = [];

// ---------------------------------------------------------------- Services
var Session = {
  getScriptTimeZone: function () { return __FIXTURES__.scriptTz || 'Africa/Cairo'; },
  getActiveUser: function () { return { getEmail: function () { return __FIXTURES__.userEmail || ''; } }; },
  getEffectiveUser: function () { return { getEmail: function () { return __FIXTURES__.effectiveUserEmail || ''; } }; },
  getTemporaryActiveUserKey: function () { return 'k'; }
};

function __tzParts__(ms, tz) {
  var dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  var parts = {};
  dtf.formatToParts(new __RealDate(ms)).forEach(function (p) { parts[p.type] = p.value; });
  return parts;
}
function __tzOffsetMin__(ms, tz) {
  var p = __tzParts__(ms, tz);
  var wall = __RealDate.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((wall - ms) / 60000);
}
var Utilities = {
  formatDate: function (d, tz, pattern) {
    var ms = d instanceof Date ? d.getTime()
      : (d instanceof __RealDate ? d.getTime() : __RealDate.parse(String(d)));
    var p = __tzParts__(ms, tz);
    var off = __tzOffsetMin__(ms, tz);
    var sign = off < 0 ? '-' : '+';
    var abs = Math.abs(off);
    var z = sign + ('0' + Math.floor(abs / 60)).slice(-2) + ('0' + (abs % 60)).slice(-2);
    return String(pattern)
      .replace(/yyyy/g, p.year).replace(/MM/g, p.month).replace(/dd/g, p.day)
      .replace(/HH/g, p.hour).replace(/mm/g, p.minute).replace(/ss/g, p.second)
      .replace(/\bH\b/g, String(+p.hour)).replace(/Z/g, z);
  },
  newBlob: function (bytes) {
    return { getDataAsString: function () { return typeof bytes === 'string' ? bytes : String(bytes); } };
  },
  base64DecodeWebSafe: function (s) { return s; },
  parseCsv: function (text) {
    var rows = [], row = [], cell = '', inQ = false, s = String(text);
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (inQ) {
        if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  },
  sleep: function () {},
  getUuid: function () { return '00000000-0000-4000-8000-000000000000'; }
};

var __CACHE__ = {};
var CacheService = {
  getScriptCache: function () {
    return {
      get: function (k) { return k in __CACHE__ ? __CACHE__[k] : null; },
      put: function (k, v) { __CACHE__[k] = v; },
      remove: function (k) { delete __CACHE__[k]; },
      getAll: function (keys) { var m = {}; keys.forEach(function (k) { m[k] = k in __CACHE__ ? __CACHE__[k] : null; }); return m; },
      putAll: function (m) { var self = this; Object.keys(m).forEach(function (k) { __CACHE__[k] = m[k]; }); }
    };
  },
  getUserCache: function () { return this.getScriptCache(); },
  getDocumentCache: function () { return this.getScriptCache(); }
};

var __PROPS__ = {};
var PropertiesService = {
  getScriptProperties: function () {
    return {
      getProperty: function (k) { return k in __PROPS__ ? __PROPS__[k] : null; },
      setProperty: function (k, v) { __PROPS__[k] = String(v); },
      getProperties: function () { return Object.assign({}, __PROPS__); },
      deleteProperty: function (k) { delete __PROPS__[k]; },
      setProperties: function (m) { Object.keys(m).forEach(function (k) { __PROPS__[k] = String(m[k]); }); }
    };
  },
  getUserProperties: function () { return this.getScriptProperties(); },
  getDocumentProperties: function () { return this.getScriptProperties(); }
};

var LockService = {
  getScriptLock: function () { return { tryLock: function () { return true; }, releaseLock: function () {}, hasLock: function () { return true; }, waitLock: function () {} }; },
  getUserLock: function () { return this.getScriptLock(); },
  getDocumentLock: function () { return this.getScriptLock(); }
};

// ---------------------------------------------------------------- fake sheets
// fixtures.spreadsheets: { ssId: { tabName: rows[][] } }; fixtures.data = the Core spreadsheet.
// A missing tab -> null from getSheetByName. Cells are raw values (strings, numbers, Dates).
function __mkRange__(cells, r, c, nr, nc) {
  var read = function () {
    var out = [];
    for (var i = 0; i < nr; i++) {
      var row = cells[r - 1 + i] || [];
      var vals = [];
      for (var j = 0; j < nc; j++) vals.push(c - 1 + j < row.length ? row[c - 1 + j] : '');
      out.push(vals);
    }
    return out;
  };
  return {
    getValues: read,
    getValue: function () { return read()[0][0]; },
    setValues: function (vals) {
      for (var i = 0; i < vals.length; i++) {
        var rr = r - 1 + i;
        while (cells.length <= rr) cells.push([]);
        var row = cells[rr];
        for (var j = 0; j < vals[i].length; j++) row[c - 1 + j] = vals[i][j];
      }
    },
    setValue: function (v) { this.setValues([[v]]); },
    setNumberFormat: function () {},
    clearContent: function () {
      for (var i = 0; i < nr; i++) {
        var row = cells[r - 1 + i]; if (!row) continue;
        for (var j = 0; j < nc; j++) if (c - 1 + j < row.length) row[c - 1 + j] = '';
      }
    },
    clear: function () { this.clearContent(); }
  };
}
function __mkSheet__(name, cells) {
  var sh = {
    __name: name, __cells: cells,
    getName: function () { return name; },
    getLastRow: function () { return cells.length; },
    getLastColumn: function () { var m = 0; cells.forEach(function (r) { if (r.length > m) m = r.length; }); return m; },
    getMaxRows: function () { return Math.max(cells.length, 2) + 1000; },
    getMaxColumns: function () { return 26; },
    getRange: function (a, b, c, d) {
      if (typeof a === 'string') {
        // A1 notation: 'B4' or 'A1:C3'
        var m = a.match(/^([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?$/)
        if (!m) throw new Error('bad range: ' + a)
        var colOf = function (s) { var n = 0; for (var i = 0; i < s.length; i++) n = n * 26 + (s.toUpperCase().charCodeAt(i) - 64); return n }
        var r0 = +m[2], c0 = colOf(m[1])
        var nr = m[4] ? +m[4] - r0 + 1 : 1
        var nc = m[3] ? colOf(m[3]) - c0 + 1 : 1
        return __mkRange__(cells, r0, c0, nr, nc)
      }
      return __mkRange__(cells, a, b, c === undefined ? 1 : c, d === undefined ? 1 : d)
    },
    getDataRange: function () { return __mkRange__(cells, 1, 1, Math.max(cells.length, 1), Math.max(sh.getLastColumn(), 1)); },
    appendRow: function (vals) { cells.push(vals.slice()); },
    deleteRows: function (start, n) { cells.splice(start - 1, n === undefined ? 1 : n); },
    deleteRow: function (r) { cells.splice(r - 1, 1); },
    deleteColumns: function (c, n) { cells.forEach(function (row) { row.splice(c - 1, n); }); },
    insertRowsAfter: function (after, n) { for (var i = 0; i < n; i++) cells.splice(after, 0, []); },
    insertColumnsAfter: function (after, n) { cells.forEach(function (row) { for (var i = 0; i < n; i++) row.splice(after, 0, ''); }); },
    setFrozenRows: function () {},
    hideRow: function () {}
  };
  return sh;
}
function __mkSs__(id, tabs) {
  return {
    __id: id, __tabs: tabs,
    getId: function () { return id; },
    getSheetByName: function (n) { return n in tabs ? __mkSheet__(n, tabs[n]) : null; },
    insertSheet: function (n) { tabs[n] = []; return __mkSheet__(n, tabs[n]); },
    getSheets: function () { return Object.keys(tabs).map(function (k) { return __mkSheet__(k, tabs[k]); }); }
  };
}
function __bookFor__(id) {
  var tabs = __FIXTURES__.spreadsheets && __FIXTURES__.spreadsheets[id];
  if (!tabs && id === '__data__') tabs = __FIXTURES__.data || {};
  if (!tabs) { tabs = {}; if (__FIXTURES__.spreadsheets) __FIXTURES__.spreadsheets[id] = tabs; }
  return __mkSs__(id, tabs);
}
var SpreadsheetApp = {
  openById: function (id) { return __bookFor__(String(id)); },
  create: function (title) {
    var id = 'created_' + title.replace(/\W+/g, '_');
    if (!__FIXTURES__.spreadsheets) __FIXTURES__.spreadsheets = {};
    __FIXTURES__.spreadsheets[id] = {};
    return __bookFor__(id);
  },
  flush: function () {},
  getActiveSpreadsheet: function () { return __bookFor__('__data__'); },
  getUi: function () { throw new Error('no ui'); },
  BorderStyle: {}, WrapStrategy: {}
};

var ScriptApp = {
  getProjectTriggers: function () { return []; },
  newTrigger: function () { return { timeBased: function () { var t = {}; ['atHour', 'nearMinute', 'everyDays', 'everyMinutes', 'everyHours', 'inTimezone', 'onMonthDay'].forEach(function (k) { t[k] = function () { return t; }; }); t.create = function () { return {}; }; return t; } }; },
  deleteTrigger: function () {},
  getOAuthToken: function () { return 'token'; }
};

var Logger = { log: function (m) { __LOGS__.push(String(m)); } };
var console = { log: function () { __LOGS__.push(Array.prototype.slice.call(arguments).join(' ')); }, warn: function () {}, error: function () {} };

var Gmail = { Users: { Messages: { list: function () { return { messages: [] }; }, get: function () { return {}; }, Attachments: { get: function () { return {}; } } } } };
var MailApp = { sendEmail: function () {} };
var UrlFetchApp = { fetch: function () { throw new Error('no network in oracle'); } };
var DriveApp = {};

// V2 table header defs whose owning files are outside the ported set (Queue.js,
// DailyReport.js, FreshdeskSync.js, Scheduler apps). dqTableDefs_() only registers a
// table when its header var exists, so without these every store read of these
// tables returns [] — which would silently hide store-seam diffs. Column lists
// mirror what ensureColumns_ unions into the fixture tabs anyway.
var DQ_SNAPSHOT_HEADERS = ['slot_date', 'slot', 'queue', 'open', 'over_top', 'by_status_json', 'bands_json', 'created_today', 'resolved_today', 'stale', 'as_of'];
var DQ_QUEUE_NOW_HEADERS = ['kind', 'queue', 'open', 'actionable', 'unassigned', 'oldest_h', 'bands_json', 'over_top', 'created_today', 'resolved_today', 'by_status_json', 'source_as_of', 'stale'];
var FD_TICKET_HEADERS = ['ticket_id', 'status', 'group_name', 'created_at', 'resolved_at', 'closed_at', 'channel', 'requester_id', 'agent_id', 'agent_email', 'tl_email'];
var FD_ESC_SEEN_HEADERS = ['ticket_id', 'seen_at'];
var DQ_AGING_HEADERS = ['ticket_id', 'group_name', 'status', 'created_at', 'age_h', 'band', 'ours'];
var DQ_INFLOW_HEADERS = ['date', 'queue', 'created', 'resolved', 'open_end', 'by_status_json'];
var DQ_INFLOW_HOURLY_HEADERS = ['date', 'hour', 'queue', 'created', 'resolved', 'calls', 'answered'];
var DQ_INFLOW_ROLLUP_HEADERS = ['period', 'queue', 'created', 'resolved', 'open_end'];
var DQ_AGENT_PERF_HEADERS = ['date', 'email', 'calls', 'minutes', 'tickets', 'chats'];
var DQ_AGENT_DAILY_HEADERS = ['date', 'email', 'metric', 'value'];
var SC_MONTH_HEADERS = ['month', 'email', 'score', 'rank', 'kpi_json', 'computed_at'];
var SC_DAILY_HEADERS = ['date', 'email', 'matrix_day', 'inb_target', 'inb_achieved', 'txt_target', 'txt_achieved', 'wa_target', 'wa_achieved', 'audits', 'score_x_audits'];
var SC_BEHAVIOUR_HEADERS = ['date', 'email', 'metric', 'value'];
var TLP_HEADERS = {
  tlp_shifts: ['key', 'date', 'tl_email', 'shift_start', 'shift_end', 'queue_json', 'updated_at'],
  tlp_perf_daily: ['date', 'tl_email', 'metric', 'value'],
  tlp_perf_weekly: ['week', 'tl_email', 'metric', 'value'],
};
var MD_HEADERS = {};
var QA_HEADERS = {};

// Health.js beats (called by dqStep_ / job wrappers); inert here.
function hbBeat_() {}
function hbFlush_() {}
function hbTime_(v) { var t = v ? __RealDate.parse(String(v instanceof Date ? v.toISOString() : v)) : NaN; return isFinite(t) ? new __RealDate(t) : null; }
function hbDateKey_(d) { return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); }

// Function markers for args that are callbacks on the port side: '@@fn:NAME' resolves to
// globalThis.NAME inside the vm. The named test doubles below mirror helpers-oracle.ts.
function __fn_tlName__(e) { return 'TL ' + e; }
function __fn_offsetMs__(ms) { return 10800000; } // Asia/Kuwait fixed offset
function __fn_prodDateKey_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function __fn_dir_name__(e) { return 'Name ' + e; }
function __fn_dir_managerOf__(e) { return 'tl@dabdoob.com'; }
function __fn_scope_true__(e) { return true; }
function __fn_kctx__(email) { return { probationMonth: 1, olCases: 0, leaveIneligible: false }; }
// dir.person seam for tphCheckAgent_ / pwDirectory_-shaped args: reads fixtures.dirPersons.
function __fn_dirPerson__(e) {
  var m = (__FIXTURES__ && __FIXTURES__.dirPersons) || {};
  return m[String(e).trim().toLowerCase()] || null;
}
// Deterministic tphEditDay_ edit double (mirrors the port-side closure in tests/golden/tph.test.ts).
function __fn_tphEdit__(logged, src) {
  logged['40'] = 'calls'; src['40'] = 'grid';
  logged['41'] = 'wa+calls'; src['41'] = 'grid';
  delete logged['32']; delete src['32'];
}
// scAdd_ mutates its bucket and returns nothing — expose the post-mutation accumulator.
function __fn_scAddAcc__(a, r) { scAdd_(a, r); return a; }

// readTable_'s memo + data book live in Repo.js (loaded verbatim); only the props' seed matters.
`;

/**
 * Postlude: wraps the writer functions so every upsert/append is recorded.
 */
const POSTLUDE = String.raw`
(function () {
  var rec = function (name) {
    if (typeof globalThis[name] !== 'function') return;
    var orig = globalThis[name];
    globalThis[name] = function () {
      var args = Array.prototype.slice.call(arguments);
      __WRITES__.push({ fn: name, args: args });
      return orig.apply(null, args);
    };
  };
  ['dqUpsert_', 'dqUpsertIn_', 'dqAppend_', 'dqRewrite_', 'dqLogRun_'].forEach(rec);
})();
`;

/** Reset per-call memo state inside the context (mirrors a fresh Apps Script execution). */
const RESET = String.raw`
function __reset__(fx) {
  __FIXTURES__ = fx || {};
  if (!__FIXTURES__.data) __FIXTURES__.data = {};
  if (!__FIXTURES__.spreadsheets) __FIXTURES__.spreadsheets = {};
  __FIXTURES__.spreadsheets['__data__'] = __FIXTURES__.data;
  __WRITES__ = [];
  __LOGS__ = [];
  __CACHE__ = {};
  __PROPS__ = { CC_DATA_SPREADSHEET_ID: '__data__' };
  if (__FIXTURES__.props) Object.keys(__FIXTURES__.props).forEach(function (k) { __PROPS__[k] = __FIXTURES__.props[k]; });
  // Per-execution memos restored to their initial values (an empty object is NOT a
  // null check: configAll_ returns CONFIG_MEMO_ when truthy, so {} would serve forever).
  var init = {
    CONFIG_MEMO_: null, WC_STATE_: null, VA_MEMO_: null, dataSpreadsheetCache_: null,
    TABLE_MEMO_: {}, PROD_ROWS_MEMO_: {}, DQ_SS_MEMO: {},
    VA_SYSTEM_: false, VA_BYPASS_: false, VA_RESOLVING_: false,
    DQ_SHEET_HDR_: { sh: null, headers: null }
  };
  Object.keys(init).forEach(function (n) {
    if (n in globalThis) globalThis[n] = JSON.parse(JSON.stringify(init[n]));
  });
  if ('DQ_SHEET_HDR_' in globalThis) globalThis.DQ_SHEET_HDR_ = { sh: null, headers: null };
  if ('DQ_WRITE_GEN_' in globalThis) globalThis.DQ_WRITE_GEN_ = globalThis.DQ_WRITE_GEN_ + 1;
}
function __rebind__(v) {
  if (typeof v === 'string' && v.indexOf('@@fn:') === 0) return globalThis[v.slice(5)];
  if (typeof v === 'string' && v.indexOf('@@ss:') === 0) return __bookFor__(v.slice(5));
  if (typeof v === 'string' && v.indexOf('@@ms:') === 0) return new __RealDate(+v.slice(5));
  if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) v[i] = __rebind__(v[i]); return v; }
  if (v && typeof v === 'object') { Object.keys(v).forEach(function (k) { v[k] = __rebind__(v[k]); }); return v; }
  return v;
}
function __invoke__(fnName, argsJson) {
  var args = __rebind__(JSON.parse(argsJson || '[]'));
  var f = globalThis[fnName];
  if (typeof f !== 'function') throw new Error('oracle: ' + fnName + ' is not loaded');
  return f.apply(null, args);
}
function __writes__() { return __WRITES__; }
function __logs__() { return __LOGS__; }
`;

/**
 * @typedef {Object} OracleFixtures
 * @property {Object<string,*>} [settings] config keys -> raw values (non-strings JSON.stringify'd into Config).
 * @property {Object<string,Array<Array<*>>>} [data] Core spreadsheet tabs (Roster, Config generated, holidays, ViewAs, queue_status_submissions, ...).
 * @property {Object<string, Object<string, Array<Array<*>>>>} [spreadsheets] ssId -> tab -> rows.
 * @property {Object<string,string>} [props] script properties (CC_DATA_SPREADSHEET_ID seeded automatically).
 * @property {string} [userEmail] Session.getActiveUser().
 * @property {string} [effectiveUserEmail] Session.getEffectiveUser().
 * @property {number} [nowMs] freezes new Date()/Date.now() inside the vm.
 * @property {string} [scriptTz] Session.getScriptTimeZone(), 'Africa/Cairo' by default.
 */

/**
 * Creates an oracle context: PRELUDE stubs -> legacy files (verbatim) -> POSTLUDE recorders.
 * files: legacy file names (in LEGACY_DIR) or absolute paths.
 */
export function createOracle(files) {
  const ctx = vm.createContext({})
  vm.runInContext(PRELUDE_A, ctx, { filename: 'prelude-a.js' })
  vm.runInContext(PRELUDE, ctx, { filename: 'prelude.js' })
  for (const f of files) {
    const p = path.isAbsolute(f) ? f : legacyFile(f)
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: path.basename(p) })
  }
  vm.runInContext(POSTLUDE + RESET, ctx, { filename: 'postlude.js' })

  function settingsToConfig(fx) {
    // configAll_ (Config.js, verbatim) reads the Config tab of the data spreadsheet;
    // values are stored the way setConfig_ writes them (JSON for non-strings).
    const data = { ...(fx.data || {}) }
    const rows = [['key', 'value', 'description', 'updated_by', 'updated_at']]
    for (const [k, v] of Object.entries(fx.settings || {})) {
      rows.push([k, typeof v === 'string' ? v : JSON.stringify(v), '', 'oracle', ''])
    }
    data.Config = rows
    return { ...fx, data }
  }

  return {
    context: ctx,
    /** Calls fnName(...args) with fixtures installed; args/result cross as JSON-safe values. */
    call(fnName, args = [], fixtures = {}) {
      vm.runInContext(`__reset__(${JSON.stringify(settingsToConfig(fixtures))})`, ctx)
      // Args may contain host-side Dates / class bits; JSON round-trip keeps it realm-clean.
      const argsJson = JSON.stringify(args)
      return vm.runInContext(`__invoke__(${JSON.stringify(fnName)}, ${JSON.stringify(argsJson)})`, ctx)
    },
    /** Recorded writer calls since the last call(): [{ fn, args }] (JSON-parsed). */
    writes() {
      return JSON.parse(vm.runInContext('JSON.stringify(__writes__())', ctx))
    },
    logs() {
      return JSON.parse(vm.runInContext('JSON.stringify(__logs__())', ctx))
    },
    /**
     * The row objects dqReadObjects_ yields for a V2 store table (no _row; every
     * def/ensureColumns_ header present). Feed these to the port so both sides see
     * the identical input shape.
     */
    objects(name, fixtures = {}, year = null) {
      vm.runInContext(`__reset__(${JSON.stringify(settingsToConfig(fixtures))})`, ctx)
      return JSON.parse(
        vm.runInContext(
          `JSON.stringify(dqReadObjects_(${JSON.stringify(name)}, ${JSON.stringify(year)}, { missingOk: true }))`,
          ctx
        )
      )
    },
    /** The row objects readTable_ yields for a data-spreadsheet tab (with _row). */
    table(name, fixtures = {}) {
      vm.runInContext(`__reset__(${JSON.stringify(settingsToConfig(fixtures))})`, ctx)
      return JSON.parse(vm.runInContext(`JSON.stringify(readTable_(${JSON.stringify(name)}))`, ctx))
    },
    /** Evaluates an arbitrary expression inside the context (debug). */
    eval(code) {
      return vm.runInContext(code, ctx)
    },
  }
}

/**
 * Default fixture: the settings the tested legacy code reads, with the V2 store ids
 * pointing at named fake spreadsheets the caller fills in.
 */
export function baseFixtures(over = {}) {
  const settings = {
    business_tz: 'Asia/Kuwait',
    data_tz: 'Africa/Cairo',
    activity_local_tz: 'Asia/Kuwait',
    productivity_fallback_id: 'prod-fallback',
    fd_activity_ss_id: 'fd-activity',
    daily_report_ss_id: 'daily-report',
    ss_productivity_id: 'prod-store',
    ss_live_id: 'live-store',
    ss_tickets_id: 'tickets-store',
    ss_quality_id: 'quality-store',
    ss_data_2025_id: 'data-2025',
    ss_data_2026_id: 'data-2026',
    ss_data_2027_id: 'data-2027',
    allowed_domain: 'dabdoob.com',
    admin_emails: 'admin@dabdoob.com',
    ...(over.settings || {}),
  }
  return { ...over, settings }
}
