import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('package_unsigned', Path(__file__).parents[1] / 'scripts/package-unsigned.py')
packaging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packaging)


class PackagingValidationTests(unittest.TestCase):
    def binary(self, platform=2, architecture=0x0100000C, signature=False):
        commands = struct.pack('<IIIIII', 0x32, 24, platform, 0, 0, 0)
        if signature:
            commands += struct.pack('<IIII', 0x1D, 16, 0, 0)
        return struct.pack('<IIIIIIII', 0xFEEDFACF, architecture, 0, 2,
                           2 if signature else 1, len(commands), 0, 0) + commands

    def check(self, **kwargs):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'executable'
            file.write_bytes(self.binary(**kwargs))
            packaging.verify_macho(file)

    def test_accepts_unsigned_arm64_device_header(self):
        self.check()

    def test_rejects_simulator_header(self):
        with self.assertRaisesRegex(ValueError, 'physical iOS'):
            self.check(platform=7)

    def test_rejects_wrong_architecture(self):
        with self.assertRaisesRegex(ValueError, 'arm64'):
            self.check(architecture=0x01000007)

    def test_rejects_signature_load_command(self):
        with self.assertRaisesRegex(ValueError, 'code-signature'):
            self.check(signature=True)


if __name__ == '__main__':
    unittest.main()
