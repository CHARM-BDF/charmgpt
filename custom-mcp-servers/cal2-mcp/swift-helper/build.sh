#!/bin/bash
set -e

# Navigate to script directory
cd "$(dirname "$0")"

echo "Building CalendarHelper in release mode..."
swift build -c release

# Define paths
HELPER=.build/release/CalendarHelper
APP_DIR=../bin/CalendarHelper.app
APP_CONTENTS="$APP_DIR/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"

echo "Creating app bundle structure..."
rm -rf "$APP_DIR"
mkdir -p "$APP_MACOS"

echo "Moving binary to app bundle..."
cp "$HELPER" "$APP_MACOS/CalendarHelper"

echo "Creating Info.plist..."
cat > "$APP_CONTENTS/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>com.example.calendarhelper</string>
  <key>CFBundleName</key><string>CalendarHelper</string>
  <key>CFBundleExecutable</key><string>CalendarHelper</string>
  <key>NSCalendarsUsageDescription</key>
    <string>Your MCP server needs calendar access to list and manage events.</string>
</dict>
</plist>
EOF

echo "Copying entitlements..."
cp calendar.entitlements "$APP_CONTENTS/"

echo "Signing the app bundle..."
codesign --force --deep --options runtime \
         --entitlements calendar.entitlements \
         -s - "$APP_DIR"

echo "Done! App bundle is at $APP_DIR"
echo ""
echo "Before using this helper, run it once to trigger the calendar permission prompt:"
echo "  open -W \"$APP_DIR\" --args list-calendars"
echo ""

# Also create a regular binary for backwards compatibility
echo "Creating regular binary for backwards compatibility..."
mkdir -p ../bin
cp "$HELPER" ../bin/CalendarHelper
codesign --force --options runtime \
         --entitlements calendar.entitlements \
         -s - ../bin/CalendarHelper
echo "Binary also available at ../bin/CalendarHelper" 