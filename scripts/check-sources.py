#!/usr/bin/env python3
"""Opens every source URL in catalog/brands/*.json and removes sources whose
page does not exist (HTTP 404/410 or an unresolvable host). Entries left with
no source are then rejected by validate-catalog.mjs.

A 403/429/5xx is NOT treated as missing: many shops block bots but the page
exists. Results are cached in catalog/sources/url-check.json.

Usage: python3 scripts/check-sources.py [brand-file.json ...]
"""
import concurrent.futures as cf
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRANDS = ROOT / 'catalog' / 'brands'
CACHE = ROOT / 'catalog' / 'sources' / 'url-check.json'
UA = 'Mozilla/5.0 (compatible; MyPerfumeWardrobe-catalog-check/1.0)'


def probe(url: str) -> str:
    for method in ('HEAD', 'GET'):
        req = urllib.request.Request(url, method=method, headers={'user-agent': UA, 'accept': 'text/html,*/*'})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return f'ok:{r.status}'
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                if method == 'HEAD':
                    continue  # some servers 404 on HEAD only
                return f'dead:{e.code}'
            if e.code == 405 and method == 'HEAD':
                continue
            return f'kept:{e.code}'
        except urllib.error.URLError as e:
            reason = str(e.reason)
            if 'Name or service not known' in reason or 'nodename nor servname' in reason or 'getaddrinfo' in reason:
                return 'dead:dns'
            return f'kept:err'
        except Exception:
            return 'kept:err'
    return 'kept:unknown'


def main():
    files = [Path(a) for a in sys.argv[1:]] or sorted(BRANDS.glob('*.json'))
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    urls = set()
    data = {}
    for f in files:
        d = json.loads(f.read_text())
        data[f] = d
        for fr in d.get('fragrances', []):
            for s in fr.get('sources', []):
                if isinstance(s.get('url'), str):
                    urls.add(s['url'])
    todo = [u for u in urls if u not in cache]
    print(f'{len(urls)} unique URLs, {len(todo)} to check')
    with cf.ThreadPoolExecutor(max_workers=12) as ex:
        for u, res in zip(todo, ex.map(probe, todo)):
            cache[u] = res
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, indent=0, sort_keys=True))
    removed = 0
    for f, d in data.items():
        changed = False
        for fr in d.get('fragrances', []):
            before = len(fr.get('sources', []))
            fr['sources'] = [s for s in fr.get('sources', []) if not cache.get(s.get('url'), '').startswith('dead')]
            if len(fr['sources']) != before:
                removed += before - len(fr['sources'])
                changed = True
        if changed:
            f.write_text(json.dumps(d, indent=2, ensure_ascii=False))
            print(f'  {f.name}: removed dead sources')
    dead = sum(1 for u in urls if cache.get(u, '').startswith('dead'))
    print(f'dead URLs: {dead} · sources removed: {removed}')


if __name__ == '__main__':
    main()
