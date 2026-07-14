#!/usr/bin/env bash

set -euo pipefail

MODE=""
APP_PATH=""
DMG_PATH=""
EXPECTED_ARCH=""

usage() {
    cat <<'EOF'
Usage: verify-macos-distribution.sh --mode internal|release --app PATH --dmg PATH --arch arm64|x86_64
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode) MODE="${2:-}"; shift 2 ;;
        --app) APP_PATH="${2:-}"; shift 2 ;;
        --dmg) DMG_PATH="${2:-}"; shift 2 ;;
        --arch) EXPECTED_ARCH="${2:-}"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
    esac
done

if [[ "$MODE" != "internal" && "$MODE" != "release" ]]; then
    echo "--mode must be internal or release" >&2
    exit 2
fi
if [[ ! -d "$APP_PATH" || ! -f "$DMG_PATH" ]]; then
    echo "App or DMG is missing: app=$APP_PATH dmg=$DMG_PATH" >&2
    exit 1
fi
if [[ "$EXPECTED_ARCH" != "arm64" && "$EXPECTED_ARCH" != "x86_64" ]]; then
    echo "--arch must be arm64 or x86_64" >&2
    exit 2
fi

APP_BASENAME=$(basename "$APP_PATH")
DMG_BASENAME=$(basename "$DMG_PATH")
EXECUTABLE_NAME=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_PATH/Contents/Info.plist")
EXECUTABLE_PATH="$APP_PATH/Contents/MacOS/$EXECUTABLE_NAME"

if [[ ! -x "$EXECUTABLE_PATH" ]]; then
    echo "Main executable is missing or not executable: $EXECUTABLE_PATH" >&2
    exit 1
fi

echo "Verifying $APP_BASENAME ($EXPECTED_ARCH, $MODE)"
codesign --verify --deep --strict --verbose=4 "$APP_PATH"
SIGNATURE_DETAILS=$(codesign --display --verbose=4 "$APP_PATH" 2>&1)
printf '%s\n' "$SIGNATURE_DETAILS"

ARCHES=$(lipo -archs "$EXECUTABLE_PATH")
if [[ " $ARCHES " != *" $EXPECTED_ARCH "* ]]; then
    echo "Main executable architecture mismatch: expected=$EXPECTED_ARCH actual=$ARCHES" >&2
    exit 1
fi

hdiutil verify "$DMG_PATH"

case "$MODE" in
    internal)
        if [[ "$DMG_BASENAME" != INTERNAL-ADHOC-UNNOTARIZED-* ]]; then
            echo "Internal DMG must carry the INTERNAL-ADHOC-UNNOTARIZED prefix" >&2
            exit 1
        fi
        if ! grep -q '^Signature=adhoc$' <<<"$SIGNATURE_DETAILS"; then
            echo "Internal app is not ad-hoc signed" >&2
            exit 1
        fi
        echo "Internal ad-hoc signature and DMG integrity verified. Apple notarization is intentionally absent."
        ;;
    release)
        if [[ "$DMG_BASENAME" == INTERNAL-* ]]; then
            echo "Formal release cannot contain an INTERNAL artifact" >&2
            exit 1
        fi
        if ! grep -q '^Authority=Developer ID Application:' <<<"$SIGNATURE_DETAILS"; then
            echo "Developer ID Application authority is missing" >&2
            exit 1
        fi
        if ! grep -Eq '^TeamIdentifier=[A-Z0-9]+$' <<<"$SIGNATURE_DETAILS"; then
            echo "Apple TeamIdentifier is missing" >&2
            exit 1
        fi
        if ! grep -Eq '^CodeDirectory .*flags=.*\(runtime\)' <<<"$SIGNATURE_DETAILS"; then
            echo "Hardened Runtime is not enabled" >&2
            exit 1
        fi
        ENTITLEMENTS_FILE=$(mktemp "${TMPDIR:-/tmp}/blexagent-entitlements.XXXXXX.plist")
        trap 'rm -f "$ENTITLEMENTS_FILE"' EXIT
        codesign --display --entitlements :- "$APP_PATH" > "$ENTITLEMENTS_FILE" 2>/dev/null || true
        GET_TASK_ALLOW=$(/usr/libexec/PlistBuddy -c 'Print :com.apple.security.get-task-allow' "$ENTITLEMENTS_FILE" 2>/dev/null || echo false)
        if [[ "$GET_TASK_ALLOW" == "true" ]]; then
            echo "Release app contains the debug get-task-allow entitlement" >&2
            exit 1
        fi
        codesign --verify --deep --strict --verbose=4 "$DMG_PATH"
        spctl --assess --type execute --verbose=4 "$APP_PATH"
        spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG_PATH"
        xcrun stapler validate "$DMG_PATH"
        echo "Developer ID, Hardened Runtime, Gatekeeper and notarization ticket verified."
        ;;
esac
