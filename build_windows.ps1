#!/usr/bin/env pwsh
# BlexAgent Windows 构建脚本
# 默认生成带 INTERNAL-UNSIGNED 标记的内部测试包；-RequireSigning 才是正式发布候选包。
# 支持 Windows x64

param(
    [switch]$SkipTypeCheck,
    [switch]$SkipPortable,
    [switch]$NonInteractive,
    [switch]$RequireSigning
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
$BuildSuccess = $false
$UnsignedBuildConfig = $null

try {
    $ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    Set-Location $ProjectDir
    . (Join-Path $ProjectDir "scripts\windows-build-helpers.ps1")

    # 读取版本号
    $TauriConf = Get-Content "src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json
    $Version = $TauriConf.version
    $TauriConfPath = Join-Path $ProjectDir "src-tauri\tauri.conf.json"
    $EnvFile = Join-Path $ProjectDir ".env"

    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Cyan
    $BuildKind = if ($RequireSigning) { "正式签名发布候选" } else { "内部无签名测试" }
    Write-Host "  BlexAgent Windows $BuildKind" -ForegroundColor Green
    Write-Host "  Version: $Version" -ForegroundColor Blue
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""

    # ========================================
    # 版本同步检查
    # ========================================
    $PkgJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $PkgVersion = $PkgJson.version

    $CargoToml = Get-Content "src-tauri\Cargo.toml" -Raw
    $CargoVersionMatch = [regex]::Match($CargoToml, 'version = "([^"]+)"')
    $CargoVersion = if ($CargoVersionMatch.Success) { $CargoVersionMatch.Groups[1].Value } else { "" }

    if ($PkgVersion -ne $Version -or $PkgVersion -ne $CargoVersion) {
        Write-Host "版本号不一致:" -ForegroundColor Yellow
        Write-Host "  package.json:    $PkgVersion" -ForegroundColor Cyan
        Write-Host "  tauri.conf.json: $Version" -ForegroundColor Cyan
        Write-Host "  Cargo.toml:      $CargoVersion" -ForegroundColor Cyan
        Write-Host ""
        if ($NonInteractive) {
            throw "非交互构建要求版本号预先同步"
        }
        $sync = Read-Host "是否同步版本号到 $PkgVersion? (y/N)"
        if ($sync -eq "y" -or $sync -eq "Y") {
            & node "$ProjectDir\scripts\sync-version.js"
            $Version = $PkgVersion
            Write-Host ""
        }
    }

    # ========================================
    # 加载环境变量
    # ========================================
    Write-Host "[1/7] 加载环境配置..." -ForegroundColor Blue

    if (Test-Path $EnvFile) {
        # 加载 .env (支持行内注释)
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match '^([^#=]+)=(.*)$') {
                $name = $Matches[1].Trim()
                $value = $Matches[2].Trim()

                # 处理带引号的值（提取引号内的内容，忽略引号外的注释）
                if ($value -match '^"([^"]*)"' -or $value -match "^'([^']*)'") {
                    $value = $Matches[1]
                } else {
                    # 无引号的值，移除行内注释
                    $value = $value -replace '\s+#.*$', ''
                    $value = $value.Trim()
                }

                [Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
        Write-Host "  OK - 已加载 .env" -ForegroundColor Green
    }
    else {
        Write-Host "  警告: .env 文件不存在，将使用默认配置" -ForegroundColor Yellow
    }

    # 检查 Tauri 签名密钥
    $TauriSigningKey = [Environment]::GetEnvironmentVariable("TAURI_SIGNING_PRIVATE_KEY", "Process")
    if (-not $TauriSigningKey) {
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Yellow
        Write-Host "  警告: TAURI_SIGNING_PRIVATE_KEY 未设置" -ForegroundColor Yellow
        Write-Host "  自动更新功能将不可用!" -ForegroundColor Yellow
        Write-Host "=========================================" -ForegroundColor Yellow
        Write-Host ""
        if ($RequireSigning) {
            throw "正式发布要求 TAURI_SIGNING_PRIVATE_KEY"
        }
        if (-not $NonInteractive) {
            $continue = Read-Host "是否继续构建? (Y/n)"
            if ($continue -eq "n" -or $continue -eq "N") {
                Write-Host "构建已取消" -ForegroundColor Red
                throw "用户取消构建"
            }
        }
        $UnsignedBuildConfig = Join-Path $env:TEMP "blexagent-tauri-unsigned-$PID.json"
        [System.IO.File]::WriteAllText(
            $UnsignedBuildConfig,
            '{"bundle":{"createUpdaterArtifacts":false}}',
            (New-Object System.Text.UTF8Encoding($false))
        )
        Write-Host "  本地测试构建将跳过 Tauri 更新包，仅生成安装包" -ForegroundColor Yellow
    }
    else {
        Write-Host "  OK - Tauri 签名私钥已配置" -ForegroundColor Green
    }

    if ($RequireSigning) {
        $signingConf = Get-Content $TauriConfPath -Raw | ConvertFrom-Json
        $thumbprint = $signingConf.bundle.windows.certificateThumbprint
        if ([string]::IsNullOrWhiteSpace($thumbprint)) {
            throw "正式发布要求在 Tauri 配置中设置 Windows 证书指纹"
        }
        $certificate = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Thumbprint -eq $thumbprint } | Select-Object -First 1
        if (-not $certificate) {
            throw "当前用户证书存储中未找到 Windows 代码签名证书: $thumbprint"
        }
        Write-Host "  OK - Windows 代码签名证书已就绪 ($thumbprint)" -ForegroundColor Green
    }
    Write-Host ""

    # ========================================
    # 检查统计上报配置 (VITE_ANALYTICS_*)。默认及正式工作流均关闭；任何启用都必须先完成隐私审查。
    # ========================================
    # 埋点是编译期 gate：isAnalyticsEnabled() 要求 VITE_ANALYTICS_ENABLED=true 且
    # API_KEY / ENDPOINT 非空 (src/renderer/analytics/config.ts)。.env 是 gitignored，
    # 不会随 git checkout 过来；三项任一缺失时 Vite 会把统计编译为完全关闭。
    Write-Host "[1.5/7] 检查统计上报配置..." -ForegroundColor Blue
    $AnalyticsEnabled = [Environment]::GetEnvironmentVariable("VITE_ANALYTICS_ENABLED", "Process")
    $AnalyticsKey = [Environment]::GetEnvironmentVariable("VITE_ANALYTICS_API_KEY", "Process")
    $AnalyticsEndpoint = [Environment]::GetEnvironmentVariable("VITE_ANALYTICS_ENDPOINT", "Process")
    $AnalyticsOn = ($AnalyticsEnabled -eq "true") `
        -and -not [string]::IsNullOrWhiteSpace($AnalyticsKey) `
        -and -not [string]::IsNullOrWhiteSpace($AnalyticsEndpoint)
    if ($AnalyticsOn) {
        Write-Host "  OK - 统计上报已启用 (endpoint=$AnalyticsEndpoint)" -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Yellow
        Write-Host "  OK: 统计上报未启用（默认隐私配置）" -ForegroundColor Green
        Write-Host "  只有完成隐私审查并同时配置三个 VITE_ANALYTICS_* 变量后才允许启用。" -ForegroundColor Yellow
        Write-Host "=========================================" -ForegroundColor Yellow
        Write-Host ""
        if (-not $NonInteractive) {
            $continueAnalytics = Read-Host "是否继续构建? (Y/n)"
            if ($continueAnalytics -eq "n" -or $continueAnalytics -eq "N") {
                Write-Host "构建已取消" -ForegroundColor Red
                throw "用户取消构建"
            }
        }
    }
    Write-Host ""

    # ========================================
    # 检查依赖
    # ========================================
    Write-Host "[2/7] 检查依赖..." -ForegroundColor Blue

    function Get-CargoBinPath {
        if ($env:CARGO_HOME) {
            return (Join-Path $env:CARGO_HOME "bin")
        }
        return (Join-Path $env:USERPROFILE ".cargo\bin")
    }

    function Refresh-ProcessPath {
        $cargoBin = Get-CargoBinPath
        $pathValues = @(
            [Environment]::GetEnvironmentVariable("Path", "Process"),
            [Environment]::GetEnvironmentVariable("Path", "Machine"),
            [Environment]::GetEnvironmentVariable("Path", "User"),
            $cargoBin
        )

        $seen = @{}
        $segments = @()
        foreach ($pathValue in $pathValues) {
            if ([string]::IsNullOrWhiteSpace($pathValue)) { continue }
            foreach ($part in ($pathValue -split ';')) {
                $trimmed = $part.Trim()
                if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }
                $key = $trimmed.TrimEnd('\').ToLowerInvariant()
                if (-not $seen.ContainsKey($key)) {
                    $seen[$key] = $true
                    $segments += $trimmed
                }
            }
        }

        $env:Path = ($segments -join ';')
    }

    function Test-Command {
        param([string]$Command, [string]$HelpUrl)
        Refresh-ProcessPath
        & cmd.exe /d /s /c "$Command >NUL 2>NUL"
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        Write-Host "  X - $Command 未安装" -ForegroundColor Red
        Write-Host "      请安装: $HelpUrl" -ForegroundColor Yellow
        return $false
    }

    Refresh-ProcessPath
    $depOk = $true
    if (-not (Test-Command "rustup --version" "https://rustup.rs")) { $depOk = $false }
    if (-not (Test-Command "npm --version" "https://nodejs.org")) { $depOk = $false }

    # Rust toolchain/components/target 必须与 rust-toolchain.toml 和 CI 对齐。
    if ($depOk) {
        try {
            & "$ProjectDir\scripts\ensure_rust_toolchain.ps1" -Targets @("x86_64-pc-windows-msvc")
        } catch {
            Write-Host "  Rust toolchain 准备失败: $_" -ForegroundColor Red
            $depOk = $false
        }
    }

    if ($depOk) {
        if (-not (Test-Command "rustc --version" "https://rustup.rs")) { $depOk = $false }
        if (-not (Test-Command "cargo --version" "https://rustup.rs")) { $depOk = $false }
    }

    if (-not $depOk) {
        throw "请先安装缺失的依赖"
    }

    # 每次构建都拉取最新 cuse release — 从 cuse 兼容 CDN 拉取（公网公开），
    # 不再依赖 gh CLI / 私有仓库访问权限。cuse 维护者负责在 GH Release 之后跑
    # cuse 发布流程同步产物到兼容 CDN（`download.myagents.io/cuse/...`）。
    # 直接在当前 shell 里运行 .ps1，不走 `pwsh -File` ——
    # 这样 Windows PowerShell 5.1（Windows 自带）和 PowerShell 7+ 都能工作，
    # 避免用户没装 pwsh 时 preflight 直接失败。
    Write-Host "  拉取最新 cuse 二进制..." -ForegroundColor Cyan
    try {
        & "$ProjectDir\scripts\download_cuse.ps1"
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) { throw "download_cuse.ps1 exit $LASTEXITCODE" }
        $cuseBinaryPath = "src-tauri\binaries\cuse-x86_64-pc-windows-msvc.exe"
        if (-not (Test-Path $cuseBinaryPath)) { throw "cuse binary not written" }
        Write-Host "  cuse OK" -ForegroundColor Green
    } catch {
        Write-Host "  cuse 下载失败: $_" -ForegroundColor Red
        Write-Host "    检查网络连通性: curl https://download.myagents.io/cuse/latest.json" -ForegroundColor Yellow
        $depOk = $false
    }

    $NodeDir = Join-Path $ProjectDir "src-tauri\resources\nodejs"
    $nodejsPath = Join-Path $NodeDir "node.exe"
    $NodeVersion = "24.14.0"
    $installedNodeVersion = $null
    if (Test-Path -LiteralPath $nodejsPath -PathType Leaf) {
        try {
            $nodeVersionOutput = @(& $nodejsPath --version 2>$null)
            if ($LASTEXITCODE -eq 0) {
                $installedNodeVersion = [string]($nodeVersionOutput | Select-Object -First 1)
            }
        }
        catch {
            $installedNodeVersion = $null
        }
    }

    Write-Host "  检查 bundled Node.js... " -NoNewline
    if ($installedNodeVersion -eq "v$NodeVersion") {
        Write-Host "OK (v$NodeVersion)" -ForegroundColor Green
        try {
            $null = Ensure-BundledNpm -ProjectDir $ProjectDir -NodeDir $NodeDir
        }
        catch {
            Write-Host "    bundled npm 准备失败: $_" -ForegroundColor Red
            $depOk = $false
        }
    } else {
        if (Test-Path -LiteralPath $nodejsPath -PathType Leaf) {
            $versionLabel = if ($installedNodeVersion) { $installedNodeVersion } else { "unusable" }
            Write-Host "MISMATCH ($versionLabel, expected v$NodeVersion) - downloading..." -ForegroundColor Yellow
        } else {
            Write-Host "MISSING - downloading..." -ForegroundColor Yellow
        }
        # Auto-download Node.js if setup_windows.ps1 was not run.
        try {
            $ZipName = "node-v$NodeVersion-win-x64.zip"
            $TempZip = Join-Path $env:TEMP "blexagent-node-windows-$PID.zip"
            $TempDir = Join-Path $env:TEMP "blexagent-node-windows-$PID"
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri "https://nodejs.org/dist/v$NodeVersion/$ZipName" -OutFile $TempZip -UseBasicParsing -TimeoutSec 300
            if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
            Expand-Archive -Path $TempZip -DestinationPath $TempDir -Force
            $ExtractedDir = Join-Path $TempDir "node-v$NodeVersion-win-x64"
            if (Test-Path $NodeDir) { Remove-Item -Recurse -Force $NodeDir }
            New-Item -ItemType Directory -Path $NodeDir -Force | Out-Null

            Copy-Item (Join-Path $ExtractedDir "node.exe") $NodeDir -Force
            Copy-Item (Join-Path $ExtractedDir "npm.cmd") $NodeDir -Force
            Copy-Item (Join-Path $ExtractedDir "npx.cmd") $NodeDir -Force
            Copy-Item (Join-Path $ExtractedDir "npm") $NodeDir -Force
            Copy-Item (Join-Path $ExtractedDir "npx") $NodeDir -Force

            # Copy-Item -Recurse can silently skip npm's deep paths on Windows.
            $SrcMod = Join-Path $ExtractedDir "node_modules"
            $DstMod = Join-Path $NodeDir "node_modules"
            if (Test-Path $SrcMod) {
                & robocopy $SrcMod $DstMod /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
                if ($LASTEXITCODE -ge 8) { throw "robocopy failed: exit $LASTEXITCODE" }
            }

            if (Test-Path $TempZip) { Remove-Item -Force $TempZip }
            if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }

            # The repository pin is authoritative; do not execute the Node
            # archive's bundled npm before replacing it.
            $null = Ensure-BundledNpm -ProjectDir $ProjectDir -NodeDir $NodeDir
            Write-Host "    OK - Node.js downloaded" -ForegroundColor Green
        } catch {
            Write-Host "    下载失败，请先运行 .\setup_windows.ps1: $_" -ForegroundColor Red
            $depOk = $false
        } finally {
            Remove-Item -LiteralPath $TempZip -Force -ErrorAction SilentlyContinue
            Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    $gitInstallerPath = "src-tauri\nsis\Git-Installer.exe"
    Write-Host "  检查 Git installer... " -NoNewline
    $gitVersion = "2.52.0"
    $gitInstallerUrl = "https://github.com/git-for-windows/git/releases/download/v$gitVersion.windows.1/Git-$gitVersion-64-bit.exe"
    $gitInstallerSha256 = "D8DE7A3152266C8BB13577EAB850EA1DF6DCCF8C2AA48BE5B4A1C58B7190D62C"
    try {
        if (-not (Test-Path $gitInstallerPath)) {
            Write-Host "MISSING - downloading..." -ForegroundColor Yellow
            $gitInstallerDir = Split-Path -Parent $gitInstallerPath
            New-Item -ItemType Directory -Path $gitInstallerDir -Force | Out-Null
            $gitInstallerDownload = "$gitInstallerPath.download"
            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                Invoke-WebRequest -Uri $gitInstallerUrl -OutFile $gitInstallerDownload -UseBasicParsing -TimeoutSec 300
                Move-Item -LiteralPath $gitInstallerDownload -Destination $gitInstallerPath -Force
            } finally {
                Remove-Item -LiteralPath $gitInstallerDownload -Force -ErrorAction SilentlyContinue
            }
        }

        $actualGitInstallerHash = (Get-FileHash -LiteralPath $gitInstallerPath -Algorithm SHA256).Hash
        if ($actualGitInstallerHash -ne $gitInstallerSha256) {
            throw "Git installer SHA-256 不匹配（expected $gitInstallerSha256, got $actualGitInstallerHash）"
        }
        $gitInstallerSignature = Get-AuthenticodeSignature -LiteralPath $gitInstallerPath
        if ($gitInstallerSignature.Status -ne 'Valid') {
            throw "Git installer Authenticode 签名无效: $($gitInstallerSignature.Status)"
        }
        Write-Host "OK (v$gitVersion, hash + signature verified)" -ForegroundColor Green
    } catch {
        Write-Host "FAILED" -ForegroundColor Red
        Write-Host "    Git installer 准备或校验失败: $_" -ForegroundColor Yellow
        $depOk = $false
    }

    # VC++ Runtime DLL (app-local deployment for bundled Node.js + native modules)
    $resDir = "src-tauri\resources"
    $vcDlls = @("vcruntime140.dll", "vcruntime140_1.dll")
    Write-Host "  检查 VC++ Runtime DLL... " -NoNewline
    $allPresent = $true
    foreach ($dll in $vcDlls) {
        if (-not (Test-Path (Join-Path $resDir $dll))) { $allPresent = $false; break }
    }
    if ($allPresent) {
        Write-Host "OK" -ForegroundColor Green
    } else {
        # Auto-extract from system if not present (dev machine always has MSVC)
        $systemDll = "$env:SystemRoot\System32\vcruntime140.dll"
        if (Test-Path $systemDll) {
            if (-not (Test-Path $resDir)) { New-Item -ItemType Directory -Path $resDir -Force | Out-Null }
            foreach ($dll in $vcDlls) {
                $src = "$env:SystemRoot\System32\$dll"
                if (Test-Path $src) {
                    Copy-Item $src (Join-Path $resDir $dll) -Force
                }
            }
            Write-Host "OK (auto-extracted)" -ForegroundColor Green
        } else {
            Write-Host "MISSING" -ForegroundColor Red
            Write-Host "    请先运行 .\setup_windows.ps1 提取 VC++ Runtime DLL" -ForegroundColor Yellow
            $depOk = $false
        }
    }

    if (-not $depOk) {
        throw "缺少构建必需文件，请运行 .\setup_windows.ps1"
    }

    Write-Host "  OK - 依赖检查通过" -ForegroundColor Green
    Write-Host ""

    # ========================================
    # 验证 CSP 配置（不再覆盖）
    # ========================================
    Write-Host "[3/7] 验证 CSP 配置..." -ForegroundColor Blue

    $conf = Get-Content $TauriConfPath -Raw | ConvertFrom-Json
    $currentCsp = $conf.app.security.csp

    # 验证关键 CSP 指令是否存在
    $requiredCspParts = @(
        "http://ipc.localhost",
        "asset:",
        "https://download.blexagent.com"
    )

    $missingParts = @()
    foreach ($part in $requiredCspParts) {
        if ($currentCsp -notlike "*$part*") {
            $missingParts += $part
        }
    }

    # 特殊验证: connect-src 指令必须包含 http://ipc.localhost (Windows Tauri IPC 关键)
    # connect-src 是管 fetch/XHR/WebSocket 的标准 CSP 指令；Windows Tauri IPC 走
    # Fetch API 打到 http://ipc.localhost，必须由 connect-src 放行。（旧版校验的
    # 是非标准指令 fetch-src——WebKit/WebView2 都忽略它、只在 console 报
    # "Unrecognized"，已从 CSP 移除；真正生效的一直是 connect-src。）
    if ($currentCsp -match "connect-src\s+([^;]+)") {
        $connectSrcDirective = $matches[1]
        if ($connectSrcDirective -notlike "*http://ipc.localhost*") {
            $missingParts += "connect-src 缺少 http://ipc.localhost (Windows 必需)"
        }
    } else {
        $missingParts += "connect-src 指令"
    }

    if ($missingParts.Count -gt 0) {
        Write-Host "  错误: CSP 配置不符合 Windows 要求:" -ForegroundColor Red
        $missingParts | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
        Write-Host ""
        Write-Host "  Windows Tauri IPC 需要 connect-src 包含 http://ipc.localhost" -ForegroundColor Yellow
        Write-Host "  请检查 tauri.conf.json 中的 CSP 配置" -ForegroundColor Yellow
        Write-Host ""
        throw "CSP 配置不完整，无法在 Windows 上正常运行"
    } else {
        Write-Host "  OK - CSP 配置完整 (包含 Windows IPC 支持)" -ForegroundColor Green
    }
    Write-Host ""

    # ========================================
    # 初始化并验证 MSVC 编译环境 (link.exe / cl.exe)
    # ========================================
    Write-Host "[准备] 初始化 MSVC x64 编译环境..." -ForegroundColor Blue
    $msvc = Import-MSVCEnvironment -Architecture x64
    Write-Host "  cl.exe:   $($msvc.ClPath)" -ForegroundColor Gray
    Write-Host "  link.exe: $($msvc.LinkPath)" -ForegroundColor Gray
    Write-Host "  OK - MSVC x64 环境已加载并验证" -ForegroundColor Green
    Write-Host ""
    # ========================================
    # 清理旧构建（包括缓存的 resources）
    # ========================================
    Write-Host "[准备] 清理旧构建..." -ForegroundColor Blue

    # 杀死残留进程（避免文件锁定）
    $appProcesses = Get-Process | Where-Object { $_.ProcessName -eq "BlexAgent" }

    if ($appProcesses) {
        $appProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "  清理了 $($appProcesses.Count) 个 BlexAgent 进程" -ForegroundColor Gray
    }

    # 验证进程清理完成（最多等待 2 秒）
    $maxWait = 20  # 20 * 100ms = 2s
    $waited = 0
    while ($waited -lt $maxWait) {
        $remainingApp = Get-Process -Name "BlexAgent" -ErrorAction SilentlyContinue
        if (-not $remainingApp) {
            break
        }
        Start-Sleep -Milliseconds 100
        $waited++
    }

    if ($waited -gt 0) {
        Write-Host "  进程清理验证完成 (耗时 $($waited * 100)ms)" -ForegroundColor Gray
    }

    # 清理构建输出目录
    $dirsToClean = @(
        @{ Path = "dist"; Name = "前端构建输出" },
        @{ Path = "src-tauri\target\x86_64-pc-windows-msvc\release\bundle"; Name = "打包输出" },
        @{ Path = "src-tauri\target\x86_64-pc-windows-msvc\release\resources"; Name = "resources 缓存 (CRITICAL)" }
    )

    foreach ($dir in $dirsToClean) {
        if (Test-Path $dir.Path) {
            try {
                Remove-Item -Recurse -Force $dir.Path -ErrorAction Stop
                Write-Host "  已清理: $($dir.Name)" -ForegroundColor Gray
            } catch {
                Write-Host "  警告: 清理 $($dir.Name) 失败: $_" -ForegroundColor Yellow
                Write-Host "  路径: $($dir.Path)" -ForegroundColor Yellow
                # 不抛出异常，继续构建
            }
        }
    }

    Write-Host "  OK - 清理完成（含 resources 缓存）" -ForegroundColor Green
    Write-Host ""

    # ========================================
    # TypeScript 类型检查
    # ========================================
    if (-not $SkipTypeCheck) {
        Write-Host "[4/7] TypeScript 类型检查..." -ForegroundColor Blue
        & npm run typecheck
        if ($LASTEXITCODE -ne 0) {
            throw "TypeScript 检查失败，请修复后重试"
        }
        Write-Host "  OK - TypeScript 检查通过" -ForegroundColor Green
        Write-Host ""
    }
    else {
        Write-Host "[4/7] 跳过 TypeScript 类型检查" -ForegroundColor Yellow
        Write-Host ""
    }

    # ========================================
    # 构建前端和服务端
    # ========================================
    Write-Host "[5/7] 构建前端和服务端..." -ForegroundColor Blue

    & node (Join-Path $ProjectDir "scripts/validate-bundled-resources.mjs")
    if ($LASTEXITCODE -ne 0) {
        throw "内置 Blex 工作区资源（mino/）不完整，请先运行 .\setup_windows.ps1"
    }

    # Sidecar / Bridge / CLI 三件套统一通过 npm scripts，由
    # `scripts/esbuild-bundle.mjs` 单一入口驱动。Driver 自带 post-build：
    #   - cli: 复制 blexagent.cmd 到 resources/cli/
    #   - server: 校验产物不含硬编码 __dirname 路径
    # 实际上 tauri:build 的 beforeBuildCommand (tauri.conf.json) 也会
    # 跑同一组 npm 脚本——这里显式提前一步是为了 build 阶段提早暴露
    # 错误（避免等到 cargo 链接成功才发现 server-dist.js 有问题）。
    Write-Host "  打包 Sidecar / Bridge / CLI..." -ForegroundColor Cyan
    & npm run build:server
    if ($LASTEXITCODE -ne 0) { throw "服务端打包失败" }
    & npm run build:bridge
    if ($LASTEXITCODE -ne 0) { throw "Plugin Bridge 打包失败" }
    & npm run build:cli
    if ($LASTEXITCODE -ne 0) { throw "blexagent CLI 打包失败" }
    Write-Host "    OK - Sidecar / Bridge / CLI 打包完成" -ForegroundColor Green

    # 填充 tsx-runtime（Plugin Bridge 走绝对路径 --import）—— Windows 当前
    # 仅 x64 构建；将来加 arm64 时把 --cpu 参数化。
    Write-Host "  填充 tsx-runtime (win32-x64)..." -ForegroundColor Cyan
    & npm run build:tsx-runtime -- win32 x64
    if ($LASTEXITCODE -ne 0) { throw "tsx-runtime 填充失败" }
    Write-Host "    OK - tsx-runtime 就绪" -ForegroundColor Green

    # 拷贝 Claude Agent SDK native binary（0.2.113+ 取代 cli.js 分发模式）
    # Windows 默认构建 x64；arm64 需另行处理（本脚本目前仅 x64）
    Write-Host "  拷贝 Claude native binary (win32-x64)..." -ForegroundColor Cyan
    $sdkTriple = "win32-x64"
    & "$ProjectDir\scripts\ensure_claude_sdk_package.ps1" -Arch x64
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) { throw "Claude SDK win32-x64 校验失败" }
    $claudeSrc = Join-Path $ProjectDir "node_modules\@anthropic-ai\claude-agent-sdk-${sdkTriple}\claude.exe"
    $sdkDest = Join-Path $ProjectDir "src-tauri\resources\claude-agent-sdk"

    if (-not (Test-Path $claudeSrc)) {
        throw "Claude native binary 不存在: $claudeSrc — 请运行 npm install 安装 @anthropic-ai/claude-agent-sdk-$sdkTriple"
    }

    if (Test-Path $sdkDest) {
        Remove-Item -Recurse -Force $sdkDest
    }
    New-Item -ItemType Directory -Path $sdkDest -Force | Out-Null
    Copy-Item $claudeSrc (Join-Path $sdkDest "claude.exe") -Force
    Write-Host "    OK - Claude native binary 就绪 ($sdkTriple)" -ForegroundColor Green

    # NOTE: agent-browser CLI is no longer bundled. The skill at
    # bundled-skills/agent-browser/SKILL.md teaches AI to self-install via
    # `npm install -g agent-browser@<pinned>` (with `npx` fallback) on first
    # use. Removing the bundle saves ~84MB installer size + build time.

    # 预装 sharp 图像处理（替代 jimp，libvips 原生）
    Write-Host "  预装 sharp 图像处理（libvips 原生）..." -ForegroundColor Cyan
    $sharpDir = Join-Path $ProjectDir "src-tauri\resources\sharp-runtime"
    if (Test-Path $sharpDir) {
        Remove-Item -Recurse -Force $sharpDir
    }
    New-Item -ItemType Directory -Path $sharpDir -Force | Out-Null
    $sharpPkgJson = @"
{
  "name": "sharp-runtime",
  "private": true,
  "version": "1.0.0",
  "dependencies": { "sharp": "0.34.5" }
}
"@
    Set-Content -Path (Join-Path $sharpDir "package.json") -Value $sharpPkgJson -Encoding utf8
    Push-Location $sharpDir
    & npm install --no-audit --no-fund --no-save --ignore-scripts
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        throw "sharp 主包预装失败"
    }
    # Windows 只装 x64 变体（arm64 Windows 用户少且 sharp 0.34 也支持，可按需扩展）
    $sharpWinArch = if ($Target -match "aarch64") { "arm64" } else { "x64" }
    Push-Location $sharpDir
    & npm install --no-save --force --no-audit --no-fund --ignore-scripts `
        "@img/sharp-win32-$sharpWinArch@0.34.5"
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        throw "sharp Windows 平台包安装失败"
    }
    $sharpNode = Join-Path $sharpDir "node_modules\@img\sharp-win32-$sharpWinArch\lib\sharp-win32-$sharpWinArch.node"
    if (-not (Test-Path $sharpNode)) {
        throw "sharp-win32-$sharpWinArch.node 缺失"
    }
    # 删除非 win32 变体（节省 NSIS 安装包大小）
    $imgDir = Join-Path $sharpDir "node_modules\@img"
    Get-ChildItem -Path $imgDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "sharp-darwin*" -or $_.Name -like "sharp-linux*" -or $_.Name -like "sharp-libvips-darwin*" -or $_.Name -like "sharp-libvips-linux*" -or $_.Name -eq "sharp-wasm32" } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "    OK - sharp 预装完成 (win32-$sharpWinArch)" -ForegroundColor Green

    # 构建前端 (增加内存限制避免 OOM)
    Write-Host "  构建前端..." -ForegroundColor Cyan
    $env:NODE_OPTIONS = "--max-old-space-size=4096"
    & npm run build:web
    if ($LASTEXITCODE -ne 0) {
        throw "前端构建失败"
    }

    Write-Host "  OK - 前端和服务端构建完成" -ForegroundColor Green
    Write-Host ""

    # ========================================
    # 构建 Tauri 应用
    # ========================================
    Write-Host "[6/7] 构建 Tauri 应用 (Release)..." -ForegroundColor Blue
    Write-Host "  这可能需要几分钟，请耐心等待..." -ForegroundColor Yellow

    $tauriArgs = @(
        "run", "tauri:build", "--",
        "--target", "x86_64-pc-windows-msvc",
        "--config", "src-tauri/tauri.windows.conf.json"
    )
    if ($UnsignedBuildConfig) {
        $tauriArgs += @("--config", $UnsignedBuildConfig)
    }
    & npm @tauriArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Tauri 构建失败"
    }

    Write-Host "  OK - Tauri 构建完成" -ForegroundColor Green
    Write-Host ""

    # ========================================
    # 创建便携版 ZIP
    # ========================================
    if (-not $SkipPortable) {
        Write-Host "[6.5/7] 创建便携版 ZIP..." -ForegroundColor Blue

        $targetDir = "src-tauri\target\x86_64-pc-windows-msvc\release"
        $nsisDir = "$targetDir\bundle\nsis"
        # Cargo package name is `blexagent` (lowercase), so Tauri's main binary is
        # blexagent.exe — NOT BlexAgent.exe (that's only the productName / shortcut).
        # The old BlexAgent.exe path worked by luck on case-insensitive NTFS; use the
        # real name so this stays correct on case-sensitive filesystems too.
        $exePath = "$targetDir\blexagent.exe"

        if (Test-Path $exePath) {
            $portableDir = Join-Path $targetDir "portable"
            $zipName = "BlexAgent_${Version}_x86_64-portable.zip"
            $zipPath = Join-Path $nsisDir $zipName

            if (Test-Path $portableDir) {
                Remove-Item -Recurse -Force $portableDir
            }
            New-Item -ItemType Directory -Path $portableDir -Force | Out-Null

            Copy-Item $exePath $portableDir -Force

            # Copy VC++ Runtime DLLs for portable version (app-local deployment)
            foreach ($dll in @("vcruntime140.dll", "vcruntime140_1.dll")) {
                $dllSrc = Join-Path "src-tauri\resources" $dll
                if (Test-Path $dllSrc) {
                    Copy-Item $dllSrc $portableDir -Force
                }
            }

            # Tauri v2 stages resources directly under the target release directory,
            # not under a synthetic `resources/` folder. Derive the portable payload
            # from tauri.conf.json so future resources cannot silently disappear from
            # the ZIP while still being present in the NSIS installer.
            $portableResources = @(
                $TauriConf.bundle.resources.PSObject.Properties | ForEach-Object {
                    ([string]$_.Value -split '[/\\]')[0]
                }
                $TauriConf.bundle.externalBin | ForEach-Object {
                    ([IO.Path]::GetFileName([string]$_)) + ".exe"
                }
            ) | Sort-Object -Unique
            foreach ($resourceName in $portableResources) {
                $resourceSource = Join-Path $targetDir $resourceName
                if (-not (Test-Path -LiteralPath $resourceSource)) {
                    throw "便携版缺少 Tauri 资源: $resourceName"
                }
                Copy-Item -LiteralPath $resourceSource -Destination $portableDir -Recurse -Force
            }

            if (Test-Path $zipPath) {
                Remove-Item -Force $zipPath
            }
            Compress-Archive -Path "$portableDir\*" -DestinationPath $zipPath -Force

            Remove-Item -Recurse -Force $portableDir

            Write-Host "  OK - 便携版 ZIP: $zipName" -ForegroundColor Green
        }
        else {
            Write-Host "  警告: 未找到 blexagent.exe，跳过便携版创建" -ForegroundColor Yellow
        }
        Write-Host ""
    }

    # ========================================
    # 恢复配置
    # ========================================
    Write-Host "[7/7] 恢复开发配置..." -ForegroundColor Blue

    if (Test-Path "$TauriConfPath.bak") {
        Move-Item "$TauriConfPath.bak" $TauriConfPath -Force
        Write-Host "  OK - 配置已恢复" -ForegroundColor Green
    }
    Write-Host ""

    # ========================================
    # 显示构建产物
    # ========================================
    $bundleDir = "src-tauri\target\x86_64-pc-windows-msvc\release\bundle"
    $nsisDir = Join-Path $bundleDir "nsis"

    if (-not $RequireSigning) {
        foreach ($artifact in @(Get-ChildItem -Path $nsisDir -File -ErrorAction SilentlyContinue | Where-Object {
            ($_.Extension -eq '.exe' -or $_.Name -like '*portable*.zip') -and $_.Name -notlike 'INTERNAL-UNSIGNED-*'
        })) {
            Rename-Item -LiteralPath $artifact.FullName -NewName ("INTERNAL-UNSIGNED-" + $artifact.Name)
        }
    }

    Write-Host "=========================================" -ForegroundColor Green
    Write-Host "  构建成功!" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  版本: $Version" -ForegroundColor Cyan
    if (-not $RequireSigning) {
        Write-Host "  状态: INTERNAL ONLY / 未验证 Authenticode，不得公开发布" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  构建产物:" -ForegroundColor Blue

    $nsisFiles = Get-ChildItem -Path $nsisDir -Filter "*.exe" -ErrorAction SilentlyContinue
    if (-not $nsisFiles) {
        throw "未生成 Windows NSIS 安装包"
    }
    foreach ($file in $nsisFiles) {
        $size = "{0:N2} MB" -f ($file.Length / 1MB)
        Write-Host "    NSIS: $($file.Name) ($size)" -ForegroundColor Cyan
        if ($RequireSigning) {
            $signature = Get-AuthenticodeSignature -FilePath $file.FullName
            if ($signature.Status -ne 'Valid') {
                throw "Windows 安装包签名验证失败: $($file.Name) ($($signature.Status))"
            }
            Write-Host "      签名: 有效 ($($signature.SignerCertificate.Subject))" -ForegroundColor Green
        }
    }

    $zipFiles = Get-ChildItem -Path $nsisDir -Filter "*portable*.zip" -ErrorAction SilentlyContinue
    foreach ($file in $zipFiles) {
        $size = "{0:N2} MB" -f ($file.Length / 1MB)
        Write-Host "    ZIP:  $($file.Name) ($size)" -ForegroundColor Cyan
    }

    $tarFiles = Get-ChildItem -Path $nsisDir -Filter "*.nsis.zip" -ErrorAction SilentlyContinue
    foreach ($file in $tarFiles) {
        $size = "{0:N2} MB" -f ($file.Length / 1MB)
        Write-Host "    更新包: $($file.Name) ($size)" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "  输出目录:" -ForegroundColor Blue
    Write-Host "    $nsisDir" -ForegroundColor Cyan
    Write-Host ""

    $sigFiles = Get-ChildItem -Path $nsisDir -Filter "*.sig" -ErrorAction SilentlyContinue
    if ($sigFiles) {
        Write-Host "  OK - 自动更新签名已生成" -ForegroundColor Green
    }
    else {
        Write-Host "  警告: 未生成自动更新签名 (TAURI_SIGNING_PRIVATE_KEY 未设置)" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "后续步骤:" -ForegroundColor Blue
    if ($RequireSigning) {
        Write-Host "  1. 在干净机器验证安装、发布者、时间戳和 SHA-256" -ForegroundColor White
        Write-Host "  2. 经审批后运行发布流程" -ForegroundColor White
    }
    else {
        Write-Host "  仅用于内部安装验证；不得上传正式下载/CDN/更新清单" -ForegroundColor Yellow
        Write-Host "  正式候选必须使用 .\build_windows.ps1 -RequireSigning" -ForegroundColor White
    }
    Write-Host ""

    $BuildSuccess = $true

} catch {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host "  构建失败!" -ForegroundColor Red
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "错误: $_" -ForegroundColor Red
    Write-Host ""
    if ($_.InvocationInfo.PositionMessage) {
        Write-Host "位置: $($_.InvocationInfo.PositionMessage)" -ForegroundColor Yellow
    }
    Write-Host ""

    # 尝试恢复配置
    $TauriConfPath = Join-Path $ProjectDir "src-tauri\tauri.conf.json"
    if (Test-Path "$TauriConfPath.bak") {
        Move-Item "$TauriConfPath.bak" $TauriConfPath -Force
        Write-Host "已恢复 tauri.conf.json" -ForegroundColor Yellow
    }
} finally {
    if ($UnsignedBuildConfig -and (Test-Path $UnsignedBuildConfig)) {
        Remove-Item -LiteralPath $UnsignedBuildConfig -Force -ErrorAction SilentlyContinue
    }
}

if (-not $NonInteractive) {
    Write-Host ""
    if ($BuildSuccess) {
        Write-Host "按回车键退出..." -ForegroundColor Cyan
    } else {
        Write-Host "按回车键退出..." -ForegroundColor Yellow
    }
    Read-Host
}
if (-not $BuildSuccess) {
    exit 1
}
