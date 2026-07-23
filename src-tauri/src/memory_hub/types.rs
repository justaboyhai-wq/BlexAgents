use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MemoryScopeKind {
    User,
    Workspace,
    Agent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryScope {
    pub kind: MemoryScopeKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryKind {
    Preference,
    Fact,
    Decision,
    Goal,
    Procedure,
    ProjectState,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MemoryStatus {
    Active,
    Superseded,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySourceRef {
    #[serde(rename = "type")]
    pub source_type: String,
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRecord {
    pub id: String,
    pub kind: MemoryKind,
    pub canonical_key: String,
    pub scope: MemoryScope,
    pub summary: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub importance: f64,
    pub confidence: f64,
    pub valid_from: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub valid_to: Option<String>,
    pub status: MemoryStatus,
    #[serde(default)]
    pub source_refs: Vec<MemorySourceRef>,
    #[serde(default)]
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
    pub revision: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extractor: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityMetrics {
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
    #[serde(default)]
    pub duration_ms: u64,
    #[serde(default)]
    pub tool_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEvent {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub occurred_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thought_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    pub source: String,
    #[serde(default)]
    pub metrics: ActivityMetrics,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_revision: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactRecord {
    pub id: String,
    pub kind: String,
    pub mime_type: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ref_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub saved_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub produced_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub missing: bool,
    #[serde(default)]
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryHubConfig {
    pub enabled: bool,
    pub capture_enabled: bool,
    pub recall_enabled: bool,
    pub user_scope_enabled: bool,
    pub workspace_scope_enabled: bool,
    pub agent_scope_enabled: bool,
    pub backend: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mem0_base_url: Option<String>,
    pub backfill_days: u32,
}

impl Default for MemoryHubConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            capture_enabled: true,
            recall_enabled: true,
            user_scope_enabled: true,
            workspace_scope_enabled: true,
            agent_scope_enabled: true,
            backend: "local".to_string(),
            mem0_base_url: None,
            backfill_days: 30,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySearchInput {
    #[serde(default)]
    pub query: String,
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub workspace_path: Option<String>,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub limit: Option<usize>,
    #[serde(default)]
    pub include_deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySearchResult {
    pub records: Vec<MemoryRecord>,
    pub context: String,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryListInput {
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub kind: Option<MemoryKind>,
    #[serde(default)]
    pub status: Option<MemoryStatus>,
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub limit: Option<usize>,
    #[serde(default)]
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryListResult {
    pub records: Vec<MemoryRecord>,
    pub total: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryUpdateInput {
    pub id: String,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub kind: Option<MemoryKind>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub importance: Option<f64>,
    #[serde(default)]
    pub confidence: Option<f64>,
    #[serde(default)]
    pub scope: Option<MemoryScope>,
    #[serde(default)]
    pub pinned: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightsQuery {
    pub from: String,
    pub to: String,
    pub timezone: String,
    #[serde(default)]
    pub workspace_ids: Option<Vec<String>>,
    #[serde(default)]
    pub agent_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightsMetrics {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub duration_ms: u64,
    pub tool_count: u64,
    pub conversation_count: u64,
    pub completed_task_count: u64,
    pub blocked_task_count: u64,
    pub active_task_count: u64,
    pub artifact_count: u64,
    pub active_workspace_count: u64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightsDayPoint {
    pub date: String,
    pub conversations: u64,
    pub completed_tasks: u64,
    pub artifacts: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightsTaskItem {
    pub id: String,
    pub name: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightsResult {
    pub query: InsightsQuery,
    pub metrics: InsightsMetrics,
    pub timeline: Vec<InsightsDayPoint>,
    pub tasks: Vec<InsightsTaskItem>,
    pub artifacts: Vec<ArtifactRecord>,
    pub highlights: Vec<ActivityEvent>,
    pub data_revision: String,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryHubStatus {
    pub root_dir: String,
    pub config: MemoryHubConfig,
    pub activity_count: usize,
    pub memory_count: usize,
    pub artifact_count: usize,
    pub pending_extraction_count: usize,
    pub indexed_session_count: usize,
    pub backfill_running: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_reconciled_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    pub backend_healthy: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryCreateInput {
    pub summary: String,
    #[serde(default)]
    pub kind: Option<MemoryKind>,
    pub scope: MemoryScope,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub importance: Option<f64>,
    #[serde(default)]
    pub confidence: Option<f64>,
    #[serde(default)]
    pub source_refs: Vec<MemorySourceRef>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactPinInput {
    pub id: String,
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MemoryHubCheckpoint {
    #[serde(default)]
    pub source_fingerprints: std::collections::HashMap<String, String>,
    #[serde(default)]
    pub indexed_session_ids: Vec<String>,
    #[serde(default)]
    pub last_reconciled_at: Option<String>,
    #[serde(default)]
    pub last_error: Option<String>,
}
