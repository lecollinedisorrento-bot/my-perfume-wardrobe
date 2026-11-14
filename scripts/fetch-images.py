#!/usr/bin/env python3
"""Fetches the official product photo for catalogue entries, cuts the bottle
out (background removal with rembg) and stores a small transparent WebP in
public/catalog/img/. The mapping lives in catalog/images.json and is merged
into the catalogue index by validate-catalog.mjs.

Only images found on the entry's own source pages are used (Shopify product
JSON `featured_image`, else the page's og:image), official pages first.

Usage (needs `pip install "rembg[cpu]" pillow`):
  python3 scripts/fetch-images.py --sample --distributed      # targets
  python3 scripts/fetch-images.py --brand "Electimuss"        # one brand
  python3 scripts/fetch-images.py --redo "Brand|Name"         # retry one
"""
import argparse
import concurrent.futures as cf
import io
import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRANDS = ROOT / 'catalog' / 'brands'
MAP = ROOT / 'catalog' / 'images.json'
# Photos rejected on visual review (box shots, logos, lifestyle scenes, wrong subject).
REJECTED = ROOT / 'catalog' / 'images-rejected.json'
OUT = ROOT / 'public' / 'catalog' / 'img'
UA = 'Mozilla/5.0 (compatible; MyPerfumeWardrobe-images/1.0)'
MAX_SIDE = 640


def slug(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def key(brand: str, name: str) -> str:
    return f'{brand}|{name}'


def get(url: str, timeout=25) -> bytes:
    req = urllib.request.Request(url, headers={'user-agent': UA, 'accept': '*/*'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def absolute(src: str, base: str) -> str:
    if src.startswith('//'):
        return 'https:' + src
    return urllib.parse.urljoin(base, src)


def shopify_image(url: str):
    p = urllib.parse.urlparse(url)
    m = re.match(r'.*/products/([^/?#]+)', p.path)
    if not m:
        return None
    try:
        d = json.loads(get(f'{p.scheme}://{p.netloc}/products/{m.group(1)}.js'))
    except Exception:
        return None
    img = d.get('featured_image') or (d.get('images') or [None])[0]
    if not img:
        return None
    img = absolute(img, url)
    if 'cdn.shopify.com' in img or '/cdn/shop/' in img:
        img += ('&' if '?' in img else '?') + 'width=1000'
    return img


def og_image(url: str):
    try:
        html = get(url).decode('utf-8', 'ignore')
    except Exception:
        return None
    for prop in ('og:image:secure_url', 'og:image', 'twitter:image'):
        m = re.search(r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]*content=["\']([^"\']+)' % re.escape(prop), html, re.I) or \
            re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']%s["\']' % re.escape(prop), html, re.I)
        if m:
            return absolute(unescape(m.group(1)), url)
    return None


_feeds = {}


def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def shopify_feed(origin: str):
    """All products of a Shopify store (cached per host), or [] if not Shopify."""
    if origin not in _feeds:
        items = []
        for page in range(1, 21):
            try:
                ps = json.loads(get(f'{origin}/products.json?limit=250&page={page}')).get('products', [])
            except Exception:
                break
            if not ps:
                break
            items += ps
        _feeds[origin] = items
    return _feeds[origin]


SKIP_TYPES = re.compile(r'sample|set|gift|kit|candle|lotion|gel|cream|soap|diffuser|travel|mini|bundle|refill', re.I)


def shopify_by_name(url: str, name: str):
    """For a collection/listing source: find this perfume's own product in the store's feed."""
    p = urllib.parse.urlparse(url)
    if '/products/' in p.path:
        return None
    origin = f'{p.scheme}://{p.netloc}'
    want = norm(name)
    best = None
    for prod in shopify_feed(origin):
        title = norm(prod.get('title', ''))
        if not (title == want or title.startswith(want + ' ')):
            continue
        if SKIP_TYPES.search(prod.get('title', '') + ' ' + prod.get('product_type', '')):
            continue
        imgs = prod.get('images') or []
        if not imgs:
            continue
        score = (title == want, 'spray' in title or 'parfum' in title or 'cologne' in title)
        if best is None or score > best[0]:
            best = (score, imgs[0]['src'], f"{origin}/products/{prod['handle']}")
    if not best:
        return None
    img = best[1] + ('&' if '?' in best[1] else '?') + 'width=1000'
    return img, best[2]


def find_image(fr: dict):
    srcs = sorted(fr.get('sources', []), key=lambda s: 0 if s.get('type') == 'official' else 1)
    for s in srcs:
        u = s.get('url')
        if not u:
            continue
        hit = shopify_by_name(u, fr['name'])
        if hit:
            return hit[0], {**s, 'url': hit[1]}
        img = shopify_image(u) or og_image(u)
        if img and not re.search(r'logo|favicon|placeholder', img, re.I):
            return img, s
    return None, None


_session = None


def cutout(data: bytes):
    global _session
    from PIL import Image
    from rembg import new_session, remove
    if _session is None:
        _session = new_session('isnet-general-use')
    im = Image.open(io.BytesIO(data)).convert('RGBA')
    im.thumbnail((1100, 1100))
    out = remove(im, session=_session)
    alpha = out.getchannel('A')
    bbox = alpha.point(lambda a: 255 if a > 24 else 0).getbbox()
    if not bbox:
        return None, 'empty'
    out = out.crop(bbox)
    w, h = out.size
    hist = out.getchannel('A').histogram()
    cover = sum(hist[25:]) / float(w * h)
    # A bottle cut-out is a compact, mostly solid shape. Very sparse masks are
    # usually text, lifestyle scenes or boxes that were only partly kept.
    if cover < 0.35 or w * h < 120 * 120:
        return None, f'weak-mask:{cover:.2f}'
    out.thumbnail((MAX_SIDE, MAX_SIDE))
    buf = io.BytesIO()
    out.save(buf, 'WEBP', quality=80, method=6)
    return buf.getvalue(), f'ok:{cover:.2f}'


def targets(args):
    sample = []
    if args.sample:
        src = (ROOT / 'src' / 'domain' / 'fragrance.ts').read_text()
        block = src.split('SAMPLE_COLLECTION', 1)[1].split('];', 1)[0]
        sample = re.findall(r"brand: '([^']+)', name: '([^']+)'", block)
    want = {key(b, n) for b, n in sample}
    out = []
    for f in sorted(BRANDS.glob('*.json')):
        d = json.loads(f.read_text())
        dist = bool(d.get('distributors'))
        for fr in d.get('fragrances', []):
            k = key(d['brand'], fr['name'])
            if (args.distributed and dist) or k in want or (args.brand and d['brand'] in args.brand) or (args.redo and k in args.redo):
                out.append((d['brand'], fr))
    return out


def fetch_one(item):
    brand, fr = item
    img, src = find_image(fr)
    if not img:
        return brand, fr['name'], None, 'no-image', None
    try:
        return brand, fr['name'], get(img), img, src
    except Exception as e:
        return brand, fr['name'], None, f'download-failed:{e}', None


def merge():
    mapping = json.loads(MAP.read_text()) if MAP.exists() else {}
    for f in sorted(MAP.parent.glob('images.shard*.json')):
        mapping.update(json.loads(f.read_text()))
        f.unlink()
    drop_generic(mapping)
    MAP.write_text(json.dumps(mapping, indent=1, ensure_ascii=False, sort_keys=True))
    print('merged, total mapped', len(mapping))


def main():
    if '--merge' in sys.argv:
        return merge()
    ap = argparse.ArgumentParser()
    ap.add_argument('--sample', action='store_true')
    ap.add_argument('--distributed', action='store_true')
    ap.add_argument('--brand', action='append')
    ap.add_argument('--redo', action='append')
    ap.add_argument('--shard', help='i/n: process only every n-th target (parallel runs)')
    args = ap.parse_args()
    global MAP
    base = json.loads(MAP.read_text()) if MAP.exists() else {}
    if args.shard:
        i, n = map(int, args.shard.split('/'))
        MAP = MAP.with_name(f'images.shard{i}.json')  # merged with --merge afterwards
    mapping = json.loads(MAP.read_text()) if MAP.exists() else {}
    rejected = set(json.loads(REJECTED.read_text())) if REJECTED.exists() else set()
    done = set(base) | set(mapping) | rejected
    OUT.mkdir(parents=True, exist_ok=True)
    todo = [t for t in targets(args) if args.redo or key(t[0], t[1]['name']) not in done]
    if args.shard:
        todo = todo[i::n]
    print(f'{len(todo)} to process')
    stats = {}
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        for i, (brand, name, data, img, src) in enumerate(ex.map(fetch_one, todo), 1):
            if data is None:
                stats[img.split(':')[0]] = stats.get(img.split(':')[0], 0) + 1
                print(f'  - {brand} | {name}: {img}')
                continue
            webp, why = cutout(data)
            stats[why.split(':')[0]] = stats.get(why.split(':')[0], 0) + 1
            if webp is None:
                print(f'  - {brand} | {name}: {why}')
                continue
            fn = f'{slug(brand)}--{slug(name)}.webp'
            (OUT / fn).write_bytes(webp)
            mapping[key(brand, name)] = {'file': fn, 'image': img, 'page': src['url'], 'source': src.get('name'), 'type': src.get('type')}
            if i % 25 == 0:
                MAP.write_text(json.dumps(mapping, indent=1, ensure_ascii=False, sort_keys=True))
                print(f'  {i}/{len(todo)}')
    drop_generic(mapping)
    MAP.write_text(json.dumps(mapping, indent=1, ensure_ascii=False, sort_keys=True))
    print('done', stats, 'total mapped', len(mapping))


def drop_generic(mapping: dict):
    """The same picture for 3+ different perfumes is a site-wide placeholder, not a bottle."""
    seen = {}
    for k, v in mapping.items():
        seen.setdefault(re.sub(r'[?&]width=\d+', '', v['image']), []).append(k)
    for img, keys in seen.items():
        if len(keys) >= 3:
            for k in keys:
                (OUT / mapping[k]['file']).unlink(missing_ok=True)
                del mapping[k]
            print(f'  dropped generic image used by {len(keys)} perfumes: {img[:80]}')


if __name__ == '__main__':
    sys.exit(main())
