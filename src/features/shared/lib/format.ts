/**
 * Shared display-format helpers (PLAN B17). `fmt` renders a number with
 * en-US thousands grouping; both feature `components/shared.tsx` copies
 * re-export it so existing consumers keep their import paths.
 */
export const fmt = (n: number) => n.toLocaleString('en-US')
