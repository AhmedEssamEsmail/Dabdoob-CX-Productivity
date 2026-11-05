import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { notesPage, notesSave, notesDelete } from '@/features/cx-people/lib/notes'

/** notesPage: the owner's live notes, newest first (owner only). */
export async function GET() {
  try {
    return NextResponse.json(await notesPage())
  } catch (e) {
    return apiError(e)
  }
}

/** notesSave: create (no id) or patch { id, text?, tag?, status? }. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(await notesSave(body))
  } catch (e) {
    return apiError(e)
  }
}

/** notesDelete: soft-delete. */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    return NextResponse.json(await notesDelete(String(searchParams.get('id') || '')))
  } catch (e) {
    return apiError(e)
  }
}
