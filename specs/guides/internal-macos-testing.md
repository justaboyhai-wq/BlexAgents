# BlexAgent macOS internal test build

This package is for approved internal testing only. It is ad-hoc signed so that
the Apple Silicon executable and all bundled native code have a consistent code
signature, but it is **not** signed with BlexAgent's Developer ID and is **not**
notarized by Apple.

## Install safely

1. Confirm that the downloaded artifact name starts with
   `INTERNAL-ADHOC-UNNOTARIZED`.
2. Open the DMG and drag BlexAgent to Applications.
3. Try to open BlexAgent normally.
4. If macOS blocks the app, open **System Settings > Privacy & Security**, review
   the warning, and choose **Open Anyway** only when the build came from the
   private BlexAgent repository and its checksum matches the build record.

Do not disable Gatekeeper and do not run blanket `xattr` commands. Public or
customer-facing builds must use the formal release workflow, Developer ID
signing, Apple notarization, and a stapled notarization ticket.
