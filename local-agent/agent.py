#!/usr/bin/env python3
from __future__ import annotations
import argparse, ast, datetime, json, os, re, shutil, sys, tempfile
from pathlib import Path
VERSION='1.0.0'
SKIP={'.git','node_modules','vendor','.venv','venv','__pycache__','dist','build','.next','.local-agent'}
KINDS={'text','json','html','css','js','python','markdown','env'}
def safe_root(value):
    p=Path(value).expanduser().resolve()
    if not p.is_dir(): raise ValueError(f'Not a repository directory: {p}')
    return p
def safe_target(root, rel):
    p=Path(rel)
    if not isinstance(rel,str) or not rel.strip() or p.is_absolute() or '..' in p.parts: raise ValueError(f'Unsafe relative path: {rel}')
    out=(root/p).resolve(strict=False)
    try: out.relative_to(root)
    except ValueError as e: raise ValueError(f'Path escapes root: {rel}') from e
    cur=root
    for part in p.parts:
        cur=cur/part
        if cur.is_symlink():
            try: cur.resolve().relative_to(root)
            except ValueError as e: raise ValueError(f'Symlink escape: {rel}') from e
    return out
def load_spec(path):
    if not path.is_file() or path.stat().st_size>2_000_000: raise ValueError(f'Spec missing or too large: {path}')
    data=json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data,dict) or not isinstance(data.get('files'),list) or len(data['files'])>500: raise ValueError('Spec needs a files array with at most 500 items.')
    seen=set()
    for item in data['files']:
        if not isinstance(item,dict) or not isinstance(item.get('path'),str): raise ValueError('Each item needs a string path.')
        key=Path(item['path']).as_posix().casefold()
        if key in seen: raise ValueError(f'Duplicate path: {item["path"]}')
        seen.add(key)
    return data
def render(item):
    kind=item.get('kind','text').lower(); rel=item['path']
    if kind not in KINDS: raise ValueError(f'Unsupported kind: {kind}')
    if kind=='json':
        if 'data' not in item: raise ValueError(f'JSON needs data: {rel}')
        content=json.dumps(item['data'],ensure_ascii=False,indent=2)+'\\n'
    elif 'content' in item:
        if not isinstance(item['content'],str): raise ValueError('content must be text')
        content=item['content']
    elif kind=='html':
        d=item.get('data',{}); title=str(d.get('title',Path(rel).stem.title()))
        desc=str(d.get('description','Education and career guidance from MedOrbits.'))
        css=str(d.get('css','/assets/css/main.css')); js=str(d.get('js','/assets/js/main.js'))
        content='<!doctype html>\\n<html lang="en">\\n<head>\\n<meta charset="utf-8">\\n<meta name="viewport" content="width=device-width, initial-scale=1">\\n<meta name="description" content="'+desc+'">\\n<title>'+title+'</title>\\n<link rel="stylesheet" href="'+css+'">\\n</head>\\n<body>\\n<main><h1>'+title+'</h1></main>\\n<script src="'+js+'" defer></script>\\n</body>\\n</html>\\n'
    else:
        templates={'text':'','markdown':'# '+Path(rel).stem.title()+'\\n\\n','python':'# Generated Python module\\nfrom __future__ import annotations\\n\\ndef main() -> int:\\n    return 0\\n\\nif __name__ == "__main__":\\n    raise SystemExit(main())\\n','js':'"use strict";\\n','css':'/* Generated stylesheet */\\n:root { color-scheme: light; }\\n','env':'# Template only; never commit secrets.\\n'}
        content=templates[kind]
    raw=content.encode('utf-8')
    if len(raw)>5_000_000: raise ValueError(f'Output too large: {rel}')
    return raw
def atomic_write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.local-agent-',dir=str(path.parent))
    try:
        with os.fdopen(fd,'wb') as f: f.write(data); f.flush(); os.fsync(f.fileno())
        os.replace(tmp,path)
    except Exception:
        try: os.unlink(tmp)
        except OSError: pass
        raise
def generate(root,specfile,apply=False,force=False):
    spec=load_spec(specfile); plan=[]; errors=[]
    for item in spec['files']:
        try:
            target=safe_target(root,item['path']); payload=render(item)
            plan.append((target,payload,'SKIP' if target.exists() and not force else ('REPLACE' if target.exists() else 'CREATE')))
        except Exception as e: errors.append(f'ERROR {item.get("path","?")}: {e}')
    for e in errors: print(e)
    if errors: print('No writes: fix invalid spec entries.'); return 2
    for target,payload,action in plan:
        rel=target.relative_to(root)
        if action=='SKIP': print(f'SKIP {rel} (exists; use --force to replace)')
        elif not apply: print(f'WOULD_{action} {rel} ({len(payload)} bytes)')
        else:
            if action=='REPLACE':
                stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
                backup=safe_target(root,f'.local-agent/backups/{stamp}/{rel.as_posix()}')
                backup.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(target,backup); print(f'BACKUP {backup.relative_to(root)}')
            atomic_write(target,payload); print(f'{action} {rel}')
    print(f'{len(plan)} item(s); {"applied" if apply else "dry-run only"}.'); return 0
def files(root):
    for cur,dirs,names in os.walk(root,followlinks=False):
        dirs[:]=[d for d in dirs if d not in SKIP and not (Path(cur)/d).is_symlink()]
        for name in names:
            p=Path(cur)/name
            if p.is_file() and not p.is_symlink(): yield p
def validate(root):
    errors=[]; warnings=[]; counts={'JSON':0,'Python':0,'HTML':0}
    for p in files(root):
        rel=p.relative_to(root).as_posix()
        if p.stat().st_size>5_000_000: continue
        try:
            if p.suffix.lower()=='.json':
                counts['JSON']+=1
                try: json.loads(p.read_text(encoding='utf-8'))
                except Exception as e: errors.append(f'JSON {rel}: {e}')
            elif p.suffix.lower()=='.py':
                counts['Python']+=1
                try: ast.parse(p.read_text(encoding='utf-8'),filename=rel)
                except Exception as e: errors.append(f'PYTHON {rel}: {e}')
            elif p.suffix.lower() in ('.html','.htm'):
                counts['HTML']+=1; body=p.read_text(encoding='utf-8')
                for ref in re.findall(r'''(?:src|href)\\s*=\\s*['"]([^'"]+)['"]''',body,re.I):
                    if ref.startswith(('http:','https:','//','data:','mailto:','tel:','#')): continue
                    local=ref.split('?',1)[0].split('#',1)[0]
                    target=root/local.lstrip('/') if local.startswith('/') else p.parent/local
                    if local and not target.exists(): warnings.append(f'Missing reference in {rel}: {ref}')
        except (OSError,UnicodeError) as e: warnings.append(f'READ {rel}: {e}')
    print('Counts:',counts)
    for e in errors: print('ERROR',e)
    for w in warnings: print('WARN',w)
    print(f'{len(errors)} error(s), {len(warnings)} warning(s)')
    return 1 if errors else 0
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',default='.'); sub=ap.add_subparsers(dest='cmd',required=True)
    sub.add_parser('status'); sub.add_parser('validate'); sub.add_parser('inventory')
    for name in ('plan','create','scaffold'):
        p=sub.add_parser(name); p.add_argument('--spec',required=True)
        if name=='create': p.add_argument('--dry-run',action='store_true'); p.add_argument('--force',action='store_true')
        if name=='scaffold': p.add_argument('--apply',action='store_true'); p.add_argument('--force',action='store_true')
    a=ap.parse_args()
    try:
        root=safe_root(a.root)
        if a.cmd=='status':
            print(f'MedOrbits Local Agent {VERSION}\\nRoot: {root}')
            for m in ('package.json','requirements.txt','pyproject.toml','server.js','index.html','pages','assets','tools','api','tests'):
                if (root/m).exists(): print('FOUND',m)
            print('Safe mode: no network, installs, code execution, deployment or Git mutation.'); return 0
        if a.cmd=='validate': return validate(root)
        if a.cmd=='inventory':
            for p in files(root): print(p.relative_to(root).as_posix())
            return 0
        spec=Path(a.spec).expanduser().resolve()
        if a.cmd=='plan': return generate(root,spec)
        if a.cmd=='create': return generate(root,spec,not a.dry_run,a.force)
        if a.cmd=='scaffold': return generate(root,spec,a.apply,a.force)
    except (ValueError,OSError,json.JSONDecodeError) as e: print('ERROR:',e,file=sys.stderr); return 2
    return 2
if __name__=='__main__': raise SystemExit(main())
