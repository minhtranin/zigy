#!/bin/bash
set -e

APP="Zigy"
REPO="minhtranin/zigy"

echo "Installing $APP..."

DMG_URL=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep -o "https://.*aarch64\.dmg\"" | tr -d '"' | head -1)

if [ -z "$DMG_URL" ]; then
  echo "Error: could not find latest DMG release"
  exit 1
fi

TMP_DMG=$(mktemp /tmp/Zigy_XXXXXX.dmg)

echo "Downloading..."
curl -L --progress-bar "$DMG_URL" -o "$TMP_DMG"

echo "Mounting..."
MOUNT_OUTPUT=$(hdiutil attach "$TMP_DMG" -nobrowse -noautoopen)
MOUNT_POINT=$(echo "$MOUNT_OUTPUT" | grep "/Volumes/" | awk '{print $NF}')

if [ -z "$MOUNT_POINT" ]; then
  echo "Error: failed to mount DMG"
  rm "$TMP_DMG"
  exit 1
fi

echo "Installing to /Applications..."
cp -R "$MOUNT_POINT/$APP.app" /Applications/

echo "Unmounting..."
hdiutil detach "$MOUNT_POINT" -quiet

rm "$TMP_DMG"

echo ""
echo "$APP installed to /Applications/$APP.app"
echo "Launch from Applications or Spotlight"
echo ""
echo "Note: first launch — right-click Zigy → Open to bypass Gatekeeper"
