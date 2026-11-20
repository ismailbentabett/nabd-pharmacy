#!/usr/bin/env bash
# Phase 0: verify tools, scaffold Expo SDK 58 into THIS folder without clobbering the workspace, install SDK-matched deps.
# Safe to re-run. Never deletes anything.
set -euo pipefail
cd "$(dirname "$0")/.."
need() { command -v "$1" >/dev/null 2>&1 || { echo "✖ missing: $1 ($2)"; MISSING=1; }; }
MISSING=0
need node "install Node 22 LTS"; need npm "comes with node"; need git "install git"; need java "JDK 17 required for Android builds"
command -v adb >/dev/null 2>&1 || echo "⚠ adb not found (Android platform-tools needed for device runs + perf scripts)"
[ "$MISSING" = 1 ] && exit 1
node -e "const v=+process.versions.node.split('.')[0]; if(v<20){console.error('✖ Node >= 20 required, have '+process.version);process.exit(1)}"
[ -d .git ] || { git init -q -b main && echo "✔ git init (branch main)"; }

if [ ! -f package.json ]; then
  TMP="$(mktemp -d)"
  echo "▶ scaffolding Expo SDK 58 in $TMP"
  npx --yes create-expo-app@latest "$TMP/app" --template default@sdk-58 --no-install --yes || {
    echo "✖ template default@sdk-58 failed. Try: npx create-expo-app@latest $TMP/app --template default --no-install  then verify expo version is 58.x"; exit 1; }
  # copy scaffold files without overwriting existing workspace files (cp -n), include dotfiles
  ( cd "$TMP/app" && tar cf - . ) | tar xf - --skip-old-files
  echo "✔ scaffold copied (existing files kept)"
fi

echo "▶ installing dependencies (SDK-matched via expo install)"
npm install --no-audit --no-fund
npx expo install react-native-reanimated react-native-worklets react-native-gesture-handler react-native-safe-area-context react-native-svg \
  @shopify/flash-list expo-image expo-haptics expo-font expo-localization expo-build-properties expo-splash-screen \
  react-native-mmkv react-native-nitro-modules \
  @expo-google-fonts/ibm-plex-sans @expo-google-fonts/ibm-plex-sans-arabic
npm install --no-audit --no-fund zustand @tanstack/react-query lucide-react-native
npx expo install --dev jest-expo jest @types/jest @testing-library/react-native

echo; echo "▶ versions"
node -e "const p=require('./package.json').dependencies;for(const k of ['expo','react-native','react-native-reanimated','react-native-worklets','react-native-gesture-handler','@shopify/flash-list','expo-image','expo-router','react-native-mmkv']) console.log(k.padEnd(34),p[k]||'(missing)')"
node -e "const v=require('expo/package.json').version; if(!v.startsWith('58.')){console.error('⚠ expo is '+v+' (expected 58.x). If 57, require >= 57.0.17. NEVER 56.');}"
echo; npx expo-doctor || echo "⚠ expo-doctor reported issues — resolve before building features"
echo; command -v adb >/dev/null 2>&1 && adb devices || true
echo; echo "Done. Next: /plan in Claude Code. (Starter template files in app/ are replaced during Phase 3 with git rm on specific files.)"
