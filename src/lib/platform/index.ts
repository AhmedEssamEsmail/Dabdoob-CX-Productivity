/**
 * Shared platform layer — the port of the Google Apps Script core
 * (original_deprecated/*.js) onto Next.js + Supabase:
 *
 *   repo.ts      Repo.js — table access, stamping, formula-injection guard
 *   time.ts      Code.js time helpers — Kuwait dates, pwTime + pure WorkCore/QueueCore
 *   settings.ts  Config.js / Stores.js / ProductivityApp.js — config + seeding
 *   identity.ts  Auth.js — session, roles, requireRole, pwDirectory
 *   viewas.ts    ViewAs.js — read-only View As + assertWritable()
 *   options.ts   Options.js — admin-maintained picklists
 *   popups.ts    Popups.js — in-app pop-ups
 *   mail.ts      Mailer.js — sendMail/Gmail reply behind adapters, mail_log
 *   notify.ts    Notify.js + OneOnOneAlerts.js — the notification engine
 *   health.ts    Health.js — ecosystem heartbeats
 *   calendar.ts  WorkCalendar.js + calendar helpers — who works when
 */

export * from './repo'
export * from './time'
export * from './settings'
export * from './identity'
export * from './viewas'
export * from './options'
export * from './popups'
export * from './mail'
export * from './notify'
export * from './health'
export * from './calendar'
