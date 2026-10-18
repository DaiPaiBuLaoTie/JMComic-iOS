#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/logs build/artifacts
xcodebuild -version | tee build/logs/xcode-version.txt
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App \
  -clonedSourcePackagesDirPath build/SourcePackages 2>&1 | tee build/logs/resolve.log
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$PWD/build/JMComic.xcarchive" \
  -derivedDataPath build/DerivedData -clonedSourcePackagesDirPath build/SourcePackages \
  -resultBundlePath build/archive.xcresult \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= \
  MARKETING_VERSION=0.1.0 CURRENT_PROJECT_VERSION="${GITHUB_RUN_NUMBER:-1}" \
  archive 2>&1 | tee build/logs/archive.log
python3 scripts/package-unsigned.py build/JMComic.xcarchive build/artifacts
