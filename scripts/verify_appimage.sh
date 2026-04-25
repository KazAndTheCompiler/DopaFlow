#!/bin/bash
# Verify AppImage dependencies and structure

set -e

APPIMAGE_DIR="desktop/dist"
echo "Verifying AppImage build..."

# Check if AppImage files exist
if ! ls "$APPIMAGE_DIR"/DopaFlow-*.AppImage 1>/dev/null 2>&1; then
  echo "❌ No AppImage files found in $APPIMAGE_DIR"
  exit 1
fi

# Check AppImage is executable
for appimage in "$APPIMAGE_DIR"/DopaFlow-*.AppImage; do
  if [[ -x "$appimage" ]]; then
    echo "✓ $appimage is executable"
  else
    echo "⚠ $appimage is not executable, fixing..."
    chmod +x "$appimage"
  fi
  
  # Check AppImage size (should be > 50MB with bundled backend)
  size=$(stat -c%s "$appimage" 2>/dev/null || stat -f%z "$appimage")
  if [[ $size -gt 50000000 ]]; then
    echo "✓ $appimage size OK ($(($size / 1024 / 1024)) MB)"
  else
    echo "⚠ $appimage may be missing backend (size: $(($size / 1024 / 1024)) MB)"
  fi
done

# Verify zsync file exists for delta updates
if ls "$APPIMAGE_DIR"/DopaFlow-*.AppImage.zsync 1>/dev/null 2>&1; then
  echo "✓ zsync delta update files present"
else
  echo "⚠ No zsync files (delta updates not available)"
fi

# Check latest-linux.yml for auto-updater
if [[ -f "$APPIMAGE_DIR/latest-linux.yml" ]]; then
  echo "✓ latest-linux.yml for auto-updater"
else
  echo "⚠ latest-linux.yml missing"
fi

echo ""
echo "✅ AppImage verification complete"
