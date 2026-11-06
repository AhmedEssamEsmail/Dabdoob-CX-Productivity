import { NextResponse } from 'next/server'
import { currentEmail, actorEmail, optionsFor, addOption } from '@/features/shared/platform'


/** optionsFor_: the active choices of one dropdown. */
export async function GET(_req: Request, ctx: { params: Promise<{ listKey: string }> }) {
  try {
    await currentEmail()
    const { listKey } = await ctx.params
    return NextResponse.json({ listKey, options: await optionsFor(listKey) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}

/** addOption_: a value typed into "Other". View as refuses via assertWritable(). */
export async function POST(req: Request, ctx: { params: Promise<{ listKey: string }> }) {
  try {
    await currentEmail()
    const { listKey } = await ctx.params
    const body = (await req.json()) as { value?: unknown }
    const r = await addOption(listKey, body.value, await actorEmail())
    return NextResponse.json(r)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = msg === 'Unauthorized' ? 401 : /View as/.test(msg) ? 403 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
