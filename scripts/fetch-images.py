#!/usr/bin/env python3
"""Fetches the official product photo for catalogue entries, cuts the bottle
out and stores a small transparent WebP in public/catalog/img/.

Cut-out: the segmentation model (rembg) runs twice — on the whole photo to
find the bottle, then on the bottle's crop of the high-resolution photo for a
sharp outline. Clear glass / white parts the model dropped inside the outline
are filled back, floor shadows and specks are removed and the edge colours are
decontaminated (no white halo). Photos the brand already publishes as a
transparent cut-out keep their own alpha; only the drop shadow is removed. The mapping lives in catalog/images.json and is merged
into the catalogue index by validate-catalog.mjs.

Only images found on the entry's own source pages are used (Shopify product
JSON `featured_image`, else the page's og:image), official pages first.

Usage (needs `pip install "rembg[cpu]" pillow scipy pymatting`):
  python3 scripts/fetch-images.py --sample --distributed      # targets
  python3 scripts/fetch-images.py --brand "Electimuss"        # one brand
  python3 scripts/fetch-images.py --redo "Brand|Name"         # retry one
"""
import argparse
import concurrent.futures as cf
import io
import json
import os
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


def hires(url: str) -> str:
    """The same Shopify photo at twice the width, for a sharper cut-out (the
    mapping keeps the 1000 px URL)."""
    return re.sub(r'([?&])width=1000$', r'\1width=2000', url)


def get_photo(url: str) -> bytes:
    try:
        return get(hires(url), timeout=40)
    except Exception:
        return get(url)


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


SKIP_TYPES = re.compile(r'sample|set|gift|kit|candle|lotion|gel|cream|soap|diffuser|travel|mini|bundle|refill|shower|body oil|roll on|roll-on', re.I)
SMALL = re.compile(r'purse|splash|pen\b|humongous|miniature|10 ?ml|15 ?ml|5 ?ml', re.I)
PLACEHOLDER = re.compile(r'coming[-_ ]?soon|placeholder|no[-_]image|logo|favicon', re.I)


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
        imgs = [i for i in (prod.get('images') or []) if not PLACEHOLDER.search(i.get('src', ''))]
        if not imgs:
            continue
        label = prod.get('title', '') + ' ' + prod.get('product_type', '')
        score = (not SMALL.search(label), bool(re.search(r'cologne|parfum|perfume|eau de', label, re.I)), title == want)
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
        if img and not PLACEHOLDER.search(img):
            return img, s
    return None, None


try:  # only needed for cutting, not for --merge
    import numpy as np
    from PIL import Image
    from scipy import ndimage as ndi
except ImportError:
    np = Image = ndi = None

_sessions = {}
MODEL = 'isnet-general-use'
# Photos shot in a scene (no plain studio backdrop) need the much heavier
# BiRefNet model (973 MB download, ~8 GB RAM, ~25 s per pass on 4 CPUs).
# PW_SCENE_MODEL= (empty) keeps everything on the light model.
SCENE_MODEL = os.environ.get('PW_SCENE_MODEL', 'birefnet-general')


def predictor(model):
    """model name -> function(RGB PIL image) -> float mask (0..1)."""
    if model not in _sessions:
        import onnxruntime as ort
        from rembg import new_session
        so = ort.SessionOptions()
        so.enable_cpu_mem_arena = False  # BiRefNet otherwise grows past 10 GB
        so.enable_mem_pattern = False
        _sessions[model] = new_session(model, sess_opts=so)
    sess = _sessions[model]
    return lambda im: np.asarray(sess.predict(im)[0].convert('L')).astype(np.float32) / 255


def _smooth(x, lo, hi):
    return np.clip((x - lo) / (hi - lo), 0, 1)

def border_bg(rgb, bgmask):
    """Colour of the photo's plain backdrop near the frame border, or None."""
    h, w = bgmask.shape
    ring = np.zeros((h, w), bool); r = max(4, min(h, w) // 40)
    ring[:r] = ring[-r:] = True; ring[:, :r] = ring[:, -r:] = True
    px = rgb[ring & bgmask]
    if len(px) < 50:
        return None
    med = np.median(px, axis=0)
    # plain backdrop only (a soft shadow in the ring is fine, a scene is not)
    return med if np.percentile(np.abs(px - med).max(axis=1), 60) < 8 else None

def _silhouette(core, side):
    """Bottle outline with everything inside it: enclosed areas, plus areas that
    are only open through a thin leak (clear glass the model dropped at an edge)."""
    r = max(2, round(0.012 * side))
    yy, xx = np.ogrid[-r:r + 1, -r:r + 1]
    disk = xx * xx + yy * yy <= r * r
    pad = np.pad(core, r + 2)
    closed = ndi.binary_closing(pad, structure=disk)
    enc = ndi.binary_fill_holes(closed) & ~closed
    seal = closed & ~pad & ndi.binary_dilation(enc, iterations=r + 2)
    out = ndi.binary_fill_holes(pad) | enc | seal
    return out[r + 2:-(r + 2), r + 2:-(r + 2)]

def refine(src, mask, opts=None):
    """src: RGBA PIL image, mask: float HxW (0..1) from the segmentation model.
    Returns an RGBA PIL cut-out at the same size (not trimmed)."""
    o = dict(lo=0.30, hi=0.90, defringe=True, gap_frac=0.04, glass=0.5)
    o.update(opts or {})
    arr = np.asarray(src).astype(np.float32)
    rgb, sa = arr[..., :3], arr[..., 3] / 255.0
    h, w = mask.shape
    scale = max(h, w) / 1000.0
    core = mask > 0.5
    filled = _silhouette(core, max(h, w))
    if (sa < 0.5).mean() > 0.05:
        # The brand already published a cut-out: its own alpha is the best matte.
        # Only drop the soft drop shadow / reflection outside the bottle outline.
        near = ndi.binary_dilation(filled, iterations=max(1, round(2 * scale)))
        dist = ndi.distance_transform_edt(~near)
        keep = 1 - _smooth(dist, 0, 3 * scale)
        dark = rgb.max(axis=2) < 110
        shadow = (sa < 0.92) & ~near
        alpha = np.where(shadow | (~near & dark & (sa < 0.99)), sa * keep, sa)
        # anything left far from the outline and faint is still shadow
        alpha = np.where(~near & (alpha < 0.35), 0, alpha)
        # an opaque frame / banner around the picture, outside the bottle
        lab, n = ndi.label((alpha > 0.5) & ~near)
        if n:
            edge_ids = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
            alpha = np.where(np.isin(lab, edge_ids[edge_ids > 0]), 0, alpha)
        # frames, captions and other islands that are not the bottle
        lab, n = ndi.label(alpha > 0.1)
        if n > 1:
            idx = range(1, n + 1)
            size = ndi.sum(np.ones((h, w)), lab, idx)
            hit = ndi.sum(filled, lab, idx)
            drop = [i for i, s_, t_ in zip(idx, size, hit) if t_ < 0.2 * s_]
            if len(drop) < n:
                alpha = np.where(np.isin(lab, drop), 0, alpha)
        if o['glass'] > 0:
            # faint see-through glass inside the outline: make it more present
            inside = ndi.binary_erosion(filled | ndi.binary_fill_holes(alpha > 0.5), iterations=max(1, round(2 * scale)))
            alpha = np.where(inside & (alpha > 0.03), alpha + (1 - alpha) * o['glass'], alpha)
        out_rgb = rgb
    else:
        bgmask = mask < 0.05
        bg = border_bg(rgb, bgmask)
        alpha = _smooth(mask, o['lo'], o['hi'])
        # see-through glass / white parts the model dropped inside the outline
        holes = filled & (mask < 0.9)
        sil = filled.sum()
        keep_clear = np.zeros((h, w), bool)
        lab, n = ndi.label(filled & (mask < 0.2))
        if n:
            sizes = ndi.sum(np.ones((h, w)), lab, range(1, n + 1))
            for i, s in enumerate(sizes, 1):
                if s > o['gap_frac'] * sil:
                    comp = lab == i
                    if bg is not None:
                        d = np.abs(rgb[comp] - bg).max(axis=1)
                        if np.percentile(d, 97) < 6:   # shows plain background: a real gap
                            keep_clear |= comp
        fill = holes & ~ndi.binary_dilation(keep_clear, iterations=2)
        alpha = np.where(fill, 1.0, alpha)
        out_rgb = rgb
        if o['defringe']:
            from pymatting import estimate_foreground_ml
            band = (alpha > 0.004) & (alpha < 0.996)
            if band.any():
                fg = estimate_foreground_ml(rgb / 255.0, alpha.astype(np.float64)) * 255.0
                edge = ndi.binary_dilation(band, iterations=1)
                out_rgb = np.where(edge[..., None], fg, rgb)
    # drop specks: keep components that are sizeable
    lab, n = ndi.label(alpha > 0.1)
    if n > 1:
        sizes = ndi.sum(np.ones((h, w)), lab, range(1, n + 1))
        big = sizes.max()
        small = np.isin(lab, [i for i, s in enumerate(sizes, 1) if s < 0.01 * big])
        alpha = np.where(small, 0, alpha)
    alpha = np.where(alpha < 0.06, 0, alpha)  # no faint veil: the app outlines the alpha shape (die-cut sticker)
    out = np.dstack([out_rgb.clip(0, 255), (alpha * 255).clip(0, 255)]).astype('uint8')
    return Image.fromarray(out, 'RGBA')

WORK_SIDE = 1400

def _white(im):
    bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
    return bg.convert('RGB')

def two_pass(src, predict, opts=None, info=None):
    """src: RGBA PIL (any size). predict(rgb PIL)->float mask HxW. Returns RGBA cut (untrimmed crop)."""
    small = src.copy(); small.thumbnail((1024, 1024))
    m1 = predict(_white(small))
    hit = m1 > 0.5
    sa1 = np.asarray(small.getchannel('A'))
    if (sa1 < 128).mean() > 0.05 and hit.any():
        # published cut-out: the bottle is the transparent photo's own island(s) under the mask
        lab, n = ndi.label(sa1 > 20)
        ids = np.unique(lab[hit & (lab > 0)])
        hit = hit | np.isin(lab, [i for i in ids if (hit & (lab == i)).sum() > 0.2 * (lab == i).sum()])
    ys, xs = np.nonzero(hit)
    if len(xs) == 0:
        return None
    f = src.width / small.width
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    mx, my = (x1 - x0) * 0.08 + 6, (y1 - y0) * 0.08 + 6
    box = (int(max(0, (x0 - mx) * f)), int(max(0, (y0 - my) * f)), int(min(src.width, (x1 + mx) * f)), int(min(src.height, (y1 + my) * f)))
    crop = src.crop(box)
    if max(crop.size) > WORK_SIDE:
        s = WORK_SIDE / max(crop.size)
        crop = crop.resize((round(crop.width * s), round(crop.height * s)), Image.LANCZOS)
    m1c = np.asarray(Image.fromarray((m1 * 255).astype('uint8')).resize(src.size, Image.BICUBIC).crop(box).resize(crop.size, Image.BICUBIC)).astype(np.float32) / 255
    m2 = predict(_white(crop))
    a, b = _silhouette(m1c > 0.5, max(crop.size)), _silhouette(m2 > 0.5, max(crop.size))
    iou = (a & b).sum() / max(1, (a | b).sum())
    if info is not None: info['iou'] = float(iou)
    mask = m2 if iou >= 0.93 else m1c
    return refine(crop, mask, opts)


def is_scene(im):
    """True when the photo has no plain backdrop (frame border is not one flat colour)."""
    t = im.copy()
    t.thumbnail((500, 500))
    a = np.asarray(t.convert('RGBA')).astype(np.float32)
    if (a[..., 3] < 128).mean() > 0.05:
        return False
    rgb = a[..., :3]
    h, w = rgb.shape[:2]
    r = max(4, min(h, w) // 40)
    px = np.concatenate([rgb[:r].reshape(-1, 3), rgb[-r:].reshape(-1, 3), rgb[:, :r].reshape(-1, 3), rgb[:, -r:].reshape(-1, 3)])
    return float(np.percentile(np.abs(px - np.median(px, axis=0)).max(axis=1), 90)) > 14


def cutout(data: bytes, model=None):
    """Official photo bytes -> (transparent WebP bytes | None, status)."""
    im = Image.open(io.BytesIO(data)).convert('RGBA')
    if max(im.size) > 3000:
        im.thumbnail((3000, 3000), Image.LANCZOS)
    if model is None:
        model = SCENE_MODEL if SCENE_MODEL and is_scene(im) else MODEL
    try:
        predict = predictor(model)
    except Exception as e:  # heavy model unavailable: fall back to the light one
        if model == MODEL:
            raise
        print(f'  ! {model} unavailable ({e}); using {MODEL}')
        model, predict = MODEL, predictor(MODEL)
    out = two_pass(im, predict)
    if out is None:
        return None, 'empty'
    alpha = out.getchannel('A')
    bbox = alpha.point(lambda a: 255 if a > 24 else 0).getbbox()
    if not bbox:
        return None, 'empty'
    pad = 2
    bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(out.width, bbox[2] + pad), min(out.height, bbox[3] + pad))
    out = out.crop(bbox)
    w, h = out.size
    hist = out.getchannel('A').histogram()
    cover = sum(hist[25:]) / float(w * h)
    # A bottle cut-out is a compact, mostly solid shape. Very sparse masks are
    # usually text, lifestyle scenes or boxes that were only partly kept.
    if cover < 0.35 or w * h < 120 * 120:
        return None, f'weak-mask:{cover:.2f}'
    s = MAX_SIDE / max(w, h)
    if s < 1:
        out = out.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    buf = io.BytesIO()
    out.save(buf, 'WEBP', quality=86, method=6)
    return buf.getvalue(), f'ok:{cover:.2f}:{model}'


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
        return brand, fr['name'], get_photo(img), img, src
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


def refresh(keys_file, shard):
    mapping = json.loads(MAP.read_text())
    keys = [k for k in json.loads(Path(keys_file).read_text()) if k in mapping]
    if shard:
        i, n = map(int, shard.split('/'))
        keys = keys[i::n]
    print(f'{len(keys)} to refresh')
    def dl(k):
        try:
            return k, get_photo(mapping[k]['image'])
        except Exception as e:
            return k, None
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        for j, (k, data) in enumerate(ex.map(dl, keys), 1):
            if not data:
                print('  - download failed', k)
                continue
            webp, why = cutout(data)
            if webp:
                (OUT / mapping[k]['file']).write_bytes(webp)
            else:
                print('  -', k, why)
            if j % 25 == 0:
                print(f'  {j}/{len(keys)}')
    print('refresh done')


def main():
    if '--merge' in sys.argv:
        return merge()
    if '--refresh' in sys.argv:
        i = sys.argv.index('--refresh')
        shard = sys.argv[sys.argv.index('--shard') + 1] if '--shard' in sys.argv else None
        return refresh(sys.argv[i + 1], shard)
    ap = argparse.ArgumentParser()
    ap.add_argument('--sample', action='store_true')
    ap.add_argument('--distributed', action='store_true')
    ap.add_argument('--brand', action='append')
    ap.add_argument('--redo', action='append')
    ap.add_argument('--force', action='store_true', help='redo targets even if already mapped')
    ap.add_argument('--refresh', help='JSON list of mapped keys to re-cut from their recorded image URL')
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
    todo = [t for t in targets(args) if args.redo or args.force or key(t[0], t[1]['name']) not in done]
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
