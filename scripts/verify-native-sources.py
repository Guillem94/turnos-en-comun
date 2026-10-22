"""Verify retained upstream sources without extracting or executing them."""
import hashlib, io, json, pathlib, tarfile
root=pathlib.Path(__file__).resolve().parent.parent
manifest=json.loads((root/'legal/sources/manifest.json').read_text('utf-8'))
required={'libheif-js':['scripts/install.js','scripts/bundle.js','package.json'], 'libheif-emscripten':['.github/workflows/emscripten.yml','.gitmodules','dist-prep.sh'], 'libheif':['build-emscripten.sh','COPYING','libheif/api/libheif/heif.h'], 'libde265':['COPYING','libde265/de265.h','autogen.sh']}
records=[]
for item in manifest['files']:
 data=(root/'legal/sources'/item['file']).read_bytes()
 if len(data)!=item['bytes'] or hashlib.sha256(data).hexdigest()!=item['sha256']:raise RuntimeError('Source integrity mismatch')
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
  names=[]
  for member in archive.getmembers():
   p=pathlib.PurePosixPath(member.name)
   if p.is_absolute() or '..' in p.parts:raise RuntimeError('Unsafe archive path')
   if len(p.parts)>1:names.append('/'.join(p.parts[1:]))
  if any(name not in names for name in required[item['name']]):raise RuntimeError('Required source/recipe missing: '+item['name'])
  records.append({'name':item['name'],'revision':item['revision'],'members':len(names),'requiredFiles':required[item['name']],'sha256':item['sha256']})
print(json.dumps({'status':'VERIFIED','archives':len(records),'scriptsExecuted':False,'records':records}))
