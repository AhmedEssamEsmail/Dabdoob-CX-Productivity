// Loaded into the oracle vm after the legacy files: tiny globals the tests bind
// into JSON args through the '@@fn:' marker (only globals can cross as functions).
function pwTestDirName_(e) { return String(e).split('@')[0]; }
// The dateKey seam for scParseMatrix_/scParseFcr_: 'YYYY-MM-DD' strings pass, else null.
function pwTestDateKey_(v) {
  var s = String(v == null ? '' : v);
  return /^\d{4}-\d\d-\d\d$/.test(s) ? s : null;
}
