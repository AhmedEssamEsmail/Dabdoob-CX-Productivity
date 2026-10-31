/**
 * Utilities.parseCsv port (RFC 4180): comma-separated values, "quoted" fields
 * that may hold commas, quotes escaped as "" and line breaks. Rows whose cells
 * are all blank are dropped (prodCsvRows_).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let fieldStarted = false
  const pushField = () => {
    row.push(field)
    field = ''
    fieldStarted = false
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      // A quote only opens a quoted field at the field's first character;
      // elsewhere it is literal text (parseCsv's lenient edge).
      if (!fieldStarted) inQuotes = true
      else field += ch
      fieldStarted = true
      continue
    }
    if (ch === ',') {
      pushField()
      fieldStarted = true
      continue
    }
    if (ch === '\r') {
      // \r\n ends a row; a lone \r does too (parseCsv treats both as breaks).
      if (text[i + 1] === '\n') i++
      pushRow()
      continue
    }
    if (ch === '\n') {
      pushRow()
      continue
    }
    field += ch
    fieldStarted = true
  }
  // Trailing field/row — parseCsv emits the last row even without a final break,
  // but not a phantom row after a trailing break.
  if (fieldStarted || field !== '' || row.length) pushRow()
  return rows
}

/** prodCsvRows_ verbatim: parsed rows, blank rows (all cells blank) dropped. */
export function prodCsvRows_(text: unknown): string[][] {
  return parseCsv(String(text || '')).filter((r) => r.some((c) => String(c).trim() !== ''))
}
