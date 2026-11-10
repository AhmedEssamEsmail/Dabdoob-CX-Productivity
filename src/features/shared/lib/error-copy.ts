/**
 * error-copy — the one mapper between infra/deployer errors and user copy.
 * Env-var names, Apps Script tooling references and bare "Request failed"
 * strings NEVER reach non-admin surfaces: every pattern below maps to canned
 * user copy, and the technical detail is returned only when ctx.isAdmin.
 * Pure module — no React. Table-driven: a new pattern is one entry.
 */

export interface ErrorCopyCtx {
  /** Surface technical detail (env vars, tooling refs) — admin role only. */
  isAdmin?: boolean
  /** Feature/section label for fallback copy, e.g. 'My day'. */
  feature?: string
}

export interface UserCopy {
  title: string
  body: string
  /** Technical detail; populated only when ctx.isAdmin. */
  adminHint?: string
}

const ADMIN_SETUP = 'The CX admin can finish setup in Admin.'
const GOOGLE_NOT_CONNECTED =
  "Calendar, mail and Drive aren't connected — the CX admin can finish setup in Admin."

interface CopyRule {
  match: (raw: string, v: unknown) => boolean
  title: string
  body: (raw: string, ctx: ErrorCopyCtx) => string
  /** Raw technical text, surfaced only under ctx.isAdmin. */
  detail?: (raw: string) => string | undefined
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function rawText(err: unknown): string {
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (isObj(err)) {
    return [err.error, err.message, err.detail, err.hint]
      .filter((x): x is string => typeof x === 'string')
      .join(' ')
  }
  return String(err ?? '')
}

const configuredFalse = (_raw: string, v: unknown) => isObj(v) && v.configured === false

const mentionsGoogle = (raw: string, ctx: ErrorCopyCtx) =>
  /google|calendar|gmail|drive/i.test(raw + ' ' + (ctx.feature || ''))

const notConnectedBody = (raw: string, ctx: ErrorCopyCtx) =>
  mentionsGoogle(raw, ctx)
    ? GOOGLE_NOT_CONNECTED
    : `${ctx.feature || 'This feature'} isn't connected yet — ${ADMIN_SETUP}`

const ENV_OR_TOOLING =
  /\b(GOOGLE_SERVICE_ACCOUNT_EMAIL|GOOGLE_PRIVATE_KEY|GOOGLE_DELEGATED_USER|ASSISTANT_OWNER_EMAIL|SUPABASE_[A-Z_]+)\b|Apps Script|ScriptApp|debugMyDay|clasp\.|service account/i

const RULES: CopyRule[] = [
  {
    // { configured: false } envelope (myDayGoogle, scorecard runs).
    match: configuredFalse,
    title: 'Not connected',
    body: notConnectedBody,
  },
  {
    match: (raw) => /not connected|not configured|isn'?t connected|is not configured/i.test(raw),
    title: 'Not connected',
    body: notConnectedBody,
    detail: (raw) => raw || undefined,
  },
  {
    match: (raw) => ENV_OR_TOOLING.test(raw),
    title: 'Setup needed',
    body: () => `This feature needs an admin to finish its setup — ${ADMIN_SETUP}`,
    detail: (raw) => raw || undefined,
  },
  {
    match: (raw) => raw.trim() === '' || /^request failed$/i.test(raw.trim()),
    title: 'Something went wrong',
    body: () => 'We could not load this right now. Try again in a moment.',
  },
  {
    match: () => true,
    title: 'Something went wrong',
    body: () => 'Something went wrong on our side. Try again in a moment.',
    detail: (raw) => raw || undefined,
  },
]

export function toUserCopy(err: unknown, ctx: ErrorCopyCtx = {}): UserCopy {
  const raw = rawText(err)
  const rule = RULES.find((r) => r.match(raw, err))!
  const detail = rule.detail?.(raw)
  return {
    title: rule.title,
    body: rule.body(raw, ctx),
    adminHint: ctx.isAdmin && detail ? detail : undefined,
  }
}

/** Gr-compatible string form for callers that render plain text. */
export function toUserText(err: unknown, ctx: ErrorCopyCtx = {}): string {
  const c = toUserCopy(err, ctx)
  return c.adminHint ? `${c.title} — ${c.body} (${c.adminHint})` : `${c.title} — ${c.body}`
}
