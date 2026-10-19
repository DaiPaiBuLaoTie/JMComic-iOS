#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/logs
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build/Simulator \
  -clonedSourcePackagesDirPath build/SourcePackages \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= build \
  2>&1 | tee build/logs/simulator-build.log
xcrun simctl list --json > build/logs/simulators.json
DEVICE=$(python3 - <<'PY'
import json
import sys
from pathlib import Path
state = json.loads(Path('build/logs/simulators.json').read_text())
for runtime in sorted(state['runtimes'], key=lambda r: tuple(int(p) for p in r['version'].split('.')), reverse=True):
    if not runtime.get('isAvailable') or '.iOS-' not in runtime['identifier']:
        continue
    devices = state['devices'].get(runtime['identifier'], [])
    device = next((d for d in devices if d.get('isAvailable') and 'iPhone' in d['name']), None)
    if device:
        print(device['udid'])
        print(f"Selected {device['name']} on iOS {runtime['version']}", file=sys.stderr)
        break
else:
    raise SystemExit('No available iPhone simulator')
PY
)
trap 'xcrun simctl shutdown "$DEVICE" >/dev/null 2>&1 || true' EXIT
xcrun simctl boot "$DEVICE"
python3 - "$DEVICE" <<'PY'
import subprocess
import sys
subprocess.run(['xcrun', 'simctl', 'bootstatus', sys.argv[1], '-b'], check=True, timeout=600)
PY
xcrun simctl install "$DEVICE" build/Simulator/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch "$DEVICE" io.github.daipaibulaotie.jmcomic | tee build/logs/simulator-launch.log
sleep 8
xcrun simctl spawn "$DEVICE" launchctl list | awk \
  '$3 ~ /io.github.daipaibulaotie.jmcomic/ && $1 ~ /^[0-9]+$/ { print; found=1 } END { exit !found }' \
  > build/logs/simulator-process.txt
xcrun simctl io "$DEVICE" screenshot build/logs/simulator.png
