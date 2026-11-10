#!/usr/bin/env python3
"""يولّد mutashabihat.json: لكل آية أقرب الآيات المتشابهة لفظًا (مع نسبة التشابه).
الاستعمال:
  node tools/export_hafs_words.js hafs_words.json
  python3 tools/build_mutashabihat.py hafs_words.json mutashabihat.json
المنهج: فهرس لمجموعات ٣ كلمات متتالية لاستخراج المرشّحين، ثم difflib لقياس التشابه على مستوى الكلمات.
الآيات المتطابقة تمامًا لا تُعدّ متشابهات (لا فرق فيها). يحسب المتصفح الفروق نفسها عند العرض."""
import json, sys, collections, difflib
src = sys.argv[1] if len(sys.argv) > 1 else 'hafs_words.json'
dst = sys.argv[2] if len(sys.argv) > 2 else 'mutashabihat.json'
TOP, MIN_MATCH, MIN_RATIO, MAX_COMMON = 4, 3, 0.5, 60
data = json.load(open(src, encoding='utf-8'))
verses = {}
for s, surah in enumerate(data, 1):
    for a, ws in enumerate(surah, 1):
        verses[s * 1000 + a] = ws
index = collections.defaultdict(list)
for vid, ws in verses.items():
    seen = set()
    for i in range(len(ws) - 2):
        g = tuple(ws[i:i + 3])
        if g not in seen:
            seen.add(g)
            index[g].append(vid)
cand = collections.defaultdict(collections.Counter)
for g, vs in index.items():
    if len(vs) < 2 or len(vs) > MAX_COMMON:
        continue
    for x in vs:
        for y in vs:
            if x != y:
                cand[x][y] += 1
out = {}
for vid, counter in cand.items():
    a = verses[vid]
    scored = []
    for other, shared in counter.items():
        b = verses[other]
        if a == b:
            continue
        sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
        match = sum(m.size for m in sm.get_matching_blocks())
        ratio = sm.ratio()
        if match >= MIN_MATCH and ratio >= MIN_RATIO:
            scored.append((ratio, match, other))
    scored.sort(reverse=True)
    if scored:
        out[vid] = [[o, round(r, 2)] for r, m, o in scored[:TOP]]
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print(len(out), 'verses with similars; pairs', sum(len(v) for v in out.values()))
