#!/usr/bin/env bash
# Build, sign, notarize and staple Flowstate for distribution outside the
# App Store. Run once the Developer ID Application certificate is installed.
#
# Credentials come from the environment and are never written to the repo:
#
#   export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
#   export APPLE_ID="you@example.com"
#   export APPLE_PASSWORD="abcd-efgh-ijkl-mnop"   # app-specific password
#   export APPLE_TEAM_ID="TEAMID"
#
# Then: ./scripts/release-mac.sh
set -euo pipefail

cd "$(dirname "$0")/.."

for var in APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID; do
  if [ -z "${!var:-}" ]; then
    echo "Missing $var. See the header of this script." >&2
    exit 1
  fi
done

if ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  echo "No Developer ID Application certificate in the keychain." >&2
  exit 1
fi

echo "==> Building and signing"
# Tauri signs during bundling when APPLE_SIGNING_IDENTITY is set. The dmg
# bundler drives Finder over AppleScript and fails headless, so build the
# .app here and package the dmg below.
npx tauri build --bundles app

APP="src-tauri/target/release/bundle/macos/Flowstate.app"
DMG_DIR="src-tauri/target/release/bundle/dmg"
DMG="$DMG_DIR/Flowstate.dmg"

echo "==> Verifying signature"
codesign --verify --deep --strict --verbose=2 "$APP"

echo "==> Packaging dmg"
mkdir -p "$DMG_DIR"
STAGE="$(mktemp -d)"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname Flowstate -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"

echo "==> Signing the dmg"
codesign --sign "$APPLE_SIGNING_IDENTITY" --timestamp "$DMG"

echo "==> Notarizing (Apple usually answers in a few minutes)"
xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

echo "==> Stapling the ticket"
# Staples the notarization to the file itself, so it opens cleanly even for
# someone offline the first time they run it.
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"

echo
echo "Done: $DMG"
echo "Gatekeeper check:"
spctl --assess --type open --context context:primary-signature -v "$DMG" || true
