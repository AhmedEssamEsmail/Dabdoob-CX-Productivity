import re

def strings(path):
    try:
        src = open(path, encoding='utf8').read()
    except Exception:
        return set()
    out = set()
    for m in re.findall(r'"([^"\\]{25,})"|\'([^\'\\]{25,})\'', src):
        s = (m[0] or m[1]).strip()
        if not re.match(r"^[A-Z0-9(]", s):
            continue
        if re.search(r'[{}<>&;=`\\]|\be\(|\.\w+\(', s):
            continue
        words = re.findall(r"[A-Za-z']+", s)
        if len(words) < 4:
            continue
        out.add(s)
    # JSX text nodes: >Some copy<  or {'Some copy'}
    for m in re.findall(r'>\s*([A-Z][^<>{}]{24,}?)\s*<', src):
        s = m.strip()
        if re.search(r'[{}<>&;=`\\]', s):
            continue
        if len(re.findall(r"[A-Za-z']+", s)) >= 4:
            out.add(s)
    for m in re.findall(r"\{['\"]([^'\"{}]{25,})['\"]\}", src):
        s = m.strip()
        if re.search(r'[{}<>&;=`\\]', s):
            continue
        if len(re.findall(r"[A-Za-z']+", s)) >= 4:
            out.add(s)
    return out

shared = strings('src/features/cx-quality/components/qa-shared.tsx')
shared |= strings('src/features/shared/components/shell/ui.tsx')
for p in ['audit-queue', 'calibration', 'ctls', 'disputes', 'kb-gaps', 'my-auditor-kpis', 'my-audits', 'qa-forms', 'quality-analytics', 'quality-scores']:
    clo = strings(f'.devin/work/extract/quality/pages/{p}.closure.js')
    tsx = strings(f'src/features/cx-quality/components/{p}-page.tsx') | shared
    missing = sorted(c for c in clo if c not in tsx)
    print(f'=== {p}: {len(missing)} missing copy strings ===')
    for m in missing[:18]:
        print('   -', m[:140])
