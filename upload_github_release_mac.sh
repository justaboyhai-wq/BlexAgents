#!/usr/bin/env bash
# 上传 macOS 构建产物（DMG）到 GitHub Release
# 可独立运行，也被 publish_release.sh 调用
#
# 用法: ./upload_github_release_mac.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# 读取版本号
VERSION=$(grep '"version"' "${PROJECT_DIR}/src-tauri/tauri.conf.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
BUNDLE_DIR="${PROJECT_DIR}/src-tauri/target"

echo ""
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}  上传 macOS 产物到 GitHub Release${NC}"
echo -e "${CYAN}  Version: v${VERSION}${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# 检查 gh CLI
if ! command -v gh &> /dev/null; then
    echo -e "${RED}[X] gh CLI 未安装${NC}"
    echo -e "${YELLOW}    安装: brew install gh${NC}"
    exit 1
fi

# 查找 DMG 文件
ARM_DIR="${BUNDLE_DIR}/aarch64-apple-darwin/release/bundle"
INTEL_DIR="${BUNDLE_DIR}/x86_64-apple-darwin/release/bundle"

GH_FILES=()

ARM_DMG=$(find "${ARM_DIR}/dmg" -name "*.dmg" 2>/dev/null | head -1 || true)
if [ -n "$ARM_DMG" ] && [ -f "$ARM_DMG" ]; then
    GH_FILES+=("$ARM_DMG")
    echo -e "  ${GREEN}✓${NC} $(basename "$ARM_DMG")"
fi

INTEL_DMG=$(find "${INTEL_DIR}/dmg" -name "*.dmg" 2>/dev/null | head -1 || true)
if [ -n "$INTEL_DMG" ] && [ -f "$INTEL_DMG" ]; then
    GH_FILES+=("$INTEL_DMG")
    echo -e "  ${GREEN}✓${NC} $(basename "$INTEL_DMG")"
fi

if [ -z "$ARM_DMG" ] || [ -z "$INTEL_DMG" ]; then
    echo -e "${RED}[X] 正式 GitHub Release 必须同时包含 ARM64 与 Intel DMG${NC}"
    exit 1
fi

for dmg in "$ARM_DMG" "$INTEL_DMG"; do
    case "$(basename "$dmg")" in
        INTERNAL-*)
            echo -e "${RED}[X] 拒绝上传内部测试物料: $(basename "$dmg")${NC}"
            exit 1
            ;;
    esac
done

ARM_APP=$(find "${ARM_DIR}/macos" -name "*.app" 2>/dev/null | head -1 || true)
INTEL_APP=$(find "${INTEL_DIR}/macos" -name "*.app" 2>/dev/null | head -1 || true)
if [ ! -d "$ARM_APP" ] || [ ! -d "$INTEL_APP" ]; then
    echo -e "${RED}[X] 缺少双架构 .app，无法验证签名与公证${NC}"
    exit 1
fi

bash "${PROJECT_DIR}/scripts/verify-macos-distribution.sh" \
    --mode release --app "$ARM_APP" --dmg "$ARM_DMG" --arch arm64
bash "${PROJECT_DIR}/scripts/verify-macos-distribution.sh" \
    --mode release --app "$INTEL_APP" --dmg "$INTEL_DMG" --arch x86_64

echo ""

# 检查 Release 是否存在
if ! gh release view "v${VERSION}" &>/dev/null; then
    echo -e "${RED}[X] GitHub Release v${VERSION} 不存在${NC}"
    echo -e "${YELLOW}    请先通过 merge-release 流程创建 Release${NC}"
    exit 1
fi

# 上传
echo -e "上传 ${#GH_FILES[@]} 个文件到 GitHub Release v${VERSION}..."
if gh release upload "v${VERSION}" "${GH_FILES[@]}" --clobber; then
    echo ""
    echo -e "${GREEN}[OK] GitHub Release 上传完成${NC}"
    for f in "${GH_FILES[@]}"; do
        echo -e "  • $(basename "$f")"
    done
else
    echo -e "${RED}[X] 上传失败${NC}"
    exit 1
fi
