#!/usr/bin/env python3
"""Builds riwayat/<key>.json for Qurany's tasmee.

For every riwaya (KFGQPC data) it aligns the riwaya's words with the Hafs words Qurany
uses in tasmee, surah by surah, and stores only where the riwaya reads differently:
  { "s:a": { "<1-based word idx in Hafs verse>": ["accepted variant", ...] } }
The Hafs form is always accepted too, so the file only holds the extras."""
import json, re, sys, difflib, os
SRC = sys.argv[1]            # dir with <key>/data.json (KFGQPC data)
HAFS = sys.argv[2]           # hafs_words.json exported from Qurany's D.texts
OUT = sys.argv[3]
KEYS = ['warsh', 'qaloon', 'shouba', 'doori', 'soosi', 'bazzi', 'qumbul']

def norm(s):
    # exact port of normalizeTasmeeWord in app.js (keep in sync)
    s = re.sub('و[\u064B-\u065F]*\u0670', 'ا', s)
    s = re.sub('[\u06E6\u06E7]', 'ي', s)
    s = s.replace('\u06E5', 'و')
    s = re.sub('ه[\u064B-\u065F]*\u0670(?=[ذؤ])', 'ه', s)
    s = re.sub('ذ[\u064B-\u065F]*\u0670(?=ل)', 'ذ', s)
    s = re.sub('رَّحۡ?مَ[\u064B-\u065F]*\u0670(?=ن)', 'رحم', s)
    s = re.sub('لَ[\u064B-\u065F]*\u0670(?=[كه])', 'ل', s)
    s = re.sub('أُوْلَـ[\u064B-\u065F]*\u0670', 'اول', s)
    s = s.replace('\u0670', 'ا')
    s = re.sub('[\u064B-\u065F\u06D6-\u06ED\u0640]', '', s)
    s = re.sub('[أإآٱ]', 'ا', s)
    s = s.replace('ة', 'ه').replace('ى', 'ي').replace('ؤ', 'و').replace('ئ', 'ي')
    s = re.sub('[^\u0621-\u064A]', '', s)
    if s == 'علا': s = 'علي'
    if s == 'اولايك': s = 'اوليك'
    return s

def norm_riwaya(w):
    """Riwaya words: also try the form without the small waw/ya (silat) and Warsh madd marks."""
    base = norm(w)
    plain = norm(re.sub('[ۥۦۧ]', '', w))
    return base, plain

def skeleton(w):
    k = re.sub('[اويء]', '', w)
    return k or w

NUM = re.compile(r'[٠-٩\d۝۞۩]+')
def words(t):
    return [w for w in NUM.sub(' ', t.replace('\xa0', ' ')).split() if re.search('[ء-ي]', w)]

hafs = json.load(open(HAFS))
os.makedirs(OUT, exist_ok=True)
stats = {}
for key in KEYS:
    data = json.load(open(f'{SRC}/{key}/data.json'))
    by_s = {}
    for x in data:
        s = int(x.get('sura_no') or x.get('sora'))
        by_s.setdefault(s, []).extend(words(x['aya_text']))
    out, st = {}, dict(sub=0, repl=0, dele=0, ins=0)
    for s in range(1, 115):
        H = [(a + 1, i + 1, w) for a, v in enumerate(hafs[s - 1]) for i, w in enumerate(v)]
        R = [norm_riwaya(w) for w in by_s.get(s, [])]
        R = [(b, p) for b, p in R if b]
        sm = difflib.SequenceMatcher(None, [skeleton(h[2]) for h in H], [skeleton(r[0]) for r in R], autojunk=False)
        def add(h, vs):
            vs = [v for v in dict.fromkeys(vs) if v and v != h[2]]
            if vs:
                out.setdefault(f'{s}:{h[0]}', {}).setdefault(str(h[1]), [])
                for v in vs:
                    if v not in out[f'{s}:{h[0]}'][str(h[1])]:
                        out[f'{s}:{h[0]}'][str(h[1])].append(v)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == 'equal':
                for k in range(i2 - i1):
                    r = R[j1 + k]
                    if r[0] != H[i1 + k][2] or r[1] != H[i1 + k][2]:
                        add(H[i1 + k], [r[0], r[1]]); st['sub'] += 1
            elif op == 'replace':
                alts = [x for r in R[j1:j2] for x in r]
                # a merged/split reading: every Hafs word of the block accepts every riwaya word of it
                for h in H[i1:i2]:
                    add(h, alts)
                if i2 - i1 != j2 - j1:
                    st['repl'] += 1
                else: st['sub'] += i2 - i1
            elif op == 'delete': st['dele'] += i2 - i1
            else: st['ins'] += j2 - j1
    json.dump(out, open(f'{OUT}/{key}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    stats[key] = (st, len(out), os.path.getsize(f'{OUT}/{key}.json'))
    print(key, st, 'verses', len(out), 'bytes', stats[key][2])
