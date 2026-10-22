"""Packaging regressions; no OCR stubs, servers or external requests."""
import contextlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
import zipfile

module_path = pathlib.Path(__file__).resolve().parents[1] / 'scripts/package-candidate.py'
spec = importlib.util.spec_from_file_location('candidate_package', module_path)
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)
TEST_ROOT = pathlib.Path(module_path).parents[1] / 'test-artifacts'
TEST_ROOT.mkdir(exist_ok=True)


@contextlib.contextmanager
def local_temp():
    with tempfile.TemporaryDirectory(prefix='turnos-package-test-', dir=TEST_ROOT) as folder:
        if not pathlib.Path(folder).resolve().is_relative_to(TEST_ROOT.resolve()):
            raise RuntimeError('Temporary path outside test workspace')
        yield folder


class PackagingTests(unittest.TestCase):
    def test_external_and_ambiguous_paths_are_rejected(self):
        for value in ['../outside.txt', '/absolute.txt', 'C:/outside.txt', 'a\\b', 'a//b', './a', 'a/../b', 'a/', '.', 'a\x00b']:
            with self.subTest(path=value), self.assertRaisesRegex(ValueError, 'UNSAFE_PATH'):
                package.safe_path(value)

    def test_operational_files_are_rejected(self):
        for value in ['.git/config', 'docs/.env.production', 'tests/session.log', 'node_modules/a.js']:
            with self.subTest(path=value), self.assertRaisesRegex(ValueError, 'OPERATIONAL_PATH'):
                package.safe_path(value)

    def test_missing_application_source_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'REQUIRED_SOURCE_MISSING'):
            package.validate_manifest({'schemaVersion': 1, 'version': '0.5.0', 'files': []})

    def test_duplicate_manifest_entry_is_rejected(self):
        item = {'path': 'README.md', 'bytes': 0, 'sha256': '0' * 64}
        with self.assertRaisesRegex(ValueError, 'DUPLICATE_OR_RESERVED_PATH'):
            package.validate_manifest({'schemaVersion': 1, 'version': '0.5.0', 'files': [item, item]})

    def test_unknown_schema_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'MANIFEST_SCHEMA'):
            package.validate_manifest({'schemaVersion': 99, 'version': '0.5.0', 'files': []})

    def test_broken_local_asset_link_is_rejected(self):
        web = {'index.html': b'<script src="/assets/missing.js"></script>', 'legal/index.html': b'<a href="/">Inicio</a>'}
        with self.assertRaisesRegex(ValueError, 'MISSING_LINKED_WEB_FILE'):
            package.verify_html_links(web)

    def test_external_asset_link_is_rejected(self):
        web = {'index.html': b'<script src="https://example.invalid/a.js"></script>', 'legal/index.html': b''}
        with self.assertRaisesRegex(ValueError, 'EXTERNAL_HTML_LINK'):
            package.verify_html_links(web)

    def test_zip_has_exact_frozen_bytes_and_cannot_overwrite(self):
        with local_temp() as folder:
            target = pathlib.Path(folder) / 'snapshot.zip'
            source = bytearray(b'confirmed bytes')
            payloads = {'source/README.md': bytes(source), 'web/index.html': b'local'}
            source[:] = b'changed later!!'
            self.assertEqual(package.write_verified_zip(target, payloads), 3)
            with zipfile.ZipFile(target) as archive:
                self.assertEqual(archive.read('source/README.md'), b'confirmed bytes')
                manifest = json.loads(archive.read('ARTIFACT-MANIFEST.json'))
                self.assertEqual({r['path'] for r in manifest['files']}, set(payloads))
            with self.assertRaises(FileExistsError):
                package.write_verified_zip(target, payloads)

    def test_unsafe_zip_member_is_rejected_before_creating_output(self):
        with local_temp() as folder:
            target = pathlib.Path(folder) / 'unsafe.zip'
            with self.assertRaisesRegex(ValueError, 'UNSAFE_PATH'):
                package.write_verified_zip(target, {'source/../outside': b'x'})
            self.assertFalse(target.exists())


if __name__ == '__main__':
    unittest.main()
