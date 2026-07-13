//! Offline AgentHub catalogue and transactional workspace installation.
//!
//! AgentHub packages are trusted, reviewed application resources.  This module
//! deliberately does not share the legacy template resolver because that
//! resolver falls back to user-writable directories.  Every operation here is
//! restricted to `resources/agenthub`, validates the package again, rejects
//! symlinks/executables/secrets, and performs blocking IO off the WebView thread.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Runtime, State};
use uuid::Uuid;

const EXPECTED_TEMPLATE_COUNT: usize = 12;
const MAX_TEMPLATE_FILES: usize = 500;
const MAX_TEMPLATE_FILE_BYTES: u64 = 1_048_576;
const MAX_TEMPLATE_TOTAL_BYTES: u64 = 10 * 1_048_576;
const PREVIEW_TTL: Duration = Duration::from_secs(15 * 60);
const MAX_PENDING_PREVIEWS: usize = 128;
const MAX_PENDING_CREATIONS: usize = 32;
const MAX_COMPLETED_RECEIPTS: usize = 128;
const MAX_INTERNAL_ERROR_CHARS: usize = 512;

// These digests bind the reviewed, adapted workspace payloads rather than only
// their upstream source files. Keep this list in sync with the build-time
// AgentHub validator whenever a reviewed template is intentionally updated.
//
// Digest algorithm: sort slash-normalized relative paths, then hash for each
// file: path UTF-8 bytes, NUL, lowercase SHA-256(file bytes), and a newline.
const REVIEWED_TEMPLATE_PAYLOADS: &[(&str, &str, &str)] = &[
    (
        "brand-copywriting",
        "1.0.0",
        "479502d605421a1d134037e42c95518d825d59620b83e3e18765bc45821f80d2",
    ),
    (
        "calendar-focus",
        "1.0.0",
        "51d526e0872b2915c84379d28d9aa54a9ebd02cfedc06580322d0132dfe17f25",
    ),
    (
        "content-strategist",
        "1.0.0",
        "618d524954af3f8faabf8721a4c0b3e244a6f1ba6d3fd174143511100db23bb0",
    ),
    (
        "daily-weekly-review",
        "1.0.0",
        "9a75e5513e3af3b33f7f2c0b63ba75eb59b2bfc80846207906ce14533b4ba86b",
    ),
    (
        "goals-habits-coach",
        "1.0.0",
        "ecea6e83f2ced3441a09ce6542945fadf270a6eccd86924a34e9973327f668b0",
    ),
    (
        "life-manager",
        "1.0.0",
        "b15c27f619ddd6c740c5e1714f6b875bc00fa21021bfa45bb74fb7af3969a9f8",
    ),
    (
        "meal-shopping",
        "1.0.0",
        "faf4745a474dae35013e94e6d4c780fd3ee064c53b1902da7d9fcb1fb1a9088c",
    ),
    (
        "personal-writing",
        "1.0.0",
        "cad6c32f8b1eb69f5d6420d4947201b41bc9f51984c6065bccd743c3c03f4bad",
    ),
    (
        "social-short-content",
        "1.0.0",
        "48b76899e1e3e2768b89f633f5e4db6730401c8bfd2734276b356e5d7c9fde76",
    ),
    (
        "travel-planner",
        "1.0.0",
        "ddcce4d52a1b98df32b687d4e5ded1d88cb4e026fd7ced6fa0bc9785dbb7d0d6",
    ),
    (
        "visual-ux-design",
        "1.0.0",
        "f7c37b7e2f16cccd4efa3e945d6317ea0b2757e0e75e49795c9ffa4fda66e33b",
    ),
    (
        "wellness-tracker",
        "1.0.0",
        "fe30a84af07465384fc905304a9293cdfaa058bbe796810237b7ae314a8fb7a6",
    ),
];

#[derive(Clone, Default)]
pub struct AgentHubState {
    previews: Arc<Mutex<HashMap<String, PendingPreview>>>,
    creations: Arc<Mutex<HashMap<String, PendingCreation>>>,
    completed: Arc<Mutex<VecDeque<CompletedReceipt>>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ReceiptOutcome {
    Finalized,
    RolledBack,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CompletedReceipt {
    receipt_id: String,
    outcome: ReceiptOutcome,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalizedText {
    #[serde(rename = "zh-CN")]
    pub zh_cn: String,
    #[serde(rename = "en-US")]
    pub en_us: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHubSkillSummary {
    pub id: String,
    pub name: LocalizedText,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHubRiskSummary {
    pub level: String,
    pub boundary: LocalizedText,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHubSourceAttribution {
    pub repository: String,
    pub repository_url: String,
    pub commit: String,
    pub paths: Vec<String>,
    pub license_spdx: String,
    pub license_file: String,
    pub copyright_notice: String,
    pub upstream_author: String,
    pub retrieved_at: String,
    pub included_files: Vec<String>,
    pub excluded_files: Vec<String>,
    pub modifications: String,
    pub source_sha256: String,
    pub license_review_status: String,
    pub security_review_status: String,
    pub security_review_notes: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHubTemplateManifest {
    pub id: String,
    pub version: String,
    pub category: String,
    pub icon: String,
    pub name: LocalizedText,
    pub description: LocalizedText,
    pub capabilities: Vec<LocalizedText>,
    pub examples: Vec<LocalizedText>,
    pub skills: Vec<AgentHubSkillSummary>,
    pub risk: AgentHubRiskSummary,
    pub sources: Vec<AgentHubSourceAttribution>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogueFile {
    schema_version: u32,
    template_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHubCatalogueResponse {
    pub schema_version: u32,
    pub templates: Vec<AgentHubTemplateManifest>,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHubWorkspaceReceipt {
    pub path: String,
    pub is_new: bool,
    pub receipt_id: String,
    pub template_id: String,
    pub template_version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHubApplyPreview {
    pub preview_id: String,
    pub template_id: String,
    pub template_version: String,
    pub add: Vec<String>,
    pub overwrite: Vec<String>,
    pub conflicts: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHubApplyResult {
    pub add: Vec<String>,
    pub overwrite: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum TargetFingerprint {
    Missing,
    File { len: u64, sha256: String },
    Directory,
    Symlink,
    Other,
}

#[derive(Debug, Clone)]
struct PendingPreview {
    template_id: String,
    template_version: String,
    workspace: PathBuf,
    files: Vec<PathBuf>,
    fingerprints: HashMap<PathBuf, TargetFingerprint>,
    add: Vec<String>,
    overwrite: Vec<String>,
    conflicts: Vec<String>,
    created_at: Instant,
}

#[derive(Debug, Clone)]
struct PendingCreation {
    workspace: PathBuf,
    files: Vec<PathBuf>,
    fingerprints: HashMap<PathBuf, TargetFingerprint>,
    rollback_only: bool,
}

#[derive(Debug)]
struct PackageInventory {
    files: Vec<PathBuf>,
}

fn metadata_is_link(metadata: &fs::Metadata) -> bool {
    // On Windows, std classifies name-surrogate reparse points (including
    // junctions) as symlinks while leaving non-redirecting Cloud Files reparse
    // points usable. The junction regression test below locks this behavior.
    metadata.file_type().is_symlink()
}

fn resource_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .resource_dir()
        .map(|dir| dir.join("agenthub"))
        .map_err(|e| format!("Failed to get AgentHub resource directory: {e}"))
}

fn validate_template_id(id: &str) -> Result<(), String> {
    let valid = !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        && !id.starts_with('-')
        && !id.ends_with('-')
        && !id.contains("--");
    if valid {
        Ok(())
    } else {
        Err("Invalid AgentHub template ID".to_string())
    }
}

fn read_catalogue(root: &Path) -> Result<CatalogueFile, String> {
    let catalogue_path = root.join("catalogue.json");
    let metadata = fs::symlink_metadata(&catalogue_path)
        .map_err(|e| format!("Failed to inspect AgentHub catalogue: {e}"))?;
    let canonical_root = root
        .canonicalize()
        .map_err(|e| format!("Failed to resolve AgentHub resource root: {e}"))?;
    let canonical_catalogue = catalogue_path
        .canonicalize()
        .map_err(|e| format!("Failed to resolve AgentHub catalogue: {e}"))?;
    if metadata_is_link(&metadata)
        || !metadata.is_file()
        || metadata.len() > MAX_TEMPLATE_FILE_BYTES
        || canonical_catalogue.parent() != Some(canonical_root.as_path())
    {
        return Err("AgentHub catalogue is not a direct bundled file".to_string());
    }
    let raw = fs::read_to_string(&canonical_catalogue)
        .map_err(|e| format!("Failed to read AgentHub catalogue: {e}"))?;
    let catalogue: CatalogueFile =
        serde_json::from_str(&raw).map_err(|e| format!("Invalid AgentHub catalogue: {e}"))?;
    if catalogue.schema_version != 1 {
        return Err(format!(
            "Unsupported AgentHub catalogue schema {}",
            catalogue.schema_version
        ));
    }
    if catalogue.template_ids.len() != EXPECTED_TEMPLATE_COUNT {
        return Err(format!(
            "AgentHub catalogue must contain exactly {EXPECTED_TEMPLATE_COUNT} templates"
        ));
    }
    let mut ids = HashSet::new();
    for id in &catalogue.template_ids {
        validate_template_id(id)?;
        if !ids.insert(id.clone()) {
            return Err(format!("Duplicate AgentHub template ID: {id}"));
        }
    }
    Ok(catalogue)
}

fn read_manifest(package_dir: &Path) -> Result<AgentHubTemplateManifest, String> {
    let manifest_path = package_dir.join("manifest.json");
    let metadata = fs::symlink_metadata(&manifest_path)
        .map_err(|e| format!("Failed to inspect manifest: {e}"))?;
    let canonical_manifest = manifest_path
        .canonicalize()
        .map_err(|e| format!("Failed to resolve manifest: {e}"))?;
    if metadata_is_link(&metadata)
        || !metadata.is_file()
        || metadata.len() > MAX_TEMPLATE_FILE_BYTES
        || canonical_manifest.parent() != Some(package_dir)
    {
        return Err("Manifest is not a direct bundled file".to_string());
    }
    let raw = fs::read_to_string(canonical_manifest)
        .map_err(|e| format!("Failed to read manifest: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid manifest: {e}"))
}

fn validate_manifest(
    root: &Path,
    expected_id: &str,
    manifest: &AgentHubTemplateManifest,
) -> Result<(), String> {
    fn valid_localized(value: &LocalizedText, max_chars: usize) -> bool {
        [&value.zh_cn, &value.en_us].iter().all(|text| {
            !text.trim().is_empty()
                && text.chars().count() <= max_chars
                && !text.chars().any(|ch| ch == '\0')
        })
    }

    fn valid_semver(value: &str) -> bool {
        let parts: Vec<_> = value.split('.').collect();
        parts.len() == 3
            && parts
                .iter()
                .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
    }

    fn valid_github_url(value: &str) -> bool {
        value
            .strip_prefix("https://github.com/")
            .is_some_and(|suffix| {
                !suffix.is_empty()
                    && suffix
                        .bytes()
                        .all(|byte| byte.is_ascii_alphanumeric() || b"/-_.".contains(&byte))
            })
    }

    if manifest.id != expected_id {
        return Err(format!(
            "Manifest ID '{}' does not match catalogue ID '{expected_id}'",
            manifest.id
        ));
    }
    if !matches!(manifest.category.as_str(), "life" | "creation") {
        return Err(format!("Invalid category for template {expected_id}"));
    }
    if !valid_semver(&manifest.version)
        || manifest.icon.trim().is_empty()
        || manifest.icon.chars().count() > 8
        || !valid_localized(&manifest.name, 80)
        || !valid_localized(&manifest.description, 500)
        || manifest.capabilities.len() < 3
        || manifest.capabilities.len() > 20
        || manifest
            .capabilities
            .iter()
            .any(|value| !valid_localized(value, 500))
        || manifest.examples.len() < 3
        || manifest.examples.len() > 20
        || manifest
            .examples
            .iter()
            .any(|value| !valid_localized(value, 1_000))
        || manifest.skills.is_empty()
        || manifest.skills.len() > 10
        || manifest.sources.is_empty()
        || manifest.sources.len() > 10
        || !matches!(manifest.risk.level.as_str(), "low" | "medium")
        || !valid_localized(&manifest.risk.boundary, 1_000)
    {
        return Err(format!("Manifest is incomplete for template {expected_id}"));
    }
    let mut skill_ids = HashSet::new();
    for skill in &manifest.skills {
        validate_template_id(&skill.id)?;
        if !skill_ids.insert(skill.id.as_str())
            || skill.name.zh_cn.trim().is_empty()
            || skill.name.en_us.trim().is_empty()
        {
            return Err(format!("Invalid Skill metadata for template {expected_id}"));
        }
    }
    for source in &manifest.sources {
        if source.commit.len() != 40
            || !source.commit.bytes().all(|b| b.is_ascii_hexdigit())
            || source.license_spdx != "MIT"
            || source.license_review_status != "approved"
            || source.security_review_status != "approved"
            || source.paths.is_empty()
            || source.source_sha256.len() != 64
            || !source.source_sha256.bytes().all(|b| b.is_ascii_hexdigit())
            || source.repository.trim().is_empty()
            || !valid_github_url(&source.repository_url)
            || source.copyright_notice.trim().is_empty()
            || source.upstream_author.trim().is_empty()
            || source.retrieved_at.trim().is_empty()
            || source.included_files.is_empty()
            || source.modifications.trim().is_empty()
            || source.security_review_notes.trim().is_empty()
        {
            return Err(format!(
                "Source review is incomplete for template {expected_id}"
            ));
        }
        let relative_license = Path::new(&source.license_file);
        let mut components = relative_license.components();
        if components.next() != Some(Component::Normal("licenses".as_ref()))
            || !components.all(|component| matches!(component, Component::Normal(_)))
        {
            return Err(format!("Invalid license path for template {expected_id}"));
        }
        let licenses_dir = root.join("licenses");
        let licenses_metadata = fs::symlink_metadata(&licenses_dir)
            .map_err(|_| "AgentHub license directory is unavailable".to_string())?;
        if metadata_is_link(&licenses_metadata) || !licenses_metadata.is_dir() {
            return Err("AgentHub license directory is invalid".to_string());
        }
        let license = root.join(relative_license);
        let metadata = fs::symlink_metadata(&license)
            .map_err(|_| format!("License file is missing for template {expected_id}"))?;
        let canonical_licenses = licenses_dir
            .canonicalize()
            .map_err(|_| "AgentHub license directory is unavailable".to_string())?;
        if !canonical_licenses.starts_with(root) {
            return Err("AgentHub license directory escaped the resource root".to_string());
        }
        let canonical_license = license
            .canonicalize()
            .map_err(|_| format!("License file is missing for template {expected_id}"))?;
        if metadata_is_link(&metadata)
            || !metadata.is_file()
            || metadata.len() > MAX_TEMPLATE_FILE_BYTES
            || !canonical_license.starts_with(&canonical_licenses)
        {
            return Err(format!("Invalid license file for template {expected_id}"));
        }
    }
    Ok(())
}

fn ensure_catalogue_member(root: &Path, id: &str) -> Result<CatalogueFile, String> {
    validate_template_id(id)?;
    let catalogue = read_catalogue(root)?;
    if !catalogue
        .template_ids
        .iter()
        .any(|candidate| candidate == id)
    {
        return Err("Unknown AgentHub template ID".to_string());
    }
    Ok(catalogue)
}

fn resolve_package(root: &Path, id: &str) -> Result<(PathBuf, AgentHubTemplateManifest), String> {
    ensure_catalogue_member(root, id)?;
    let canonical_root = root
        .canonicalize()
        .map_err(|e| format!("Failed to resolve AgentHub resource root: {e}"))?;
    let package = root.join("templates").join(id);
    let package_metadata = fs::symlink_metadata(&package)
        .map_err(|e| format!("AgentHub template '{id}' is unavailable: {e}"))?;
    if metadata_is_link(&package_metadata) || !package_metadata.is_dir() {
        return Err("AgentHub package is not a direct bundled directory".to_string());
    }
    let canonical_package = package
        .canonicalize()
        .map_err(|e| format!("AgentHub template '{id}' is unavailable: {e}"))?;
    if !canonical_package.starts_with(canonical_root.join("templates")) {
        return Err("AgentHub package escaped the bundled resource root".to_string());
    }
    let manifest = read_manifest(&canonical_package)?;
    validate_manifest(&canonical_root, id, &manifest)?;
    Ok((canonical_package, manifest))
}

fn forbidden_file_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower == ".env"
        || lower.starts_with(".env.")
        || lower == ".npmrc"
        || lower == ".netrc"
        || lower == ".pypirc"
        || lower.contains("secret")
        || lower.contains("credential")
        || lower.contains("password")
        || lower.contains("api-key")
        || lower.contains("api_key")
        || matches!(
            lower.as_str(),
            "credentials.json"
                | "secrets.json"
                | "settings.json"
                | "settings.local.json"
                | ".mcp.json"
                | "mcp.json"
                | "hooks.json"
                | "package.json"
                | "package-lock.json"
                | "id_rsa"
                | "id_ed25519"
        )
}

fn allowed_extension(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("md" | "json" | "yaml" | "yml" | "txt")
    )
}

fn portable_inventory_name(name: &OsStr) -> Result<&str, String> {
    let name_text = name
        .to_str()
        .ok_or("Template contains a file name that is not valid UTF-8")?;
    if name_text.contains('\\') {
        return Err(format!(
            "Template contains a non-portable backslash in a file name: {name_text}"
        ));
    }
    Ok(name_text)
}

fn inventory_workspace(workspace: &Path) -> Result<PackageInventory, String> {
    for required in [
        "CLAUDE.md",
        "INTRODUCTION.md",
        ".claude/rules/SOUL.md",
        ".claude/rules/USER.md",
    ] {
        if !workspace.join(required).is_file() {
            return Err(format!("Template workspace is missing {required}"));
        }
    }

    fn walk(
        root: &Path,
        dir: &Path,
        files: &mut Vec<PathBuf>,
        total: &mut u64,
    ) -> Result<(), String> {
        for entry in fs::read_dir(dir).map_err(|e| format!("Failed to scan template: {e}"))? {
            let entry = entry.map_err(|e| format!("Failed to scan template: {e}"))?;
            let name = entry.file_name();
            let name_text = portable_inventory_name(&name)?;
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path)
                .map_err(|e| format!("Failed to inspect template entry: {e}"))?;
            if metadata_is_link(&metadata) {
                return Err(format!("Template contains a symlink: {name_text}"));
            }
            let lower_name = name_text.to_ascii_lowercase();
            if matches!(
                lower_name.as_str(),
                ".git"
                    | ".github"
                    | ".vscode"
                    | ".codex"
                    | "node_modules"
                    | "scripts"
                    | "hooks"
                    | "bin"
                    | "dist"
                    | "target"
                    | "vendor"
                    | "venv"
                    | ".venv"
            ) {
                return Err(format!(
                    "Template contains a forbidden directory: {name_text}"
                ));
            }
            if metadata.is_dir() {
                walk(root, &path, files, total)?;
                continue;
            }
            if !metadata.is_file() || forbidden_file_name(name_text) || !allowed_extension(&path) {
                return Err(format!(
                    "Template contains a forbidden file: {}",
                    path.strip_prefix(root).unwrap_or(&path).display()
                ));
            }
            if metadata.len() > MAX_TEMPLATE_FILE_BYTES {
                return Err(format!("Template file is too large: {name_text}"));
            }
            *total = total.saturating_add(metadata.len());
            if *total > MAX_TEMPLATE_TOTAL_BYTES {
                return Err("Template package exceeds the total size limit".to_string());
            }
            let bytes = fs::read(&path)
                .map_err(|e| format!("Failed to inspect template file contents: {e}"))?;
            let text = std::str::from_utf8(&bytes)
                .map_err(|_| "Template contains a non-text file".to_string())?;
            if text.contains('\0') {
                return Err("Template contains a binary text file".to_string());
            }
            let upper = text.to_ascii_uppercase();
            if upper.contains("-----BEGIN PRIVATE KEY-----")
                || upper.contains("-----BEGIN RSA PRIVATE KEY-----")
                || upper.contains("-----BEGIN OPENSSH PRIVATE KEY-----")
                || upper.contains("-----BEGIN EC PRIVATE KEY-----")
            {
                return Err(format!(
                    "Template contains private key material: {}",
                    path.strip_prefix(root).unwrap_or(&path).display()
                ));
            }
            files.push(
                path.strip_prefix(root)
                    .map_err(|_| "Template path escaped its workspace".to_string())?
                    .to_path_buf(),
            );
            if files.len() > MAX_TEMPLATE_FILES {
                return Err("Template package contains too many files".to_string());
            }
        }
        Ok(())
    }

    let mut files = Vec::new();
    let mut total = 0;
    walk(workspace, workspace, &mut files, &mut total)?;
    files.sort();

    let skills_root = workspace.join(".claude").join("skills");
    if !skills_root.is_dir() {
        return Err("Template workspace has no Skills directory".to_string());
    }
    for entry in fs::read_dir(&skills_root).map_err(|e| format!("Failed to scan Skills: {e}"))? {
        let entry = entry.map_err(|e| format!("Failed to scan Skills: {e}"))?;
        let metadata = fs::symlink_metadata(entry.path())
            .map_err(|e| format!("Failed to inspect Skill: {e}"))?;
        let skill_id = entry.file_name().to_string_lossy().to_string();
        if metadata_is_link(&metadata)
            || !metadata.is_dir()
            || validate_template_id(&skill_id).is_err()
            || !entry.path().join("SKILL.md").is_file()
        {
            return Err(format!("Skill '{skill_id}' is not a valid Skill package"));
        }
    }
    Ok(PackageInventory { files })
}

fn workspace_payload_sha256(
    workspace: &Path,
    inventory: &PackageInventory,
) -> Result<String, String> {
    let mut files = inventory
        .files
        .iter()
        .map(|relative| {
            relative
                .to_str()
                .ok_or("Template workspace path is not valid UTF-8")
                .map(|utf8| (relative, utf8.replace('\\', "/")))
        })
        .collect::<Result<Vec<_>, _>>()?;
    files.sort_by(|(_, left), (_, right)| left.cmp(right));

    let mut payload_hasher = Sha256::new();
    for (relative, relative_utf8) in files {
        let bytes = fs::read(workspace.join(relative))
            .map_err(|e| format!("Failed to hash reviewed template payload: {e}"))?;
        let file_sha256 = format!("{:x}", Sha256::digest(bytes));
        payload_hasher.update(relative_utf8.as_bytes());
        payload_hasher.update([0]);
        payload_hasher.update(file_sha256.as_bytes());
        payload_hasher.update(b"\n");
    }
    Ok(format!("{:x}", payload_hasher.finalize()))
}

fn validate_reviewed_payload(
    workspace: &Path,
    inventory: &PackageInventory,
    template_id: &str,
    template_version: &str,
) -> Result<(), String> {
    let expected = REVIEWED_TEMPLATE_PAYLOADS
        .iter()
        .find(|(id, version, _)| *id == template_id && *version == template_version)
        .map(|(_, _, sha256)| *sha256)
        .ok_or_else(|| {
            format!("Template {template_id}@{template_version} has no approved payload review")
        })?;
    let actual = workspace_payload_sha256(workspace, inventory)?;
    if actual != expected {
        return Err(format!(
            "Template {template_id}@{template_version} does not match its reviewed payload"
        ));
    }
    Ok(())
}

fn validated_workspace_source(
    root: &Path,
    id: &str,
) -> Result<(PathBuf, AgentHubTemplateManifest, PackageInventory), String> {
    let (package, manifest) = resolve_package(root, id)?;
    let workspace = package.join("workspace");
    let workspace_metadata = fs::symlink_metadata(&workspace)
        .map_err(|e| format!("Template workspace is unavailable: {e}"))?;
    if metadata_is_link(&workspace_metadata) || !workspace_metadata.is_dir() {
        return Err("Template workspace is not a direct bundled directory".to_string());
    }
    let workspace = workspace
        .canonicalize()
        .map_err(|e| format!("Template workspace is unavailable: {e}"))?;
    if !workspace.starts_with(&package) {
        return Err("Template workspace escaped its package".to_string());
    }
    let inventory = inventory_workspace(&workspace)?;
    validate_reviewed_payload(&workspace, &inventory, id, &manifest.version)?;
    let manifest_skills: HashSet<&str> = manifest
        .skills
        .iter()
        .map(|skill| skill.id.as_str())
        .collect();
    let disk_skills: HashSet<String> = fs::read_dir(workspace.join(".claude").join("skills"))
        .map_err(|e| format!("Failed to scan Skills: {e}"))?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            entry
                .file_type()
                .ok()
                .filter(|kind| kind.is_dir())
                .map(|_| entry.file_name().to_string_lossy().to_string())
        })
        .collect();
    if manifest_skills.len() != manifest.skills.len()
        || manifest_skills.len() != disk_skills.len()
        || !manifest_skills
            .iter()
            .all(|skill| disk_skills.contains(*skill))
    {
        return Err(format!("Manifest Skill list does not match template {id}"));
    }
    Ok((workspace, manifest, inventory))
}

fn copy_inventory(src: &Path, dst: &Path, files: &[PathBuf]) -> Result<(), String> {
    for rel in files {
        let target = dst.join(rel);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create template directory: {e}"))?;
        }
        fs::copy(src.join(rel), &target)
            .map_err(|e| format!("Failed to copy template file '{}': {e}", rel.display()))?;
    }
    Ok(())
}

fn slot_is_occupied(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(format!("Failed to inspect destination: {e}")),
    }
}

fn sanitize_workspace_name(name: &str) -> String {
    let mut out = String::new();
    let mut previous_dash = false;
    for ch in name.trim().chars() {
        let keep = ch.is_alphanumeric() || ch == '_' || ch > '\u{2E7F}';
        if keep {
            out.push(ch);
            previous_dash = false;
        } else if (ch == '-' || ch.is_whitespace()) && !previous_dash && !out.is_empty() {
            out.push('-');
            previous_dash = true;
        }
    }
    out.trim_matches('-').chars().take(80).collect()
}

fn available_workspace_path(projects: &Path, base: &str) -> Result<PathBuf, String> {
    let first = projects.join(base);
    if !slot_is_occupied(&first)? {
        return Ok(first);
    }
    for suffix in 2..=100 {
        let candidate = projects.join(format!("{base}-{suffix}"));
        if !slot_is_occupied(&candidate)? {
            return Ok(candidate);
        }
    }
    Ok(projects.join(format!("{base}-{}", Uuid::new_v4().simple())))
}

fn validate_workspace_root(raw: &str) -> Result<PathBuf, String> {
    let lexical = crate::commands::validate_file_path(raw)?;
    let metadata =
        fs::symlink_metadata(&lexical).map_err(|e| format!("Workspace is unavailable: {e}"))?;
    if metadata_is_link(&metadata) || !metadata.is_dir() {
        return Err("Workspace path must be a direct directory".to_string());
    }
    let canonical = lexical
        .canonicalize()
        .map_err(|e| format!("Failed to resolve workspace: {e}"))?;
    crate::commands::validate_file_path(&canonical.to_string_lossy())?;
    if !canonical.is_dir() {
        return Err("Workspace path is not a directory".to_string());
    }
    Ok(canonical)
}

fn revalidate_bound_workspace(workspace: &Path) -> Result<(), String> {
    let metadata =
        fs::symlink_metadata(workspace).map_err(|e| format!("Workspace is unavailable: {e}"))?;
    if metadata_is_link(&metadata) || !metadata.is_dir() {
        return Err("Workspace root changed after preview".to_string());
    }
    Ok(())
}

fn safe_target_fingerprint(root: &Path, rel: &Path) -> Result<TargetFingerprint, String> {
    revalidate_bound_workspace(root)?;
    let mut current = root.to_path_buf();
    let components: Vec<_> = rel.components().collect();
    for (index, component) in components.iter().enumerate() {
        let Component::Normal(segment) = component else {
            return Err("Invalid relative template path".to_string());
        };
        current.push(segment);
        match fs::symlink_metadata(&current) {
            Ok(meta) if metadata_is_link(&meta) => return Ok(TargetFingerprint::Symlink),
            Ok(meta) if index + 1 < components.len() && !meta.is_dir() => {
                return Ok(TargetFingerprint::Other)
            }
            Ok(meta) if index + 1 == components.len() && meta.is_dir() => {
                return Ok(TargetFingerprint::Directory)
            }
            Ok(meta) if index + 1 == components.len() && meta.is_file() => {
                let bytes = fs::read(&current)
                    .map_err(|e| format!("Failed to fingerprint target file: {e}"))?;
                return Ok(TargetFingerprint::File {
                    len: meta.len(),
                    sha256: format!("{:x}", Sha256::digest(bytes)),
                });
            }
            Ok(_) if index + 1 == components.len() => return Ok(TargetFingerprint::Other),
            Ok(_) => {}
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(TargetFingerprint::Missing),
            Err(e) => return Err(format!("Failed to inspect workspace target: {e}")),
        }
    }
    Ok(TargetFingerprint::Other)
}

fn capture_file_fingerprints(
    workspace: &Path,
    files: &[PathBuf],
) -> Result<HashMap<PathBuf, TargetFingerprint>, String> {
    let mut fingerprints = HashMap::new();
    for rel in files {
        let fingerprint = safe_target_fingerprint(workspace, rel)?;
        if !matches!(fingerprint, TargetFingerprint::File { .. }) {
            return Err(format!(
                "Created workspace file is unavailable at {}",
                rel.display()
            ));
        }
        fingerprints.insert(rel.clone(), fingerprint);
    }
    Ok(fingerprints)
}

fn verify_unchanged_creation(pending: &PendingCreation) -> Result<(), String> {
    revalidate_bound_workspace(&pending.workspace)?;
    let current_inventory = inventory_workspace(&pending.workspace)?;
    if current_inventory.files != pending.files {
        return Err("Created workspace was modified before rollback".to_string());
    }
    for rel in &pending.files {
        if pending.fingerprints.get(rel) != Some(&safe_target_fingerprint(&pending.workspace, rel)?)
        {
            return Err("Created workspace was modified before rollback".to_string());
        }
    }
    Ok(())
}

fn build_preview(
    root: &Path,
    template_id: &str,
    workspace: &Path,
) -> Result<(AgentHubApplyPreview, PendingPreview), String> {
    let (_, manifest, inventory) = validated_workspace_source(root, template_id)?;
    let mut add = Vec::new();
    let mut overwrite = Vec::new();
    let mut conflicts = Vec::new();
    let mut fingerprints = HashMap::new();
    for rel in &inventory.files {
        let fingerprint = safe_target_fingerprint(workspace, rel)?;
        let display = rel.to_string_lossy().replace('\\', "/");
        match fingerprint {
            TargetFingerprint::Missing => add.push(display),
            TargetFingerprint::File { .. } => overwrite.push(display),
            _ => conflicts.push(display),
        }
        fingerprints.insert(rel.clone(), fingerprint);
    }
    add.sort();
    overwrite.sort();
    conflicts.sort();
    let preview_id = Uuid::new_v4().to_string();
    let response = AgentHubApplyPreview {
        preview_id: preview_id.clone(),
        template_id: template_id.to_string(),
        template_version: manifest.version.clone(),
        add: add.clone(),
        overwrite: overwrite.clone(),
        conflicts: conflicts.clone(),
    };
    let pending = PendingPreview {
        template_id: template_id.to_string(),
        template_version: manifest.version,
        workspace: workspace.to_path_buf(),
        files: inventory.files,
        fingerprints,
        add,
        overwrite,
        conflicts,
        created_at: Instant::now(),
    };
    Ok((response, pending))
}

fn atomic_copy(source: &Path, target: &Path) -> io::Result<()> {
    let parent = target
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "target has no parent"))?;
    if !parent.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "target parent is unavailable",
        ));
    }
    let temp = parent.join(format!(
        ".blexagent-agenthub-{}.tmp",
        Uuid::new_v4().simple()
    ));
    if let Err(error) = fs::copy(source, &temp).and_then(|_| fs::rename(&temp, target)) {
        let _ = fs::remove_file(&temp);
        return Err(error);
    }
    Ok(())
}

fn ensure_target_parent(
    workspace: &Path,
    rel: &Path,
    created_dirs: &mut Vec<PathBuf>,
) -> Result<(), String> {
    let mut current = workspace.to_path_buf();
    let parent = rel
        .parent()
        .ok_or_else(|| "Template target has no parent".to_string())?;
    for component in parent.components() {
        let Component::Normal(segment) = component else {
            return Err("Invalid relative template path".to_string());
        };
        current.push(segment);
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata_is_link(&metadata) || !metadata.is_dir() => {
                return Err("Workspace target parent is not a direct directory".to_string())
            }
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                match fs::create_dir(&current) {
                    Ok(()) => created_dirs.push(current.clone()),
                    Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                        let metadata = fs::symlink_metadata(&current)
                            .map_err(|e| format!("Failed to inspect workspace directory: {e}"))?;
                        if metadata_is_link(&metadata) || !metadata.is_dir() {
                            return Err(
                                "Workspace target parent is not a direct directory".to_string()
                            );
                        }
                    }
                    Err(error) => {
                        return Err(format!("Failed to create workspace directory: {error}"))
                    }
                }
            }
            Err(error) => return Err(format!("Failed to inspect workspace directory: {error}")),
        }
    }
    Ok(())
}

fn rollback_applied(
    workspace: &Path,
    backup: &Path,
    applied: &[PathBuf],
    created_dirs: &[PathBuf],
) -> Result<(), String> {
    let mut errors = Vec::new();
    for rel in applied.iter().rev() {
        let target = workspace.join(rel);
        let original = backup.join(rel);
        let result = if original.is_file() {
            atomic_copy(&original, &target)
        } else {
            match fs::remove_file(&target) {
                Ok(()) => Ok(()),
                Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
                Err(e) => Err(e),
            }
        };
        if let Err(error) = result {
            errors.push(format!("{}: {error}", rel.display()));
        }
    }
    for dir in created_dirs.iter().rev() {
        match fs::remove_dir(dir) {
            Ok(()) => {}
            Err(e)
                if matches!(
                    e.kind(),
                    io::ErrorKind::NotFound | io::ErrorKind::DirectoryNotEmpty
                ) => {}
            Err(e) => errors.push(format!("{}: {e}", dir.display())),
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(format!("Rollback failed for {}", errors.join(", ")))
    }
}

fn failed_apply_with_rollback(
    workspace: &Path,
    backup: &Path,
    applied: &[PathBuf],
    created_dirs: &[PathBuf],
    message: String,
) -> String {
    match rollback_applied(workspace, backup, applied, created_dirs) {
        Ok(()) => message,
        Err(rollback_error) => format!("{message}; {rollback_error}; transaction backup retained"),
    }
}

fn apply_transaction(
    source: &Path,
    workspace: &Path,
    files: &[PathBuf],
    expected: &HashMap<PathBuf, TargetFingerprint>,
    mut replace: impl FnMut(&Path, &Path) -> io::Result<()>,
) -> Result<(), String> {
    revalidate_bound_workspace(workspace)?;
    if expected.len() != files.len() || files.iter().any(|rel| !expected.contains_key(rel)) {
        return Err("Preview fingerprint set does not match the template".to_string());
    }
    let transaction = workspace
        .parent()
        .ok_or("Workspace has no parent directory")?
        .join(format!(
            ".blexagent-agenthub-tx-{}",
            Uuid::new_v4().simple()
        ));
    let stage = transaction.join("stage");
    let backup = transaction.join("backup");
    fs::create_dir(&transaction).map_err(|e| format!("Failed to create transaction: {e}"))?;
    if let Err(error) = fs::create_dir(&stage) {
        let _ = fs::remove_dir_all(&transaction);
        return Err(format!("Failed to create transaction stage: {error}"));
    }
    if let Err(error) = fs::create_dir(&backup) {
        let _ = fs::remove_dir_all(&transaction);
        return Err(format!("Failed to create transaction backup: {error}"));
    }

    let result = (|| {
        copy_inventory(source, &stage, files)?;

        // No workspace mutation is allowed until every target has passed the
        // preview-bound fingerprint check and every overwritten file has a
        // verified backup.
        for rel in files {
            let fingerprint = safe_target_fingerprint(workspace, rel)?;
            if expected.get(rel) != Some(&fingerprint) {
                return Err("Workspace changed after preview".to_string());
            }
            match &fingerprint {
                TargetFingerprint::File { .. } | TargetFingerprint::Missing => {}
                _ => return Err(format!("Workspace target conflicts at {}", rel.display())),
            }
        }
        for rel in files {
            if matches!(expected.get(rel), Some(TargetFingerprint::File { .. })) {
                let backup_file = backup.join(rel);
                if let Some(parent) = backup_file.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create transaction backup: {e}"))?;
                }
                fs::copy(workspace.join(rel), backup_file)
                    .map_err(|e| format!("Failed to back up '{}': {e}", rel.display()))?;
                let backup_fingerprint = safe_target_fingerprint(&backup, rel)?;
                if expected.get(rel) != Some(&backup_fingerprint) {
                    return Err("Workspace changed while preparing its backup".to_string());
                }
            }
        }

        let mut applied = Vec::new();
        let mut created_dirs = Vec::new();
        for rel in files {
            if let Err(error) = ensure_target_parent(workspace, rel, &mut created_dirs) {
                return Err(failed_apply_with_rollback(
                    workspace,
                    &backup,
                    &applied,
                    &created_dirs,
                    error,
                ));
            }
            match safe_target_fingerprint(workspace, rel) {
                Ok(current) if expected.get(rel) == Some(&current) => {}
                Ok(_) => {
                    return Err(failed_apply_with_rollback(
                        workspace,
                        &backup,
                        &applied,
                        &created_dirs,
                        "Workspace changed while applying the template".to_string(),
                    ))
                }
                Err(error) => {
                    return Err(failed_apply_with_rollback(
                        workspace,
                        &backup,
                        &applied,
                        &created_dirs,
                        error,
                    ))
                }
            }
            if let Err(error) = replace(&stage.join(rel), &workspace.join(rel)) {
                return Err(failed_apply_with_rollback(
                    workspace,
                    &backup,
                    &applied,
                    &created_dirs,
                    format!("Failed to apply '{}': {error}", rel.display()),
                ));
            }
            applied.push(rel.clone());
        }
        Ok(())
    })();

    if result.is_ok()
        || !result
            .as_ref()
            .is_err_and(|error| error.contains("backup retained"))
    {
        let _ = fs::remove_dir_all(&transaction);
    }
    result
}

fn completed_outcome(
    completed: &VecDeque<CompletedReceipt>,
    receipt_id: &str,
) -> Option<ReceiptOutcome> {
    completed
        .iter()
        .find(|receipt| receipt.receipt_id == receipt_id)
        .map(|receipt| receipt.outcome)
}

fn prepare_completed_receipt(
    receipt_id: &str,
    outcome: ReceiptOutcome,
) -> Result<CompletedReceipt, String> {
    let mut owned_id = String::new();
    owned_id
        .try_reserve_exact(receipt_id.len())
        .map_err(|_| "AgentHub completed receipt capacity is unavailable".to_string())?;
    owned_id.push_str(receipt_id);
    Ok(CompletedReceipt {
        receipt_id: owned_id,
        outcome,
    })
}

fn reserve_completed_slot(completed: &mut VecDeque<CompletedReceipt>) -> Result<(), String> {
    if completed.len() < MAX_COMPLETED_RECEIPTS {
        completed
            .try_reserve(1)
            .map_err(|_| "AgentHub completed receipt capacity is unavailable".to_string())?;
    }
    Ok(())
}

fn record_completed_receipt(completed: &mut VecDeque<CompletedReceipt>, receipt: CompletedReceipt) {
    if let Some(position) = completed
        .iter()
        .position(|known| known.receipt_id == receipt.receipt_id)
    {
        completed.remove(position);
    }
    if completed.len() >= MAX_COMPLETED_RECEIPTS {
        completed.pop_front();
    }
    completed.push_back(receipt);
}

fn completed_retry_result(
    completed: &VecDeque<CompletedReceipt>,
    receipt_id: &str,
    requested: ReceiptOutcome,
) -> Result<(), String> {
    match completed_outcome(completed, receipt_id) {
        Some(actual) if actual == requested => Ok(()),
        Some(ReceiptOutcome::Finalized) => {
            Err("AgentHub creation receipt was already finalized".to_string())
        }
        Some(ReceiptOutcome::RolledBack) => {
            Err("AgentHub creation receipt was already rolled back".to_string())
        }
        None => Err("Unknown AgentHub creation receipt".to_string()),
    }
}

fn finalize_creation_receipt(state: &AgentHubState, receipt_id: &str) -> Result<(), String> {
    // Every completion path locks pending receipts before completed receipts.
    // Taking both locks before mutation makes the result and its idempotency
    // record a single in-memory transaction.
    let mut creations = state
        .creations
        .lock()
        .map_err(|_| "AgentHub creation state is unavailable".to_string())?;
    let mut completed = state
        .completed
        .lock()
        .map_err(|_| "AgentHub completed receipt state is unavailable".to_string())?;

    if creations
        .get(receipt_id)
        .is_some_and(|pending| pending.rollback_only)
    {
        return Err("AgentHub creation receipt is awaiting rollback recovery".to_string());
    }
    if creations.contains_key(receipt_id) {
        let receipt = prepare_completed_receipt(receipt_id, ReceiptOutcome::Finalized)?;
        reserve_completed_slot(&mut completed)?;
        creations.remove(receipt_id);
        record_completed_receipt(&mut completed, receipt);
        return Ok(());
    }
    completed_retry_result(&completed, receipt_id, ReceiptOutcome::Finalized)
}

fn restore_rollback_quarantine(
    pending: &mut PendingCreation,
    original_workspace: &Path,
    quarantine: &Path,
    failure: String,
) -> Result<(), String> {
    match fs::rename(quarantine, original_workspace) {
        Ok(()) => Err(format!("{failure}; created workspace restored for retry")),
        Err(restore_error) => {
            // Retain a usable pointer to the isolated workspace where possible.
            // The receipt remains pending and no unreviewed path is deleted.
            pending.workspace = quarantine.to_path_buf();
            pending.rollback_only = true;
            Err(format!(
                "{failure}; failed to restore isolated workspace: {restore_error}"
            ))
        }
    }
}

fn verify_recoverable_quarantine(pending: &PendingCreation) -> Result<(), String> {
    fn walk(root: &Path, dir: &Path, pending: &PendingCreation) -> Result<(), String> {
        for entry in
            fs::read_dir(dir).map_err(|e| format!("Failed to inspect rollback quarantine: {e}"))?
        {
            let entry = entry.map_err(|e| format!("Failed to inspect rollback quarantine: {e}"))?;
            let name = entry.file_name();
            portable_inventory_name(&name)?;
            let path = entry.path();
            let relative = path
                .strip_prefix(root)
                .map_err(|_| "Rollback quarantine path escaped its root".to_string())?
                .to_path_buf();
            let metadata = fs::symlink_metadata(&path)
                .map_err(|e| format!("Failed to inspect rollback quarantine entry: {e}"))?;
            if metadata_is_link(&metadata) {
                return Err("Rollback quarantine contains a symlink".to_string());
            }
            if metadata.is_dir() {
                if !pending.files.iter().any(|original| {
                    original.starts_with(&relative) && original.as_path() != relative.as_path()
                }) {
                    return Err(format!(
                        "Rollback quarantine contains an unexpected directory: {}",
                        relative.display()
                    ));
                }
                walk(root, &path, pending)?;
                continue;
            }
            if !metadata.is_file()
                || !pending.files.contains(&relative)
                || pending.fingerprints.get(&relative)
                    != Some(&safe_target_fingerprint(root, &relative)?)
            {
                return Err(format!(
                    "Rollback quarantine contains an unexpected or modified file: {}",
                    relative.display()
                ));
            }
        }
        Ok(())
    }

    revalidate_bound_workspace(&pending.workspace)?;
    walk(&pending.workspace, &pending.workspace, pending)
}

fn remove_rollback_quarantine<F>(
    pending: &mut PendingCreation,
    quarantine: &Path,
    remove_quarantine: F,
) -> Result<(), String>
where
    F: FnOnce(&Path) -> io::Result<()>,
{
    pending.workspace = quarantine.to_path_buf();
    pending.rollback_only = true;
    if let Err(error) = remove_quarantine(quarantine) {
        if fs::symlink_metadata(quarantine)
            .is_err_and(|inspect_error| inspect_error.kind() == io::ErrorKind::NotFound)
        {
            // Some platform implementations can report a late cleanup error
            // even though the directory is already gone.
            return Ok(());
        }
        return Err(format!(
            "Failed to roll back created Agent: {error}; partially removed workspace retained in quarantine"
        ));
    }
    Ok(())
}

fn rollback_pending_creation<F>(
    projects: &Path,
    pending: &mut PendingCreation,
    remove_quarantine: F,
) -> Result<(), String>
where
    F: FnOnce(&Path) -> io::Result<()>,
{
    let workspace = pending
        .workspace
        .canonicalize()
        .map_err(|e| format!("Failed to resolve created workspace: {e}"))?;
    if workspace != pending.workspace || workspace == projects || !workspace.starts_with(projects) {
        return Err("Refusing to roll back a path outside AgentHub projects".to_string());
    }
    if pending.rollback_only {
        // A previous remove_dir_all may have deleted only a subset. Permit a
        // direct retry only while every remaining entry is still an unchanged
        // subset of the reviewed creation receipt.
        verify_recoverable_quarantine(pending)?;
        return remove_rollback_quarantine(pending, &workspace, remove_quarantine);
    }
    verify_unchanged_creation(pending)?;

    let quarantine = projects.join(format!(
        ".blexagent-agenthub-rollback-{}",
        Uuid::new_v4().simple()
    ));
    fs::rename(&workspace, &quarantine)
        .map_err(|e| format!("Failed to isolate created Agent for rollback: {e}"))?;

    let quarantined = PendingCreation {
        workspace: quarantine.clone(),
        files: pending.files.clone(),
        fingerprints: pending.fingerprints.clone(),
        rollback_only: true,
    };
    if let Err(error) = verify_unchanged_creation(&quarantined) {
        return restore_rollback_quarantine(pending, &workspace, &quarantine, error);
    }
    // remove_dir_all may remove only part of a tree before returning an error,
    // so failures stay quarantined and are never renamed back as an apparently
    // intact user workspace.
    remove_rollback_quarantine(pending, &quarantine, remove_quarantine)
}

fn rollback_creation_receipt_with<F, R>(
    state: &AgentHubState,
    receipt_id: &str,
    resolve_projects: R,
    remove_quarantine: F,
) -> Result<(), String>
where
    F: FnOnce(&Path) -> io::Result<()>,
    R: FnOnce() -> Result<PathBuf, String>,
{
    // Keep both stores locked throughout filesystem work. If deletion succeeds,
    // the pending removal and completed outcome are recorded before either lock
    // is released, so a retry cannot observe an ambiguous result.
    let mut creations = state
        .creations
        .lock()
        .map_err(|_| "AgentHub creation state is unavailable".to_string())?;
    let mut completed = state
        .completed
        .lock()
        .map_err(|_| "AgentHub completed receipt state is unavailable".to_string())?;
    let Some(pending) = creations.get_mut(receipt_id) else {
        return completed_retry_result(&completed, receipt_id, ReceiptOutcome::RolledBack);
    };
    // Allocate the bounded completion record before the irreversible delete.
    // With both locks held and capacity reserved, a successful deletion cannot
    // be observed without its RolledBack outcome being recorded.
    let completion = prepare_completed_receipt(receipt_id, ReceiptOutcome::RolledBack)?;
    reserve_completed_slot(&mut completed)?;
    let projects = resolve_projects()?;
    rollback_pending_creation(&projects, pending, remove_quarantine)?;
    creations.remove(receipt_id);
    record_completed_receipt(&mut completed, completion);
    Ok(())
}

#[cfg(test)]
fn rollback_creation_receipt<F>(
    state: &AgentHubState,
    receipt_id: &str,
    projects: &Path,
    remove_quarantine: F,
) -> Result<(), String>
where
    F: FnOnce(&Path) -> io::Result<()>,
{
    rollback_creation_receipt_with(
        state,
        receipt_id,
        || Ok(projects.to_path_buf()),
        remove_quarantine,
    )
}

fn load_catalogue_from_root(root: &Path) -> Result<AgentHubCatalogueResponse, String> {
    let catalogue = read_catalogue(root)?;
    let mut templates = Vec::new();
    let mut errors = Vec::new();
    for id in &catalogue.template_ids {
        match validated_workspace_source(root, id) {
            Ok((_, manifest, _)) => templates.push(manifest),
            Err(_) => errors.push(format!("{id}: unavailable")),
        }
    }
    Ok(AgentHubCatalogueResponse {
        schema_version: catalogue.schema_version,
        templates,
        errors,
    })
}

#[cfg(windows)]
fn replace_ascii_case_insensitive(value: &str, needle: &str, replacement: &str) -> String {
    if needle.is_empty() {
        return value.to_string();
    }
    // ASCII case-folding preserves UTF-8 byte offsets. This covers Windows
    // drive letters and the case-insensitive ASCII portions of private paths
    // without corrupting non-ASCII path segments.
    let folded_value = value.to_ascii_lowercase();
    let folded_needle = needle.to_ascii_lowercase();
    let mut output = String::with_capacity(value.len());
    let mut cursor = 0;
    while let Some(offset) = folded_value[cursor..].find(&folded_needle) {
        let start = cursor + offset;
        output.push_str(&value[cursor..start]);
        output.push_str(replacement);
        cursor = start + needle.len();
    }
    output.push_str(&value[cursor..]);
    output
}

fn replace_private_path(value: &str, private_path: &str) -> String {
    #[cfg(windows)]
    {
        replace_ascii_case_insensitive(value, private_path, "<private-path>")
    }
    #[cfg(not(windows))]
    {
        value.replace(private_path, "<private-path>")
    }
}

fn sanitize_internal_error(detail: &str) -> String {
    let mut sanitized = detail.to_string();
    let mut private_roots = [
        dirs::home_dir(),
        Some(std::env::temp_dir()),
        std::env::current_dir().ok(),
    ]
    .into_iter()
    .flatten()
    .map(|path| path.to_string_lossy().to_string())
    .collect::<Vec<_>>();
    private_roots.sort_by_key(|path| std::cmp::Reverse(path.len()));
    private_roots.dedup();
    for private_root in private_roots {
        for variant in [private_root.clone(), private_root.replace('\\', "/")] {
            if !variant.is_empty() {
                sanitized = replace_private_path(&sanitized, &variant);
            }
        }
    }
    sanitized = sanitized
        .chars()
        .map(|ch| if ch.is_control() { ' ' } else { ch })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if sanitized.chars().count() > MAX_INTERNAL_ERROR_CHARS {
        sanitized = sanitized
            .chars()
            .take(MAX_INTERNAL_ERROR_CHARS)
            .collect::<String>();
        sanitized.push('…');
    }
    if sanitized.is_empty() {
        "unspecified internal error".to_string()
    } else {
        sanitized
    }
}

fn public_command_error(operation: &str, message: &str, detail: &str) -> String {
    crate::ulog_error!(
        "[AgentHub] {} failed: {}",
        operation,
        sanitize_internal_error(detail)
    );
    message.to_string()
}

#[tauri::command]
pub async fn cmd_agent_hub_get_catalogue<R: Runtime>(
    app_handle: AppHandle<R>,
) -> Result<AgentHubCatalogueResponse, String> {
    match tauri::async_runtime::spawn_blocking(move || {
        let root = resource_root(&app_handle)?;
        load_catalogue_from_root(&root)
    })
    .await
    {
        Ok(Ok(catalogue)) => Ok(catalogue),
        Ok(Err(detail)) => Err(public_command_error(
            "catalogue",
            "AgentHub catalogue is unavailable",
            &detail,
        )),
        Err(join_error) => Err(public_command_error(
            "catalogue",
            "AgentHub catalogue is unavailable",
            &format!("AgentHub blocking task failed: {join_error}"),
        )),
    }
}

#[tauri::command]
pub async fn cmd_create_workspace_from_agent_hub_template<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, AgentHubState>,
    template_id: String,
    workspace_name: String,
) -> Result<AgentHubWorkspaceReceipt, String> {
    let state = state.inner().clone();
    match tauri::async_runtime::spawn_blocking(move || {
        let root = resource_root(&app_handle)?;
        let (source, manifest, inventory) = validated_workspace_source(&root, &template_id)?;
        let name = sanitize_workspace_name(&workspace_name);
        if name.is_empty() {
            return Err("Agent name is empty after sanitization".to_string());
        }
        let home = dirs::home_dir().ok_or("Failed to get home directory")?;
        let projects = home.join(".blexagent").join("projects");
        fs::create_dir_all(&projects)
            .map_err(|e| format!("Failed to create projects directory: {e}"))?;
        let projects = projects
            .canonicalize()
            .map_err(|e| format!("Failed to resolve projects directory: {e}"))?;
        let destination = available_workspace_path(&projects, &name)?;
        let stage = projects.join(format!(
            ".blexagent-agenthub-create-{}",
            Uuid::new_v4().simple()
        ));
        fs::create_dir(&stage).map_err(|e| format!("Failed to create staging directory: {e}"))?;
        let copy_result = copy_inventory(&source, &stage, &inventory.files)
            .and_then(|_| inventory_workspace(&stage).map(|_| ()))
            .and_then(|_| {
                fs::rename(&stage, &destination)
                    .map_err(|e| format!("Failed to commit Agent workspace: {e}"))
            });
        if let Err(error) = copy_result {
            let _ = fs::remove_dir_all(&stage);
            return Err(error);
        }
        let destination = match destination.canonicalize() {
            Ok(path) => path,
            Err(error) => {
                let _ = fs::remove_dir_all(&destination);
                return Err(format!(
                    "Failed to resolve created Agent workspace: {error}"
                ));
            }
        };
        let fingerprints = match capture_file_fingerprints(&destination, &inventory.files) {
            Ok(fingerprints) => fingerprints,
            Err(error) => {
                let _ = fs::remove_dir_all(&destination);
                return Err(error);
            }
        };
        let receipt_id = Uuid::new_v4().to_string();
        let mut creations = match state.creations.lock() {
            Ok(creations) => creations,
            Err(_) => {
                let _ = fs::remove_dir_all(&destination);
                return Err("AgentHub creation state is unavailable".to_string());
            }
        };
        if creations.len() >= MAX_PENDING_CREATIONS {
            drop(creations);
            let _ = fs::remove_dir_all(&destination);
            return Err("Too many AgentHub creations are awaiting confirmation".to_string());
        }
        creations.insert(
            receipt_id.clone(),
            PendingCreation {
                workspace: destination.clone(),
                files: inventory.files,
                fingerprints,
                rollback_only: false,
            },
        );
        let external_destination = crate::sidecar::normalize_external_path(destination.clone());
        Ok(AgentHubWorkspaceReceipt {
            path: external_destination.to_string_lossy().to_string(),
            is_new: true,
            receipt_id,
            template_id,
            template_version: manifest.version,
        })
    })
    .await
    {
        Ok(Ok(receipt)) => Ok(receipt),
        Ok(Err(detail)) => Err(public_command_error(
            "create",
            "Unable to create this Agent",
            &detail,
        )),
        Err(join_error) => Err(public_command_error(
            "create",
            "Unable to create this Agent",
            &format!("AgentHub blocking task failed: {join_error}"),
        )),
    }
}

#[tauri::command]
pub fn cmd_agent_hub_finalize_workspace(
    state: State<'_, AgentHubState>,
    receipt_id: String,
) -> Result<(), String> {
    finalize_creation_receipt(state.inner(), &receipt_id).map_err(|detail| {
        public_command_error("finalize", "Unable to finalize this Agent", &detail)
    })
}

#[tauri::command]
pub async fn cmd_agent_hub_rollback_workspace(
    state: State<'_, AgentHubState>,
    receipt_id: String,
) -> Result<(), String> {
    let state = state.inner().clone();
    match tauri::async_runtime::spawn_blocking(move || {
        rollback_creation_receipt_with(
            &state,
            &receipt_id,
            || {
                let home = dirs::home_dir().ok_or("Failed to get home directory")?;
                home.join(".blexagent")
                    .join("projects")
                    .canonicalize()
                    .map_err(|e| format!("Failed to resolve projects directory: {e}"))
            },
            |path| fs::remove_dir_all(path),
        )
    })
    .await
    {
        Ok(Ok(())) => Ok(()),
        Ok(Err(detail)) => Err(public_command_error(
            "rollback",
            "Unable to roll back this Agent",
            &detail,
        )),
        Err(join_error) => Err(public_command_error(
            "rollback",
            "Unable to roll back this Agent",
            &format!("AgentHub blocking task failed: {join_error}"),
        )),
    }
}

#[tauri::command]
pub async fn cmd_agent_hub_template_apply_preview<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, AgentHubState>,
    template_id: String,
    workspace_path: String,
) -> Result<AgentHubApplyPreview, String> {
    let state = state.inner().clone();
    match tauri::async_runtime::spawn_blocking(move || {
        let root = resource_root(&app_handle)?;
        let workspace = validate_workspace_root(&workspace_path)?;
        let (response, pending) = build_preview(&root, &template_id, &workspace)?;
        let mut previews = state
            .previews
            .lock()
            .map_err(|_| "AgentHub preview state is unavailable")?;
        previews.retain(|_, value| value.created_at.elapsed() <= PREVIEW_TTL);
        if previews.len() >= MAX_PENDING_PREVIEWS {
            return Err("Too many AgentHub previews are active".to_string());
        }
        previews.insert(response.preview_id.clone(), pending);
        Ok(response)
    })
    .await
    {
        Ok(Ok(preview)) => Ok(preview),
        Ok(Err(detail)) => Err(public_command_error(
            "preview",
            "Unable to preview this template",
            &detail,
        )),
        Err(join_error) => Err(public_command_error(
            "preview",
            "Unable to preview this template",
            &format!("AgentHub blocking task failed: {join_error}"),
        )),
    }
}

#[tauri::command]
pub async fn cmd_apply_agent_hub_template_to_workspace<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, AgentHubState>,
    preview_id: String,
) -> Result<AgentHubApplyResult, String> {
    let state = state.inner().clone();
    match tauri::async_runtime::spawn_blocking(move || {
        let pending = state
            .previews
            .lock()
            .map_err(|_| "AgentHub preview state is unavailable")?
            .remove(&preview_id)
            .ok_or("AgentHub preview expired; preview the template again")?;
        if pending.created_at.elapsed() > PREVIEW_TTL {
            return Err("AgentHub preview expired; preview the template again".to_string());
        }
        if !pending.conflicts.is_empty() {
            return Err("AgentHub preview contains target conflicts".to_string());
        }
        revalidate_bound_workspace(&pending.workspace)?;
        let canonical_workspace = pending
            .workspace
            .canonicalize()
            .map_err(|e| format!("Failed to resolve workspace: {e}"))?;
        if canonical_workspace != pending.workspace {
            return Err("Workspace root changed after preview".to_string());
        }
        let root = resource_root(&app_handle)?;
        let (source, manifest, inventory) =
            validated_workspace_source(&root, &pending.template_id)?;
        if manifest.version != pending.template_version || inventory.files != pending.files {
            return Err("AgentHub template changed; preview it again".to_string());
        }
        apply_transaction(
            &source,
            &pending.workspace,
            &pending.files,
            &pending.fingerprints,
            atomic_copy,
        )?;
        Ok(AgentHubApplyResult {
            add: pending.add,
            overwrite: pending.overwrite,
        })
    })
    .await
    {
        Ok(Ok(result)) => Ok(result),
        Ok(Err(detail)) => Err(public_command_error(
            "apply",
            "Unable to apply this template; preview it again",
            &detail,
        )),
        Err(join_error) => Err(public_command_error(
            "apply",
            "Unable to apply this template; preview it again",
            &format!("AgentHub blocking task failed: {join_error}"),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_valid_workspace(root: &Path) {
        for (path, content) in [
            ("CLAUDE.md", "# Agent"),
            ("INTRODUCTION.md", "# Guide"),
            (".claude/rules/SOUL.md", "# Soul"),
            (".claude/rules/USER.md", "# User"),
            (
                ".claude/skills/example-skill/SKILL.md",
                "---\nname: example-skill\ndescription: Example\n---\n# Example",
            ),
        ] {
            let target = root.join(path);
            fs::create_dir_all(target.parent().unwrap()).unwrap();
            fs::write(target, content).unwrap();
        }
    }

    fn expected_fingerprints(
        workspace: &Path,
        files: &[PathBuf],
    ) -> HashMap<PathBuf, TargetFingerprint> {
        files
            .iter()
            .map(|rel| {
                (
                    rel.clone(),
                    safe_target_fingerprint(workspace, rel).unwrap(),
                )
            })
            .collect()
    }

    #[cfg(windows)]
    fn create_directory_link(target: &Path, link: &Path) {
        junction::create(target, link).unwrap();
    }

    #[cfg(unix)]
    fn create_directory_link(target: &Path, link: &Path) {
        std::os::unix::fs::symlink(target, link).unwrap();
    }

    #[test]
    fn strict_template_ids_reject_traversal_and_ambiguous_names() {
        for valid in ["life-manager", "daily-review-2"] {
            assert!(validate_template_id(valid).is_ok(), "{valid}");
        }
        for invalid in [
            "",
            "../life",
            "Life",
            "life_manager",
            "-life",
            "life-",
            "life--manager",
        ] {
            assert!(validate_template_id(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn bundled_catalogue_contains_twelve_fully_validated_templates() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../agenthub");
        let catalogue = load_catalogue_from_root(&root).unwrap();
        assert_eq!(catalogue.templates.len(), EXPECTED_TEMPLATE_COUNT);
        assert!(catalogue.errors.is_empty(), "{:?}", catalogue.errors);
    }

    #[test]
    fn reviewed_payload_digest_rejects_an_adapted_prompt_change() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../agenthub");
        let (source, manifest, inventory) =
            validated_workspace_source(&root, "life-manager").unwrap();
        let tmp = tempfile::tempdir().unwrap();
        copy_inventory(&source, tmp.path(), &inventory.files).unwrap();
        let copied = inventory_workspace(tmp.path()).unwrap();
        validate_reviewed_payload(tmp.path(), &copied, &manifest.id, &manifest.version).unwrap();
        let mut reversed_files = copied.files.clone();
        reversed_files.reverse();
        assert_eq!(
            workspace_payload_sha256(tmp.path(), &copied).unwrap(),
            workspace_payload_sha256(
                tmp.path(),
                &PackageInventory {
                    files: reversed_files
                }
            )
            .unwrap()
        );

        fs::write(tmp.path().join("CLAUDE.md"), "# Unreviewed prompt change").unwrap();
        assert!(
            validate_reviewed_payload(tmp.path(), &copied, &manifest.id, &manifest.version)
                .unwrap_err()
                .contains("does not match its reviewed payload")
        );
    }

    #[test]
    fn package_inventory_rejects_scripts_secrets_and_missing_skill_entrypoints() {
        let tmp = tempfile::tempdir().unwrap();
        write_valid_workspace(tmp.path());
        assert!(inventory_workspace(tmp.path()).is_ok());

        fs::write(tmp.path().join(".env"), "SECRET=x").unwrap();
        assert!(inventory_workspace(tmp.path())
            .unwrap_err()
            .contains("forbidden file"));
        fs::remove_file(tmp.path().join(".env")).unwrap();

        fs::write(
            tmp.path().join(".claude/settings.json"),
            r#"{"hooks":{"PreToolUse":[]}}"#,
        )
        .unwrap();
        assert!(inventory_workspace(tmp.path())
            .unwrap_err()
            .contains("forbidden file"));
        fs::remove_file(tmp.path().join(".claude/settings.json")).unwrap();

        fs::create_dir_all(tmp.path().join("scripts")).unwrap();
        assert!(inventory_workspace(tmp.path())
            .unwrap_err()
            .contains("forbidden directory"));
        fs::remove_dir_all(tmp.path().join("scripts")).unwrap();

        fs::remove_file(tmp.path().join(".claude/skills/example-skill/SKILL.md")).unwrap();
        assert!(inventory_workspace(tmp.path())
            .unwrap_err()
            .contains("not a valid Skill package"));
    }

    #[test]
    fn package_inventory_rejects_case_variants_and_private_keys() {
        let tmp = tempfile::tempdir().unwrap();
        write_valid_workspace(tmp.path());
        fs::create_dir_all(tmp.path().join("Scripts")).unwrap();
        assert!(inventory_workspace(tmp.path())
            .unwrap_err()
            .contains("forbidden directory"));
        fs::remove_dir_all(tmp.path().join("Scripts")).unwrap();

        fs::write(
            tmp.path().join("notes.md"),
            "-----BEGIN OPENSSH PRIVATE KEY-----\nnot-a-real-key",
        )
        .unwrap();
        assert!(inventory_workspace(tmp.path())
            .unwrap_err()
            .contains("private key material"));
        fs::write(tmp.path().join("notes.md"), [0xff, 0x00, 0x89]).unwrap();
        assert!(inventory_workspace(tmp.path())
            .unwrap_err()
            .contains("non-text file"));
    }

    #[test]
    fn package_inventory_names_are_utf8_and_backslash_portable() {
        assert!(portable_inventory_name(OsStr::new("normal-file.md")).is_ok());
        assert!(portable_inventory_name(OsStr::new("bad\\name.md"))
            .unwrap_err()
            .contains("non-portable backslash"));

        #[cfg(unix)]
        {
            use std::os::unix::ffi::OsStrExt;
            assert!(portable_inventory_name(OsStr::from_bytes(b"bad-\xff.md"))
                .unwrap_err()
                .contains("not valid UTF-8"));
        }
    }

    #[test]
    fn package_and_target_validation_reject_directory_links() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().join("workspace");
        let outside = tmp.path().join("outside");
        fs::create_dir_all(&workspace).unwrap();
        fs::create_dir_all(&outside).unwrap();
        write_valid_workspace(&workspace);
        fs::write(outside.join("escape.md"), "outside").unwrap();
        create_directory_link(&outside, &workspace.join("linked"));

        assert!(inventory_workspace(&workspace)
            .unwrap_err()
            .contains("symlink"));
        assert_eq!(
            safe_target_fingerprint(&workspace, Path::new("linked/escape.md")).unwrap(),
            TargetFingerprint::Symlink
        );
    }

    #[test]
    fn preview_classifies_add_overwrite_and_conflict_without_following_symlinks() {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = tmp.path().join("workspace");
        fs::create_dir_all(workspace.join("conflict.md")).unwrap();
        fs::write(workspace.join("existing.md"), "old").unwrap();
        assert_eq!(
            safe_target_fingerprint(&workspace, Path::new("new.md")).unwrap(),
            TargetFingerprint::Missing
        );
        assert!(matches!(
            safe_target_fingerprint(&workspace, Path::new("existing.md")).unwrap(),
            TargetFingerprint::File { .. }
        ));
        assert_eq!(
            safe_target_fingerprint(&workspace, Path::new("conflict.md")).unwrap(),
            TargetFingerprint::Directory
        );
    }

    #[test]
    fn transactional_apply_overwrites_adds_and_preserves_unrelated_files() {
        let tmp = tempfile::tempdir().unwrap();
        let source = tmp.path().join("source");
        let workspace = tmp.path().join("workspace");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(&workspace).unwrap();
        fs::write(source.join("existing.md"), "new").unwrap();
        fs::write(source.join("added.md"), "added").unwrap();
        fs::write(workspace.join("existing.md"), "old").unwrap();
        fs::write(workspace.join("unrelated.md"), "keep").unwrap();
        let files = vec![PathBuf::from("added.md"), PathBuf::from("existing.md")];
        let expected = expected_fingerprints(&workspace, &files);
        apply_transaction(&source, &workspace, &files, &expected, atomic_copy).unwrap();
        assert_eq!(
            fs::read_to_string(workspace.join("existing.md")).unwrap(),
            "new"
        );
        assert_eq!(
            fs::read_to_string(workspace.join("added.md")).unwrap(),
            "added"
        );
        assert_eq!(
            fs::read_to_string(workspace.join("unrelated.md")).unwrap(),
            "keep"
        );
    }

    #[test]
    fn transactional_apply_rolls_back_when_a_later_write_fails() {
        let tmp = tempfile::tempdir().unwrap();
        let source = tmp.path().join("source");
        let workspace = tmp.path().join("workspace");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(&workspace).unwrap();
        fs::write(source.join("a.md"), "new-a").unwrap();
        fs::write(source.join("b.md"), "new-b").unwrap();
        fs::write(workspace.join("a.md"), "old-a").unwrap();
        let files = vec![PathBuf::from("a.md"), PathBuf::from("b.md")];
        let expected = expected_fingerprints(&workspace, &files);
        let mut writes = 0;
        let result = apply_transaction(&source, &workspace, &files, &expected, |src, dst| {
            writes += 1;
            if writes == 2 {
                return Err(io::Error::new(io::ErrorKind::Other, "injected"));
            }
            atomic_copy(src, dst)
        });
        assert!(result.is_err());
        assert_eq!(fs::read_to_string(workspace.join("a.md")).unwrap(), "old-a");
        assert!(!workspace.join("b.md").exists());
    }

    #[test]
    fn transactional_apply_refuses_preview_drift_before_writing() {
        let tmp = tempfile::tempdir().unwrap();
        let source = tmp.path().join("source");
        let workspace = tmp.path().join("workspace");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(&workspace).unwrap();
        fs::write(source.join("a.md"), "template-a").unwrap();
        fs::write(source.join("nested.md"), "template-b").unwrap();
        fs::write(workspace.join("a.md"), "previewed-a").unwrap();
        let files = vec![PathBuf::from("a.md"), PathBuf::from("nested.md")];
        let expected = expected_fingerprints(&workspace, &files);
        fs::write(workspace.join("a.md"), "changed-after-preview").unwrap();

        let result = apply_transaction(&source, &workspace, &files, &expected, atomic_copy);
        assert!(result.unwrap_err().contains("changed after preview"));
        assert_eq!(
            fs::read_to_string(workspace.join("a.md")).unwrap(),
            "changed-after-preview"
        );
        assert!(!workspace.join("nested.md").exists());
    }

    #[test]
    fn transactional_preflight_conflict_leaves_no_created_directories() {
        let tmp = tempfile::tempdir().unwrap();
        let source = tmp.path().join("source");
        let workspace = tmp.path().join("workspace");
        fs::create_dir_all(source.join("nested")).unwrap();
        fs::create_dir_all(workspace.join("later.md")).unwrap();
        fs::write(source.join("nested/a.md"), "a").unwrap();
        fs::write(source.join("later.md"), "b").unwrap();
        let files = vec![PathBuf::from("nested/a.md"), PathBuf::from("later.md")];
        let expected = expected_fingerprints(&workspace, &files);

        assert!(apply_transaction(&source, &workspace, &files, &expected, atomic_copy).is_err());
        assert!(!workspace.join("nested").exists());
        assert!(workspace.join("later.md").is_dir());
    }

    #[test]
    fn rollback_receipt_fingerprint_detects_user_changes() {
        let tmp = tempfile::tempdir().unwrap();
        write_valid_workspace(tmp.path());
        let inventory = inventory_workspace(tmp.path()).unwrap();
        let pending = PendingCreation {
            workspace: tmp.path().to_path_buf(),
            fingerprints: capture_file_fingerprints(tmp.path(), &inventory.files).unwrap(),
            files: inventory.files,
            rollback_only: false,
        };
        fs::write(tmp.path().join("CLAUDE.md"), "user changed this").unwrap();
        assert!(verify_unchanged_creation(&pending)
            .unwrap_err()
            .contains("modified before rollback"));
    }

    #[test]
    fn rollback_failure_retains_quarantine_and_receipt_for_safe_retry() {
        let tmp = tempfile::tempdir().unwrap();
        let projects = tmp.path().join("projects");
        let workspace = projects.join("created-agent");
        fs::create_dir_all(&workspace).unwrap();
        write_valid_workspace(&workspace);
        let projects = projects.canonicalize().unwrap();
        let workspace = workspace.canonicalize().unwrap();
        let inventory = inventory_workspace(&workspace).unwrap();
        let state = AgentHubState::default();
        state.creations.lock().unwrap().insert(
            "receipt".to_string(),
            PendingCreation {
                workspace: workspace.clone(),
                fingerprints: capture_file_fingerprints(&workspace, &inventory.files).unwrap(),
                files: inventory.files,
                rollback_only: false,
            },
        );

        let error = rollback_creation_receipt(&state, "receipt", &projects, |_| {
            Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "injected delete failure",
            ))
        })
        .unwrap_err();
        assert!(error.contains("workspace retained in quarantine"));
        assert!(!workspace.exists());
        let quarantined = state
            .creations
            .lock()
            .unwrap()
            .get("receipt")
            .unwrap()
            .workspace
            .clone();
        assert!(quarantined.is_dir());
        assert!(quarantined.starts_with(&projects));
        assert!(quarantined
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with(".blexagent-agenthub-rollback-"));
        assert!(state.completed.lock().unwrap().is_empty());

        rollback_creation_receipt(&state, "receipt", &projects, |path| {
            fs::remove_dir_all(path)
        })
        .unwrap();
        assert!(!workspace.exists());
        assert!(!state.creations.lock().unwrap().contains_key("receipt"));
        assert_eq!(
            completed_outcome(&state.completed.lock().unwrap(), "receipt"),
            Some(ReceiptOutcome::RolledBack)
        );
        // A lost success response is safe to retry, but the opposite action is
        // rejected rather than silently changing the completed outcome.
        rollback_creation_receipt_with(
            &state,
            "receipt",
            || panic!("idempotent retry must not resolve filesystem paths"),
            |_| panic!("idempotent retry must not touch the filesystem"),
        )
        .unwrap();
        assert!(finalize_creation_receipt(&state, "receipt")
            .unwrap_err()
            .contains("already rolled back"));
    }

    #[test]
    fn partial_delete_failure_stays_quarantined_and_safely_resumes() {
        use std::sync::atomic::{AtomicBool, Ordering};

        let tmp = tempfile::tempdir().unwrap();
        let projects = tmp.path().join("projects");
        let workspace = projects.join("created-agent");
        fs::create_dir_all(&workspace).unwrap();
        write_valid_workspace(&workspace);
        let projects = projects.canonicalize().unwrap();
        let workspace = workspace.canonicalize().unwrap();
        let inventory = inventory_workspace(&workspace).unwrap();
        let state = AgentHubState::default();
        state.creations.lock().unwrap().insert(
            "partial".to_string(),
            PendingCreation {
                workspace: workspace.clone(),
                fingerprints: capture_file_fingerprints(&workspace, &inventory.files).unwrap(),
                files: inventory.files,
                rollback_only: false,
            },
        );

        let error = rollback_creation_receipt(&state, "partial", &projects, |quarantine| {
            fs::remove_file(quarantine.join("CLAUDE.md"))?;
            Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "injected partial delete",
            ))
        })
        .unwrap_err();
        assert!(error.contains("workspace retained in quarantine"));
        assert!(!workspace.exists());
        let quarantined = state
            .creations
            .lock()
            .unwrap()
            .get("partial")
            .unwrap()
            .workspace
            .clone();
        assert!(quarantined.is_dir());
        assert!(!quarantined.join("CLAUDE.md").exists());
        assert!(finalize_creation_receipt(&state, "partial")
            .unwrap_err()
            .contains("awaiting rollback recovery"));

        fs::write(quarantined.join("unexpected.md"), "not receipt-owned").unwrap();
        let delete_called = Arc::new(AtomicBool::new(false));
        let delete_called_in_retry = delete_called.clone();
        assert!(
            rollback_creation_receipt(&state, "partial", &projects, move |path| {
                delete_called_in_retry.store(true, Ordering::SeqCst);
                fs::remove_dir_all(path)
            })
            .unwrap_err()
            .contains("unexpected or modified file")
        );
        assert!(!delete_called.load(Ordering::SeqCst));
        assert!(state.creations.lock().unwrap().contains_key("partial"));
        assert!(state.completed.lock().unwrap().is_empty());

        fs::remove_file(quarantined.join("unexpected.md")).unwrap();
        let delete_called_in_retry = delete_called.clone();
        rollback_creation_receipt(&state, "partial", &projects, move |path| {
            delete_called_in_retry.store(true, Ordering::SeqCst);
            fs::remove_dir_all(path)
        })
        .unwrap();
        assert!(delete_called.load(Ordering::SeqCst));
        assert!(!quarantined.exists());
        assert!(!state.creations.lock().unwrap().contains_key("partial"));
        assert_eq!(
            completed_outcome(&state.completed.lock().unwrap(), "partial"),
            Some(ReceiptOutcome::RolledBack)
        );
        rollback_creation_receipt_with(
            &state,
            "partial",
            || panic!("completed retry must not resolve filesystem paths"),
            |_| panic!("completed retry must not delete again"),
        )
        .unwrap();
    }

    #[test]
    fn finalize_cannot_race_a_successful_rollback_into_an_ambiguous_outcome() {
        use std::sync::mpsc;
        use std::thread;

        let tmp = tempfile::tempdir().unwrap();
        let projects = tmp.path().join("projects");
        let workspace = projects.join("created-agent");
        fs::create_dir_all(&workspace).unwrap();
        write_valid_workspace(&workspace);
        let projects = projects.canonicalize().unwrap();
        let workspace = workspace.canonicalize().unwrap();
        let inventory = inventory_workspace(&workspace).unwrap();
        let state = AgentHubState::default();
        state.creations.lock().unwrap().insert(
            "race".to_string(),
            PendingCreation {
                workspace,
                fingerprints: capture_file_fingerprints(
                    &projects.join("created-agent"),
                    &inventory.files,
                )
                .unwrap(),
                files: inventory.files,
                rollback_only: false,
            },
        );

        let (delete_started_tx, delete_started_rx) = mpsc::channel();
        let (allow_delete_tx, allow_delete_rx) = mpsc::channel();
        let rollback_state = state.clone();
        let rollback_projects = projects.clone();
        let rollback_thread = thread::spawn(move || {
            rollback_creation_receipt(&rollback_state, "race", &rollback_projects, move |path| {
                delete_started_tx.send(()).unwrap();
                allow_delete_rx.recv().unwrap();
                fs::remove_dir_all(path)
            })
        });
        delete_started_rx
            .recv_timeout(Duration::from_secs(2))
            .unwrap();

        let (finalize_started_tx, finalize_started_rx) = mpsc::channel();
        let (finalize_result_tx, finalize_result_rx) = mpsc::channel();
        let finalize_state = state.clone();
        let finalize_thread = thread::spawn(move || {
            finalize_started_tx.send(()).unwrap();
            finalize_result_tx
                .send(finalize_creation_receipt(&finalize_state, "race"))
                .unwrap();
        });
        finalize_started_rx
            .recv_timeout(Duration::from_secs(2))
            .unwrap();
        assert!(matches!(
            finalize_result_rx.recv_timeout(Duration::from_millis(100)),
            Err(mpsc::RecvTimeoutError::Timeout)
        ));

        allow_delete_tx.send(()).unwrap();
        rollback_thread.join().unwrap().unwrap();
        let finalize_error = finalize_result_rx
            .recv_timeout(Duration::from_secs(2))
            .unwrap()
            .unwrap_err();
        finalize_thread.join().unwrap();
        assert!(finalize_error.contains("already rolled back"));
        assert_eq!(
            completed_outcome(&state.completed.lock().unwrap(), "race"),
            Some(ReceiptOutcome::RolledBack)
        );
    }

    #[test]
    fn completed_receipts_are_outcome_aware_idempotent_and_bounded() {
        let state = AgentHubState::default();
        let pending = || PendingCreation {
            workspace: PathBuf::from("unused"),
            files: Vec::new(),
            fingerprints: HashMap::new(),
            rollback_only: false,
        };
        state
            .creations
            .lock()
            .unwrap()
            .insert("first".to_string(), pending());
        finalize_creation_receipt(&state, "first").unwrap();
        finalize_creation_receipt(&state, "first").unwrap();
        assert!(finalize_creation_receipt(&state, "unknown").is_err());
        let tmp = tempfile::tempdir().unwrap();
        assert!(rollback_creation_receipt(&state, "first", tmp.path(), |_| {
            panic!("opposite outcome must not touch the filesystem")
        })
        .unwrap_err()
        .contains("already finalized"));

        for index in 0..MAX_COMPLETED_RECEIPTS {
            let receipt = format!("receipt-{index}");
            state
                .creations
                .lock()
                .unwrap()
                .insert(receipt.clone(), pending());
            finalize_creation_receipt(&state, &receipt).unwrap();
        }
        assert_eq!(
            state.completed.lock().unwrap().len(),
            MAX_COMPLETED_RECEIPTS
        );
        assert!(finalize_creation_receipt(&state, "first").is_err());
        assert!(finalize_creation_receipt(&state, "receipt-0").is_ok());
    }

    #[test]
    fn internal_error_detail_is_sanitized_bounded_and_never_returned() {
        let private_root = dirs::home_dir().unwrap_or_else(std::env::temp_dir);
        #[cfg(windows)]
        let logged_private_root = private_root
            .to_string_lossy()
            .chars()
            .map(|ch| {
                if ch.is_ascii_lowercase() {
                    ch.to_ascii_uppercase()
                } else if ch.is_ascii_uppercase() {
                    ch.to_ascii_lowercase()
                } else {
                    ch
                }
            })
            .collect::<String>();
        #[cfg(not(windows))]
        let logged_private_root = private_root.to_string_lossy().to_string();
        let detail = format!(
            "{}{}private-workspace\n{}",
            logged_private_root,
            std::path::MAIN_SEPARATOR,
            "x".repeat(MAX_INTERNAL_ERROR_CHARS + 100)
        );
        let sanitized = sanitize_internal_error(&detail);
        assert!(!sanitized.to_ascii_lowercase().contains(
            &private_root
                .to_string_lossy()
                .to_string()
                .to_ascii_lowercase()
        ));
        assert!(!sanitized.contains('\n'));
        assert!(sanitized.chars().count() <= MAX_INTERNAL_ERROR_CHARS + 1);
        assert_eq!(
            public_command_error("test", "generic frontend error", &detail),
            "generic frontend error"
        );
    }
}
