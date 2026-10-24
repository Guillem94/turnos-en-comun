"""Package a stable local candidate, verifying the bytes actually written. No publication."""
import hashlib
import json
import pathlib
import re
import sys
import zipfile
from html.parser import HTMLParser
from urllib.parse import urlsplit

REQUIRED_SOURCE = {
    'LICENSE', 'README.md', 'THIRD-PARTY-NOTICES.md', 'package.json', 'package-lock.json',
    'index.html', 'src/main.jsx', 'src/App.jsx', 'src/domain.js', 'src/ics.js',
    'src/image-decoder.worker.js', 'scripts/prepare-assets.mjs', 'scripts/prepare-ocr.mjs',
    'scripts/prepare-tiff-source.mjs', 'vendor/manifest.json', 'vendor/utif/UTIF.mjs',
    'vendor/utif/LICENSE', 'vendor/pdfjs-jpeg/jpg.mjs', 'vendor/pdfjs-jpeg/jpg.original.js',
    'vendor/pdfjs-jpeg/LICENSE', 'legal/sources/manifest.json', 'docs/DISTRIBUTION.md',
}
REQUIRED_WEB = {
    'index.html', 'demo-ficticia.json', 'favicon.svg', 'legal/index.html',
    'legal/APPLICATION-LICENSE.txt', 'legal/THIRD-PARTY-NOTICES.txt',
    'legal/sources/manifest.json', 'codecs/libheif/libheif-bundle.mjs',
    'codecs/libheif/COPYING.txt', 'ocr/worker.min.js', 'ocr/worker.min.js.LICENSE.txt',
    'ocr/lang/eng.traineddata.gz',
}
FORBIDDEN = {'.git', '.codex', '.agents', 'node_modules', 'test-artifacts', '.ai-memory'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(value):
    if not isinstance(value, str) or not value or '\\' in value or ':' in value or value in {'.', '..'} or any(ord(c) < 32 for c in value):
        raise ValueError('UNSAFE_PATH')
    p = pathlib.PurePosixPath(value)
    if p.is_absolute() or p.as_posix() != value or any(part in {'.', '..'} for part in p.parts):
        raise ValueError('UNSAFE_PATH')
    if any(part.casefold() in FORBIDDEN or part.casefold().startswith('.env') or part.casefold().endswith('.log') for part in p.parts):
        raise ValueError('OPERATIONAL_PATH')
    return value


def regular_bytes(root, relative):
    safe_path(relative)
    current = root
    for part in pathlib.PurePosixPath(relative).parts:
        current = current / part
        if current.is_symlink() or (hasattr(current, 'is_junction') and current.is_junction()):
            raise ValueError('LINK_IN_SNAPSHOT')
    if not current.resolve(strict=True).is_relative_to(root) or not current.is_file():
        raise ValueError('NOT_A_REGULAR_INTERNAL_FILE')
    return current.read_bytes()


def validate_manifest(manifest):
    if manifest.get('schemaVersion') != 1 or not isinstance(manifest.get('version'), str):
        raise ValueError('MANIFEST_SCHEMA')
    if not isinstance(manifest.get('files'), list):
        raise ValueError('MANIFEST_SCHEMA')
    seen = set()
    folded = set()
    for item in manifest['files']:
        name = safe_path(item['path'])
        if name == 'CANDIDATE-MANIFEST.json' or name.casefold() in folded:
            raise ValueError('DUPLICATE_OR_RESERVED_PATH')
        if type(item.get('bytes')) is not int or item['bytes'] < 0 or not re.fullmatch('[0-9a-f]{64}', item.get('sha256', '')):
            raise ValueError('MANIFEST_RECORD')
        seen.add(name)
        folded.add(name.casefold())
    if not REQUIRED_SOURCE <= seen:
        raise ValueError('REQUIRED_SOURCE_MISSING')


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in {'href', 'src'} and value:
                self.paths.append((tag, name, value))


def verify_html_links(web):
    for page in ['index.html', 'legal/index.html']:
        parser = Links()
        parser.feed(web[page].decode('utf-8'))
        for tag, attribute, value in parser.paths:
            url = urlsplit(value)
            if url.scheme or url.netloc:
                if tag == 'a' and attribute == 'href' and value == 'https://github.com/Guillem94/turnos-en-comun':
                    continue
                raise ValueError('EXTERNAL_HTML_LINK')
            if not url.path or url.path == '/':
                continue
            parts = [] if url.path.startswith('/') else list(pathlib.PurePosixPath(page).parent.parts)
            for part in url.path.split('/'):
                if part in {'', '.'}:
                    continue
                if part == '..':
                    if not parts:
                        raise ValueError('UNSAFE_PATH')
                    parts.pop()
                else:
                    parts.append(part)
            target = '/'.join(parts) or 'index.html'
            safe_path(target)
            if target not in web:
                raise ValueError('MISSING_LINKED_WEB_FILE')


def snapshot(candidate):
    manifest_bytes = regular_bytes(candidate, 'CANDIDATE-MANIFEST.json')
    manifest = json.loads(manifest_bytes)
    validate_manifest(manifest)
    source = {}
    for item in manifest['files']:
        data = regular_bytes(candidate, item['path'])
        if len(data) != item['bytes'] or digest(data) != item['sha256']:
            raise ValueError('SOURCE_HASH_MISMATCH')
        source[item['path']] = data
    package = json.loads(source['package.json'])
    lock = json.loads(source['package-lock.json'])
    if any(version != manifest['version'] for version in [package.get('version'), lock.get('version'), lock.get('packages', {}).get('', {}).get('version')]):
        raise ValueError('VERSION_MISMATCH')
    web = {}
    build = candidate / 'dist'
    if build.is_symlink() or (hasattr(build, 'is_junction') and build.is_junction()):
        raise ValueError('LINK_IN_SNAPSHOT')
    for file in build.rglob('*'):
        if file.is_symlink() or (hasattr(file, 'is_junction') and file.is_junction()):
            raise ValueError('LINK_IN_SNAPSHOT')
        if file.is_file():
            relative = file.relative_to(build).as_posix()
            web[relative] = regular_bytes(build, relative)
    if not REQUIRED_WEB <= web.keys():
        raise ValueError('REQUIRED_WEB_MISSING')
    for source_name, web_name in [('LICENSE', 'legal/APPLICATION-LICENSE.txt'), ('THIRD-PARTY-NOTICES.md', 'legal/THIRD-PARTY-NOTICES.txt'), ('legal/sources/manifest.json', 'legal/sources/manifest.json')]:
        if source[source_name] != web[web_name]:
            raise ValueError('NOTICE_SOURCE_WEB_MISMATCH')
    native = json.loads(source['legal/sources/manifest.json'])
    if native.get('schemaVersion') != 1 or len(native.get('files', [])) != 4 or {f['name'] for f in native['files']} != {'libheif-js', 'libheif-emscripten', 'libheif', 'libde265'}:
        raise ValueError('NATIVE_SOURCES_INCOMPLETE')
    for item in native['files']:
        relative = 'legal/sources/' + safe_path(item['file'])
        data = source.get(relative)
        if data is None or data != web.get(relative) or len(data) != item['bytes'] or digest(data) != item['sha256']:
            raise ValueError('NATIVE_SOURCE_MISMATCH')
    verify_html_links(web)
    payloads = {'source/' + name: data for name, data in source.items()}
    payloads['source/CANDIDATE-MANIFEST.json'] = manifest_bytes
    payloads.update({'web/' + name: data for name, data in web.items()})
    payloads['LEEME.txt'] = ('Turnos en Comun ' + manifest['version'] + '\nCodigo propio MIT, Copyright (c) 2026 Guillem Carrion.\nConservar web y source juntos con avisos/fuentes de terceros.\nArranque y reconstruccion: source/README.md y source/docs/DISTRIBUTION.md.\nPaquete local; sin publicacion ni remoto.\n').encode('utf-8')
    return manifest, payloads, len(web)


def write_verified_zip(output, payloads):
    if 'ARTIFACT-MANIFEST.json' in payloads:
        raise ValueError('RESERVED_ARTIFACT_MANIFEST')
    entries = []
    for name, data in sorted(payloads.items()):
        safe_path(name)
        entries.append({'path': name, 'bytes': len(data), 'sha256': digest(data)})
    frozen = dict(payloads)
    frozen['ARTIFACT-MANIFEST.json'] = (json.dumps({'schemaVersion': 1, 'files': entries}, indent=2) + '\n').encode('utf-8')
    with zipfile.ZipFile(output, 'x') as archive:
        for name, data in sorted(frozen.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, data)
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() or len(archive.namelist()) != len(frozen) or set(archive.namelist()) != set(frozen):
            raise ValueError('ZIP_INVENTORY_MISMATCH')
        for name, expected in frozen.items():
            if archive.read(name) != expected:
                raise ValueError('ZIP_SNAPSHOT_MISMATCH')
    return len(frozen)


def main():
    candidate = pathlib.Path(sys.argv[1]).resolve(strict=True)
    output = candidate.parent / (candidate.name + '-web-and-source.zip')
    if output.exists():
        raise ValueError('PACKAGE_EXISTS_INSPECT_BEFORE_REPEATING')
    manifest, payloads, web_count = snapshot(candidate)
    members = write_verified_zip(output, payloads)
    receipt = {'status': 'VERIFIED', 'file': str(output), 'bytes': output.stat().st_size,
               'sha256': digest(output.read_bytes()), 'sourceFiles': len(manifest['files']),
               'webFiles': web_count, 'zipFiles': members, 'allSnapshotMembersVerified': True,
               'verification': 'Safe paths, mandatory files, versions, HTML links, native source mirrors, CRC and exact frozen bytes. Clean-build correspondence is checked separately.',
               'published': False}
    output.with_suffix('.receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', 'utf-8', newline='\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
