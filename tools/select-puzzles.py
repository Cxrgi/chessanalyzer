# Wählt aus der Lichess-Aufgabensammlung (CC0) eine nach Schwierigkeit gestaffelte Stichprobe aus.
import sys, io, csv, random, collections, zstandard
src, out = sys.argv[1], sys.argv[2]
random.seed(20261112)
def target(band):
    if band < 600: return 350
    if band < 2000: return 800
    return 350
res = collections.defaultdict(list); seen = collections.Counter(); total = 0; themes = collections.Counter()
with open(src, 'rb') as fh:
    reader = zstandard.ZstdDecompressor(max_window_size=2**31).stream_reader(fh)
    text = io.TextIOWrapper(reader, encoding='utf-8', newline='')
    rd = csv.reader(text)
    header = next(rd)
    print(header, file=sys.stderr)
    for row in rd:
        total += 1
        pid, fen, moves, rating, rd_, pop, plays, th = row[:8]
        rating = int(rating)
        if rating < 400 or rating >= 2600: continue
        if int(pop) < 88 or int(plays) < 800 or int(rd_) > 85: continue
        n = moves.count(' ') + 1
        if n < 2 or n > 10 or n % 2: continue
        band = rating // 100 * 100
        seen[band] += 1
        k = target(band)
        item = (pid, fen, moves, rating, th)
        if len(res[band]) < k: res[band].append(item)
        else:
            j = random.randrange(seen[band])
            if j < k: res[band][j] = item
with open(out, 'w', newline='') as fo:
    w = csv.writer(fo)
    for band in sorted(res):
        for it in res[band]:
            w.writerow(it)
            for t in it[4].split(): themes[t] += 1
print('rows read', total, file=sys.stderr)
print({b: (len(res[b]), seen[b]) for b in sorted(res)}, file=sys.stderr)
print(themes.most_common(70), file=sys.stderr)
