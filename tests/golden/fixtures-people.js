/* eslint-disable @typescript-eslint/no-unused-vars */
// Loaded into the oracle vm after the legacy files: tiny globals the tests bind
// into JSON args through the '@@fn:' marker (only globals can cross as functions).
function pwTestDirName_(e) { return String(e).split('@')[0]; }
// The dateKey seam for scParseMatrix_/scParseFcr_: 'YYYY-MM-DD' strings pass, else null.
function pwTestDateKey_(v) {
  var s = String(v == null ? '' : v);
  return /^\d{4}-\d\d-\d\d$/.test(s) ? s : null;
}
// dir.person / dir.managerOf seams driven by fixtures (people.test.ts dir args).
function pwTestDirPerson_(e) {
  var m = (__FIXTURES__ && __FIXTURES__.dirPersons) || {};
  return m[String(e).trim().toLowerCase()] || null;
}
function pwTestDirManagerOf_(e) {
  var m = (__FIXTURES__ && __FIXTURES__.dirManagerOf) || {};
  return m[String(e).trim().toLowerCase()] || null;
}
// pwDataSuggestions_(kind, ctx, add) writes through a callback: collect it so the
// whole suggestion list crosses the vm boundary as a return value.
function pwTestDataSug_(kind, ctx) {
  var out = [];
  pwDataSuggestions_(kind, ctx, function (t, r) { out.push({ topic: t, reason: r }); });
  return out;
}
