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
  process.env.LEGACY_DIR || path.resolve(HERE, '..', '..', 'original_deprecated')

/** Legacy sources available to load verbatim. */
export function legacyFile(name) {
  const p = path.join(LEGACY_DIR, name)
  if (!fs.existsSync(p)) throw new Error(`legacy file missing: ${p}`)
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
  var names = ['CONFIG_MEMO_', 'TABLE_MEMO_', 'PROD_ROWS_MEMO_', 'DQ_SS_MEMO', 'WC_STATE_',
    'VA_MEMO_', 'VA_SYSTEM_', 'VA_BYPASS_', 'VA_RESOLVING_', 'dataSpreadsheetCache_'];
  names.forEach(function (n) {
    if (n in globalThis) {
      var v = globalThis[n];
      globalThis[n] = (v && typeof v === 'object' && n !== 'WC_STATE_' && n !== 'VA_MEMO_' && n !== 'dataSpreadsheetCache_')
        ? (n === 'DQ_SHEET_HDR_' ? { sh: null, headers: null } : {})
        : (n === 'VA_SYSTEM_' || n === 'VA_BYPASS_' || n === 'VA_RESOLVING_' ? false : null);
    }
  });
  if ('DQ_SHEET_HDR_' in globalThis) globalThis.DQ_SHEET_HDR_ = { sh: null, headers: null };
  if ('DQ_WRITE_GEN_' in globalThis) globalThis.DQ_WRITE_GEN_ = globalThis.DQ_WRITE_GEN_ + 1;
}
function __rebind__(v) {
  if (typeof v === 'string' && v.indexOf('@@fn:') === 0) return globalThis[v.slice(5)];
  if (typeof v === 'string' && v.indexOf('@@ss:') === 0) return __bookFor__(v.slice(5));
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
