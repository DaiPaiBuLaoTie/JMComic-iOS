"""Package and independently validate a physical-device, unsigned iOS app."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import struct
import subprocess
import sys
import zipfile


def verify_macho(binary):
    data = Path(binary).read_bytes()
    if len(data) < 32 or struct.unpack_from('<I', data)[0] != 0xFEEDFACF:
        raise ValueError('Expected a thin 64-bit Mach-O')
    if struct.unpack_from('<I', data, 4)[0] != 0x0100000C:
        raise ValueError('Executable is not arm64')
    offset = 32
    platform = None
    for _ in range(struct.unpack_from('<I', data, 16)[0]):
        command, size = struct.unpack_from('<II', data, offset)
        if size < 8 or offset + size > len(data):
            raise ValueError('Invalid Mach-O load commands')
        if command == 0x32:
            platform = struct.unpack_from('<I', data, offset + 8)[0]
        if command == 0x1D:
            raise ValueError('Executable still contains a code-signature command')
        offset += size
    if platform != 2:
        raise ValueError(f'Expected physical iOS platform 2, found {platform}')


def package(archive, output):
    archive, output = Path(archive).resolve(), Path(output).resolve()
    apps = list((archive / 'Products/Applications').glob('*.app'))
    if len(apps) != 1:
        raise ValueError('Archive must contain exactly one application')
    output.mkdir(parents=True, exist_ok=True)
    staging = output.parent / 'package-staging'
    if staging.exists():
        raise ValueError('Package staging already exists; use a fresh build directory')
    payload = staging / 'Payload'
    payload.mkdir(parents=True)
    app = payload / apps[0].name
    shutil.copytree(apps[0], app, symlinks=True)
    for bundle in sorted(app.rglob('*.framework')) + [app]:
        result = subprocess.run(['codesign', '-d', str(bundle)], capture_output=True)
        if result.returncode == 0:
            subprocess.run(['codesign', '--remove-signature', str(bundle)], check=True)
    for item in list(app.rglob('_CodeSignature')):
        shutil.rmtree(item)
    for item in list(app.rglob('embedded.mobileprovision')):
        item.unlink()
    info = plistlib.loads((app / 'Info.plist').read_bytes())
    if info.get('CFBundleSupportedPlatforms') != ['iPhoneOS']:
        raise ValueError('Application is not for physical iOS devices')
    if info.get('CFBundleIdentifier') != 'io.github.daipaibulaotie.jmcomic':
        raise ValueError('Unexpected application identifier')
    executable = app / info['CFBundleExecutable']
    if not executable.stat().st_mode & 0o111:
        raise ValueError('Main executable has no executable permissions')
    verify_macho(executable)
    for framework in app.rglob('*.framework'):
        framework_info = plistlib.loads((framework / 'Info.plist').read_bytes())
        verify_macho(framework / framework_info['CFBundleExecutable'])
    web = app / 'public'
    manifest = json.loads((web / 'web-manifest.json').read_text())
    if manifest['updatePolicy'] != 'bundled-only':
        raise ValueError('Unexpected update policy')
    for relative, expected in manifest['files'].items():
        actual = hashlib.sha256((web / relative).read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError(f'Bundled web resource hash mismatch: {relative}')
    target = output / 'JMComic-iOS-unsigned.ipa'
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as result:
        for file in sorted(payload.rglob('*')):
            if file.is_file():
                result.write(file, file.relative_to(staging))
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    (output / (target.name + '.sha256')).write_text(f'{digest}  {target.name}\n')
    metadata = {
        'application': 'JMComic-iOS', 'version': info['CFBundleShortVersionString'],
        'build': info['CFBundleVersion'], 'minimumIOS': info['MinimumOSVersion'],
        'bundleId': info['CFBundleIdentifier'], 'architecture': 'arm64', 'platform': 'iPhoneOS',
        'signed': False, 'updatePolicy': 'bundled-only', 'sourceApkSha256': manifest['sourceApkSha256'],
        'gitCommit': os.environ.get('GITHUB_SHA', ''), 'runId': os.environ.get('GITHUB_RUN_ID', ''),
        'sha256': digest,
    }
    (output / 'build-info.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'{target.name}: {digest}')


if __name__ == '__main__':
    package(*sys.argv[1:])
