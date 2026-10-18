#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/logs
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build/Simulator \
  -clonedSourcePackagesDirPath build/SourcePackages \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= build \
  2>&1 | tee build/logs/simulator-build.log
DEVICE=$(xcrun simctl list devices available --json | python3 -c \
  'import json,sys; devices=json.load(sys.stdin)["devices"]; print(next(d["udid"] for group in devices.values() for d in group if d.get("isAvailable") and "iPhone" in d["name"]))')
xcrun simctl boot "$DEVICE"
xcrun simctl bootstatus "$DEVICE" -b
xcrun simctl install "$DEVICE" build/Simulator/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch "$DEVICE" io.github.daipaibulaotie.jmcomic | tee build/logs/simulator-launch.log
sleep 8
xcrun simctl spawn "$DEVICE" launchctl list | awk \
  '$3 ~ /io.github.daipaibulaotie.jmcomic/ && $1 ~ /^[0-9]+$/ { print; found=1 } END { exit !found }' \
  > build/logs/simulator-process.txt
xcrun simctl io "$DEVICE" screenshot build/logs/simulator.png
xcrun simctl shutdown "$DEVICE"
