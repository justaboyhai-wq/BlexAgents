use super::backend::{Mem0Backend, MemoryBackend};
use super::index::MemoryIndex;
use super::types::*;
use chrono::{DateTime, Datelike, SecondsFormat, TimeZone, Utc};
use chrono_tz::Tz;
use notify_debouncer_full::{new_debouncer, notify::RecursiveMode};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock as StdRwLock};
use std::time::{Duration, Instant, UNIX_EPOCH};
use tokio::sync::{Mutex, RwLock};

use crate::{ulog_error, ulog_info, ulog_warn};

const MAX_SUMMARY_CHARS: usize = 600;
const MAX_HIGHLIGHTS: usize = 40;
const MAX_RECALL_CONTEXT_CHARS: usize = 1_200;

#[derive(Debug, Clone, Default)]
struct RuntimeStatus {
    backfill_running: bool,
    last_reconciled_at: Option<String>,
    last_error: Option<String>,
    indexed_session_count: usize,
    backend_healthy: bool,
}

pub struct MemoryHub {
    data_dir: PathBuf,
    root: PathBuf,
    write_lock: Mutex<()>,
    reconcile_lock: Mutex<()>,
    config: RwLock<MemoryHubConfig>,
    runtime: RwLock<RuntimeStatus>,
    memory_index: StdRwLock<Option<MemoryIndex>>,
    activity_cache: StdRwLock<HashMap<String, ActivityEvent>>,
    memory_cache: StdRwLock<HashMap<String, MemoryRecord>>,
    artifact_cache: StdRwLock<HashMap<String, ArtifactRecord>>,
    agent_ids_by_workspace: StdRwLock<HashMap<String, String>>,
}

impl MemoryHub {
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        let root = data_dir.join("memory-hub");
        for relative in ["activities", "rollups", "reports", "index", "outbox"] {
            fs::create_dir_all(root.join(relative))
                .map_err(|e| format!("create memory hub {}: {}", relative, e))?;
        }
        let config_path = root.join("config.json");
        let config = fs::read_to_string(&config_path)
            .ok()
            .and_then(|raw| serde_json::from_str::<MemoryHubConfig>(&raw).ok())
            .unwrap_or_default();
        if !config_path.exists() {
            write_json_atomic(&config_path, &config)?;
        }
        let checkpoint_path = root.join("checkpoints.json");
        if !checkpoint_path.exists() {
            write_json_atomic(&checkpoint_path, &MemoryHubCheckpoint::default())?;
        }
        let activity_cache =
            load_activity_cache(&root.join("activities")).unwrap_or_else(|error| {
                ulog_warn!("[memory-hub] activity cache warmup failed: {}", error);
                HashMap::new()
            });
        let memory_cache =
            load_memory_cache(&root.join("memories.jsonl")).unwrap_or_else(|error| {
                ulog_warn!("[memory-hub] memory cache warmup failed: {}", error);
                HashMap::new()
            });
        let artifact_cache =
            load_artifact_cache(&root.join("artifacts.jsonl")).unwrap_or_else(|error| {
                ulog_warn!("[memory-hub] artifact cache warmup failed: {}", error);
                HashMap::new()
            });
        let agent_ids_by_workspace = load_agent_ids_by_workspace(&data_dir);
        let memory_index = match MemoryIndex::new(root.join("index")) {
            Ok(index) => Some(index),
            Err(error) => {
                ulog_warn!(
                    "[memory-hub] Tantivy unavailable; recall will use fallback search: {}",
                    error
                );
                None
            }
        };
        let hub = Self {
            data_dir,
            root,
            write_lock: Mutex::new(()),
            reconcile_lock: Mutex::new(()),
            config: RwLock::new(config),
            runtime: RwLock::new(RuntimeStatus::default()),
            memory_index: StdRwLock::new(memory_index),
            activity_cache: StdRwLock::new(activity_cache),
            memory_cache: StdRwLock::new(memory_cache),
            artifact_cache: StdRwLock::new(artifact_cache),
            agent_ids_by_workspace: StdRwLock::new(agent_ids_by_workspace),
        };
        hub.rebuild_memory_index();
        Ok(hub)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    fn agent_id_for_workspace(
        &self,
        workspace_path: Option<&str>,
        workspace_id: Option<&str>,
    ) -> Option<String> {
        let mapped = workspace_path.and_then(|path| {
            self.agent_ids_by_workspace
                .read()
                .ok()
                .and_then(|agents| agents.get(&stable_workspace_id(path)).cloned())
        });
        // Old installations may not have an agents[] registry yet. Retaining
        // the stable workspace identity keeps those memories isolated and
        // makes the fallback deterministic across restarts.
        mapped.or_else(|| workspace_id.map(str::to_string))
    }

    pub fn start_background(self: &Arc<Self>) {
        let hub = self.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(error) = hub.reconcile(false).await {
                ulog_warn!("[memory-hub] initial reconcile failed: {}", error);
            }
            let mut interval = tokio::time::interval(Duration::from_secs(5 * 60));
            interval.tick().await;
            loop {
                interval.tick().await;
                if let Err(error) = hub.reconcile(false).await {
                    ulog_warn!("[memory-hub] periodic reconcile failed: {}", error);
                }
            }
        });

        self.spawn_source_watcher();
    }

    fn spawn_source_watcher(self: &Arc<Self>) {
        let hub = self.clone();
        let data_dir = self.data_dir.clone();
        let _ = std::thread::Builder::new()
            .name("memory-hub-watcher".to_string())
            .spawn(move || {
                let sessions = data_dir.join("sessions");
                let thoughts = data_dir.join("thoughts");
                let cron_runs = data_dir.join("cron_runs");
                let _ = fs::create_dir_all(&sessions);
                let _ = fs::create_dir_all(&thoughts);
                let _ = fs::create_dir_all(&cron_runs);
                let (tx, rx) = std::sync::mpsc::channel();
                let mut debouncer = match new_debouncer(Duration::from_millis(900), None, tx) {
                    Ok(value) => value,
                    Err(error) => {
                        ulog_error!("[memory-hub] create watcher failed: {}", error);
                        return;
                    }
                };
                for (path, mode) in [
                    (&sessions, RecursiveMode::NonRecursive),
                    (&thoughts, RecursiveMode::Recursive),
                    (&cron_runs, RecursiveMode::NonRecursive),
                    (&data_dir, RecursiveMode::NonRecursive),
                ] {
                    if let Err(error) = debouncer.watch(path, mode) {
                        ulog_warn!("[memory-hub] watch {} failed: {}", path.display(), error);
                    }
                }
                ulog_info!("[memory-hub] source watcher started");
                for result in rx {
                    if result.is_err() {
                        continue;
                    }
                    let hub = hub.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(error) = hub.reconcile(false).await {
                            ulog_warn!("[memory-hub] watcher reconcile failed: {}", error);
                        }
                    });
                }
            });
    }

    pub async fn get_config(&self) -> MemoryHubConfig {
        self.config.read().await.clone()
    }

    pub async fn update_config(&self, next: MemoryHubConfig) -> Result<MemoryHubConfig, String> {
        if next.backend != "local" && next.backend != "mem0" {
            return Err("memory backend must be local or mem0".to_string());
        }
        if !(1..=3650).contains(&next.backfill_days) {
            return Err("backfillDays must be between 1 and 3650".to_string());
        }
        let _write = self.write_lock.lock().await;
        write_json_atomic(&self.root.join("config.json"), &next)?;
        *self.config.write().await = next.clone();
        drop(_write);
        let backend_check = if next.backend == "local" {
            Ok(())
        } else if let Some(base_url) = next
            .mem0_base_url
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            match Mem0Backend::new(base_url) {
                Ok(backend) => backend.health().await,
                Err(error) => Err(error),
            }
        } else {
            Err("Mem0 backend is enabled but no base URL is configured".to_string())
        };
        {
            let mut runtime = self.runtime.write().await;
            runtime.backend_healthy = backend_check.is_ok();
            if next.backend == "local" {
                runtime.last_error = None;
            } else if let Err(error) = backend_check {
                runtime.last_error = Some(error);
            }
        }
        Ok(next)
    }

    pub async fn reconcile(&self, force: bool) -> Result<MemoryHubStatus, String> {
        let _gate = self.reconcile_lock.lock().await;
        let config = self.config.read().await.clone();
        if !config.enabled || !config.capture_enabled {
            return self.status().await;
        }
        {
            let mut runtime = self.runtime.write().await;
            runtime.backfill_running = true;
            runtime.last_error = None;
        }
        let result = self.reconcile_inner(&config, force).await;
        let backend_result = if result.is_ok() {
            self.flush_external_backend(&config).await
        } else {
            Ok(())
        };
        {
            let mut runtime = self.runtime.write().await;
            runtime.backfill_running = false;
            runtime.backend_healthy = config.backend == "local" || backend_result.is_ok();
            match &result {
                Ok(indexed) => {
                    runtime.indexed_session_count = *indexed;
                    runtime.last_reconciled_at = Some(now_iso());
                }
                Err(error) => runtime.last_error = Some(error.clone()),
            }
            if let Err(error) = &backend_result {
                runtime.last_error = Some(error.clone());
            }
        }
        result?;
        self.status().await
    }

    async fn flush_external_backend(&self, config: &MemoryHubConfig) -> Result<(), String> {
        if config.backend != "mem0" {
            return Ok(());
        }
        let base_url = config
            .mem0_base_url
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "Mem0 backend is enabled but no base URL is configured".to_string())?;
        let backend = Mem0Backend::new(base_url)?;
        let sync_path = self.root.join("outbox").join("mem0-synced.json");
        let mut synced: HashMap<String, u64> = fs::read_to_string(&sync_path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default();
        let records = self.load_latest_memories()?;
        if let Err(error) = backend.health().await {
            let pending = records
                .iter()
                .filter(|record| {
                    synced.get(&record.id).copied().unwrap_or_default() < record.revision
                })
                .take(100)
                .map(|record| {
                    json!({
                        "memoryId": record.id,
                        "revision": record.revision,
                        "action": if record.status == MemoryStatus::Active { "upsert" } else { "delete" },
                        "error": error.clone(),
                        "queuedAt": now_iso(),
                    })
                })
                .collect::<Vec<_>>();
            let _write = self.write_lock.lock().await;
            write_json_atomic(
                &self.root.join("outbox").join("mem0-pending.json"),
                &pending,
            )?;
            return Err(error);
        }

        let candidates = records
            .iter()
            .filter(|record| synced.get(&record.id).copied().unwrap_or_default() < record.revision)
            .take(20)
            .cloned()
            .collect::<Vec<_>>();
        let mut pending = Vec::new();
        for record in candidates {
            match backend.upsert(&record).await {
                Ok(()) => {
                    synced.insert(record.id.clone(), record.revision);
                }
                Err(error) => pending.push(json!({
                    "memoryId": record.id,
                    "revision": record.revision,
                    "action": if record.status == MemoryStatus::Active { "upsert" } else { "delete" },
                    "error": error,
                    "queuedAt": now_iso(),
                })),
            }
        }
        let _write = self.write_lock.lock().await;
        write_json_atomic(&sync_path, &synced)?;
        write_json_atomic(
            &self.root.join("outbox").join("mem0-pending.json"),
            &pending,
        )?;
        if pending.is_empty() {
            Ok(())
        } else {
            Err(format!(
                "{} Mem0 operation(s) remain in the local outbox",
                pending.len()
            ))
        }
    }

    async fn reconcile_inner(
        &self,
        config: &MemoryHubConfig,
        force: bool,
    ) -> Result<usize, String> {
        if let Ok(mut agent_ids) = self.agent_ids_by_workspace.write() {
            *agent_ids = load_agent_ids_by_workspace(&self.data_dir);
        }
        let mut checkpoint = self.read_checkpoint();
        let existing_activity_ids = self.load_activity_ids()?;
        let existing_artifact_ids: HashSet<String> = self
            .load_latest_artifacts()?
            .into_iter()
            .filter(|record| !record.deleted)
            .map(|record| record.id)
            .collect();
        let mut activity_batches: BTreeMap<String, Vec<ActivityEvent>> = BTreeMap::new();
        let mut artifact_batch = Vec::new();
        let mut memory_candidates = Vec::new();
        let mut indexed_session_ids = HashSet::new();
        let cutoff_ms =
            Utc::now().timestamp_millis() - i64::from(config.backfill_days) * 24 * 60 * 60 * 1000;

        let sessions_dir = self.data_dir.join("sessions");
        let metadata = self.read_session_metadata()?;
        let authoritative_session_ids: HashSet<String> = metadata
            .iter()
            .filter_map(|session| string_field(session, "id"))
            .filter(|session_id| sessions_dir.join(format!("{}.jsonl", session_id)).exists())
            .collect();
        let mut changed_session_ids = HashSet::new();
        let mut authoritative_message_refs = HashSet::new();
        for session in metadata {
            let Some(session_id) = string_field(&session, "id") else {
                continue;
            };
            let last_active = string_field(&session, "lastActiveAt")
                .and_then(|value| parse_time_ms(&value))
                .unwrap_or_default();
            if last_active < cutoff_ms {
                continue;
            }
            let path = sessions_dir.join(format!("{}.jsonl", session_id));
            if !path.exists() {
                continue;
            }
            let fingerprint = file_fingerprint(&path);
            let key = path.to_string_lossy().to_string();
            if !force
                && checkpoint
                    .source_fingerprints
                    .get(&key)
                    .is_some_and(|known| known == &fingerprint)
            {
                indexed_session_ids.insert(session_id);
                continue;
            }
            changed_session_ids.insert(session_id.clone());
            let workspace_path = string_field(&session, "agentDir");
            let workspace_id = workspace_path.as_deref().map(stable_workspace_id);
            let agent_id =
                self.agent_id_for_workspace(workspace_path.as_deref(), workspace_id.as_deref());
            let title = string_field(&session, "title");
            let messages = read_jsonl_values(&path)?;
            let mut last_user: Option<Value> = None;
            for message in messages {
                match message.get("role").and_then(Value::as_str) {
                    Some("user") => last_user = Some(message),
                    Some("assistant") => {
                        let Some(user) = last_user.take() else {
                            continue;
                        };
                        let user_id =
                            value_to_string(user.get("id")).unwrap_or_else(|| "user".into());
                        let message_id = value_to_string(message.get("id"))
                            .unwrap_or_else(|| stable_id("message", &message.to_string()));
                        authoritative_message_refs.insert(format!("{}:{}", session_id, user_id));
                        authoritative_message_refs.insert(format!("{}:{}", session_id, message_id));
                        let event_id = format!("session:{}:turn:{}", session_id, message_id);
                        let occurred_at = string_field(&message, "timestamp")
                            .or_else(|| string_field(&session, "lastActiveAt"))
                            .unwrap_or_else(now_iso);
                        let occurred_ms = parse_time_ms(&occurred_at).unwrap_or_default();
                        if occurred_ms < cutoff_ms {
                            continue;
                        }
                        let user_text = visible_text_from_content(
                            user.get("content")
                                .and_then(Value::as_str)
                                .unwrap_or_default(),
                        );
                        if is_internal_message(&user_text) {
                            continue;
                        }
                        let assistant_text = visible_text_from_content(
                            message
                                .get("content")
                                .and_then(Value::as_str)
                                .unwrap_or_default(),
                        );
                        let metrics = ActivityMetrics {
                            input_tokens: message
                                .pointer("/usage/inputTokens")
                                .and_then(Value::as_u64)
                                .unwrap_or_default(),
                            output_tokens: message
                                .pointer("/usage/outputTokens")
                                .and_then(Value::as_u64)
                                .unwrap_or_default(),
                            duration_ms: message
                                .get("durationMs")
                                .and_then(Value::as_u64)
                                .unwrap_or_default(),
                            tool_count: message
                                .get("toolCount")
                                .and_then(Value::as_u64)
                                .unwrap_or_default(),
                        };
                        if !existing_activity_ids.contains(&event_id) {
                            let event = ActivityEvent {
                                id: event_id,
                                event_type: "chat.turn.completed".to_string(),
                                occurred_at: occurred_at.clone(),
                                workspace_id: workspace_id.clone(),
                                workspace_path: workspace_path.clone(),
                                agent_id: agent_id.clone(),
                                session_id: Some(session_id.clone()),
                                task_id: None,
                                thought_id: None,
                                message_id: Some(message_id.clone()),
                                title: title.clone(),
                                summary: non_empty(truncate_chars(
                                    &assistant_text,
                                    MAX_SUMMARY_CHARS,
                                )),
                                status: None,
                                source: "session".to_string(),
                                metrics,
                                source_revision: Some(fingerprint.clone()),
                            };
                            activity_batches
                                .entry(month_key(&occurred_at))
                                .or_default()
                                .push(event);
                        }

                        for attachment in collect_artifacts(
                            message.get("content"),
                            &session_id,
                            &message_id,
                            &occurred_at,
                            workspace_id.as_deref(),
                            workspace_path.as_deref(),
                            agent_id.as_deref(),
                        ) {
                            if !existing_artifact_ids.contains(&attachment.id) {
                                let artifact_event = ActivityEvent {
                                    id: format!("artifact:{}:produced", attachment.id),
                                    event_type: "artifact.produced".to_string(),
                                    occurred_at: attachment.created_at.clone(),
                                    workspace_id: attachment.workspace_id.clone(),
                                    workspace_path: attachment.workspace_path.clone(),
                                    agent_id: attachment.agent_id.clone(),
                                    session_id: attachment.session_id.clone(),
                                    task_id: attachment.task_id.clone(),
                                    thought_id: None,
                                    message_id: attachment.message_id.clone(),
                                    title: Some(attachment.title.clone()),
                                    summary: attachment.produced_by.clone(),
                                    status: Some("produced".to_string()),
                                    source: "session".to_string(),
                                    metrics: ActivityMetrics::default(),
                                    source_revision: Some(fingerprint.clone()),
                                };
                                if !existing_activity_ids.contains(&artifact_event.id) {
                                    activity_batches
                                        .entry(month_key(&artifact_event.occurred_at))
                                        .or_default()
                                        .push(artifact_event);
                                }
                                artifact_batch.push(attachment);
                            }
                        }

                        if let Some(candidate) = extract_local_memory(
                            &user_text,
                            &session_id,
                            &user_id,
                            &occurred_at,
                            workspace_id.as_deref(),
                            workspace_path.as_deref(),
                        ) {
                            memory_candidates.push(candidate);
                        }
                        if let Some(candidate) = extract_turn_memory(
                            &user_text,
                            &assistant_text,
                            &session_id,
                            &message_id,
                            &occurred_at,
                            workspace_id.as_deref(),
                            workspace_path.as_deref(),
                        ) {
                            memory_candidates.push(candidate);
                        }
                    }
                    _ => {}
                }
            }
            checkpoint.source_fingerprints.insert(key, fingerprint);
            indexed_session_ids.insert(session_id);
        }

        self.project_tasks(&existing_activity_ids, &mut activity_batches)?;
        self.project_cron_runs(&existing_activity_ids, &mut activity_batches)?;
        self.project_thoughts(&existing_activity_ids, &mut activity_batches)
            .await?;

        let _write = self.write_lock.lock().await;
        for (month, events) in activity_batches {
            append_json_lines(
                &self
                    .root
                    .join("activities")
                    .join(format!("{}.jsonl", month)),
                &events,
            )?;
            self.cache_activity_records(&events);
        }
        append_json_lines(&self.root.join("artifacts.jsonl"), &artifact_batch)?;
        self.cache_artifact_records(&artifact_batch);
        self.merge_memory_candidates(memory_candidates)?;
        self.invalidate_deleted_session_sources(
            &authoritative_session_ids,
            &changed_session_ids,
            &authoritative_message_refs,
        )?;
        self.rebuild_memory_index();
        self.rebuild_rollups()?;

        checkpoint.indexed_session_ids = indexed_session_ids.iter().cloned().collect();
        checkpoint.indexed_session_ids.sort();
        checkpoint.last_reconciled_at = Some(now_iso());
        checkpoint.last_error = None;
        write_json_atomic(&self.root.join("checkpoints.json"), &checkpoint)?;
        Ok(indexed_session_ids.len())
    }

    fn project_tasks(
        &self,
        existing_ids: &HashSet<String>,
        batches: &mut BTreeMap<String, Vec<ActivityEvent>>,
    ) -> Result<(), String> {
        let path = self.data_dir.join("tasks.jsonl");
        if !path.exists() {
            return Ok(());
        }
        let mut latest: HashMap<String, Value> = HashMap::new();
        for row in read_jsonl_values(&path)? {
            if let Some(id) = string_field(&row, "id") {
                latest.insert(id, row);
            }
        }
        for (task_id, task) in latest {
            if task
                .get("deleted")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                continue;
            }
            let name = string_field(&task, "name").unwrap_or_else(|| "Task".to_string());
            let workspace_id = string_field(&task, "workspaceId");
            let workspace_path = string_field(&task, "workspacePath");
            let history = task
                .get("statusHistory")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            if history.is_empty() {
                let at = task
                    .get("createdAt")
                    .and_then(Value::as_i64)
                    .unwrap_or_default();
                let occurred_at = millis_to_iso(at);
                let id = format!("task:{}:created:{}", task_id, at);
                if !existing_ids.contains(&id) {
                    batches
                        .entry(month_key(&occurred_at))
                        .or_default()
                        .push(ActivityEvent {
                            id,
                            event_type: "task.created".to_string(),
                            occurred_at,
                            workspace_id: workspace_id.clone(),
                            workspace_path: workspace_path.clone(),
                            agent_id: None,
                            session_id: None,
                            task_id: Some(task_id.clone()),
                            thought_id: None,
                            message_id: None,
                            title: Some(name.clone()),
                            summary: string_field(&task, "description"),
                            status: string_field(&task, "status"),
                            source: "task".to_string(),
                            metrics: ActivityMetrics::default(),
                            source_revision: Some(file_fingerprint(&path)),
                        });
                }
            }
            for transition in history {
                let at = transition
                    .get("at")
                    .and_then(Value::as_i64)
                    .unwrap_or_default();
                let status = string_field(&transition, "to").unwrap_or_else(|| "todo".to_string());
                let id = format!("task:{}:status:{}:{}", task_id, status, at);
                if existing_ids.contains(&id) {
                    continue;
                }
                let occurred_at = millis_to_iso(at);
                batches
                    .entry(month_key(&occurred_at))
                    .or_default()
                    .push(ActivityEvent {
                        id,
                        event_type: "task.status.changed".to_string(),
                        occurred_at,
                        workspace_id: workspace_id.clone(),
                        workspace_path: workspace_path.clone(),
                        agent_id: None,
                        session_id: None,
                        task_id: Some(task_id.clone()),
                        thought_id: None,
                        message_id: None,
                        title: Some(name.clone()),
                        summary: string_field(&transition, "message"),
                        status: Some(status),
                        source: "task".to_string(),
                        metrics: ActivityMetrics::default(),
                        source_revision: Some(file_fingerprint(&path)),
                    });
            }
        }
        Ok(())
    }

    fn project_cron_runs(
        &self,
        existing_ids: &HashSet<String>,
        batches: &mut BTreeMap<String, Vec<ActivityEvent>>,
    ) -> Result<(), String> {
        let cron_runs_dir = self.data_dir.join("cron_runs");
        let Ok(entries) = fs::read_dir(&cron_runs_dir) else {
            return Ok(());
        };
        let task_metadata = read_cron_task_metadata(&self.data_dir.join("cron_tasks.json"));
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("jsonl") {
                continue;
            }
            let Some(task_id) = path
                .file_stem()
                .and_then(|value| value.to_str())
                .map(str::to_string)
            else {
                continue;
            };
            let metadata = task_metadata.get(&task_id);
            let workspace_path = metadata.and_then(|value| string_field(value, "workspacePath"));
            let workspace_id = workspace_path.as_deref().map(stable_workspace_id);
            let agent_id =
                self.agent_id_for_workspace(workspace_path.as_deref(), workspace_id.as_deref());
            let title = metadata
                .and_then(|value| string_field(value, "name"))
                .or_else(|| metadata.and_then(|value| string_field(value, "prompt")))
                .map(|value| truncate_chars(&value, 100))
                .unwrap_or_else(|| "定时任务".to_string());
            for row in read_jsonl_values(&path)? {
                let timestamp = row.get("ts").and_then(Value::as_i64).unwrap_or_default();
                if timestamp <= 0 {
                    continue;
                }
                let event_id = format!(
                    "cron:{}:run:{}:{}",
                    task_id,
                    timestamp,
                    stable_id("result", &row.to_string())
                );
                if existing_ids.contains(&event_id) {
                    continue;
                }
                let occurred_at = millis_to_iso(timestamp);
                let ok = row.get("ok").and_then(Value::as_bool).unwrap_or(false);
                let summary = string_field(&row, if ok { "content" } else { "error" })
                    .map(|value| truncate_chars(&value, MAX_SUMMARY_CHARS));
                batches
                    .entry(month_key(&occurred_at))
                    .or_default()
                    .push(ActivityEvent {
                        id: event_id,
                        event_type: "cron.run.completed".to_string(),
                        occurred_at,
                        workspace_id: workspace_id.clone(),
                        workspace_path: workspace_path.clone(),
                        agent_id: agent_id.clone(),
                        session_id: metadata.and_then(|value| string_field(value, "sessionId")),
                        task_id: Some(task_id.clone()),
                        thought_id: None,
                        message_id: None,
                        title: Some(title.clone()),
                        summary,
                        status: Some(if ok { "success" } else { "failed" }.to_string()),
                        source: "cron".to_string(),
                        metrics: ActivityMetrics {
                            duration_ms: row
                                .get("durationMs")
                                .and_then(Value::as_u64)
                                .unwrap_or_default(),
                            ..Default::default()
                        },
                        source_revision: Some(file_fingerprint(&path)),
                    });
            }
        }
        Ok(())
    }

    async fn project_thoughts(
        &self,
        existing_ids: &HashSet<String>,
        batches: &mut BTreeMap<String, Vec<ActivityEvent>>,
    ) -> Result<(), String> {
        let Some(store) = crate::thought::get_thought_store() else {
            return Ok(());
        };
        let thoughts = store
            .list(crate::thought::ThoughtListFilter {
                archived: Some(crate::thought::ThoughtArchiveFilter::All),
                ..Default::default()
            })
            .await;
        for thought in thoughts {
            let id = format!("thought:{}:created:{}", thought.id, thought.created_at);
            let occurred_at = millis_to_iso(thought.created_at);
            if !existing_ids.contains(&id) {
                batches
                    .entry(month_key(&occurred_at))
                    .or_default()
                    .push(ActivityEvent {
                        id,
                        event_type: "thought.created".to_string(),
                        occurred_at: occurred_at.clone(),
                        workspace_id: None,
                        workspace_path: None,
                        agent_id: None,
                        session_id: None,
                        task_id: None,
                        thought_id: Some(thought.id.clone()),
                        message_id: None,
                        title: Some("想法".to_string()),
                        summary: Some(truncate_chars(&thought.content, MAX_SUMMARY_CHARS)),
                        status: if thought.archived {
                            Some("archived".into())
                        } else {
                            None
                        },
                        source: "thought".to_string(),
                        metrics: ActivityMetrics::default(),
                        source_revision: Some(thought.updated_at.to_string()),
                    });
            }
            for task_id in &thought.converted_task_ids {
                let converted_id = format!(
                    "thought:{}:converted:{}:{}",
                    thought.id, task_id, thought.updated_at
                );
                if existing_ids.contains(&converted_id) {
                    continue;
                }
                batches
                    .entry(month_key(&occurred_at))
                    .or_default()
                    .push(ActivityEvent {
                        id: converted_id,
                        event_type: "thought.converted".to_string(),
                        occurred_at: occurred_at.clone(),
                        workspace_id: None,
                        workspace_path: None,
                        agent_id: None,
                        session_id: None,
                        task_id: Some(task_id.clone()),
                        thought_id: Some(thought.id.clone()),
                        message_id: None,
                        title: Some("想法转任务".to_string()),
                        summary: Some(truncate_chars(&thought.content, MAX_SUMMARY_CHARS)),
                        status: Some("converted".to_string()),
                        source: "thought".to_string(),
                        metrics: ActivityMetrics::default(),
                        source_revision: Some(thought.updated_at.to_string()),
                    });
            }
        }
        Ok(())
    }

    fn merge_memory_candidates(&self, candidates: Vec<MemoryRecord>) -> Result<(), String> {
        if candidates.is_empty() {
            return Ok(());
        }
        let latest = self.load_latest_memories()?;
        let mut by_key: HashMap<String, MemoryRecord> = latest
            .into_iter()
            .filter(|record| record.status != MemoryStatus::Deleted)
            .map(|record| (record.canonical_key.clone(), record))
            .collect();
        let mut revisions = Vec::new();
        for candidate in candidates {
            if let Some(existing) = by_key.get_mut(&candidate.canonical_key) {
                let mut changed = false;
                for source in candidate.source_refs {
                    if !existing
                        .source_refs
                        .iter()
                        .any(|known| known.id == source.id)
                    {
                        existing.source_refs.push(source);
                        changed = true;
                    }
                }
                if changed {
                    existing.revision += 1;
                    existing.updated_at = now_iso();
                    revisions.push(existing.clone());
                }
            } else {
                by_key.insert(candidate.canonical_key.clone(), candidate.clone());
                revisions.push(candidate);
            }
        }
        append_json_lines(&self.root.join("memories.jsonl"), &revisions)?;
        self.cache_memory_records(&revisions);
        Ok(())
    }

    fn invalidate_deleted_session_sources(
        &self,
        authoritative_session_ids: &HashSet<String>,
        changed_session_ids: &HashSet<String>,
        authoritative_message_refs: &HashSet<String>,
    ) -> Result<(), String> {
        let mut memory_revisions = Vec::new();
        for mut record in self.load_latest_memories()? {
            if record.status == MemoryStatus::Deleted || record.source_refs.is_empty() {
                continue;
            }
            let before = record.source_refs.len();
            record.source_refs.retain(|source| {
                source.session_id.as_ref().map_or(true, |session_id| {
                    authoritative_session_ids.contains(session_id)
                        && (!changed_session_ids.contains(session_id)
                            || source.source_type == "manual"
                            || authoritative_message_refs.contains(&source.id))
                })
            });
            if record.source_refs.len() == before {
                continue;
            }
            record.revision += 1;
            record.updated_at = now_iso();
            if record.source_refs.is_empty() && record.extractor.as_deref() != Some("manual") {
                record.status = MemoryStatus::Deleted;
                record.valid_to = Some(record.updated_at.clone());
            }
            memory_revisions.push(record);
        }
        append_json_lines(&self.root.join("memories.jsonl"), &memory_revisions)?;
        self.cache_memory_records(&memory_revisions);

        let mut artifact_revisions = Vec::new();
        for mut record in self.load_latest_artifacts()? {
            let deleted = record.session_id.as_ref().is_some_and(|session_id| {
                !authoritative_session_ids.contains(session_id)
                    || (changed_session_ids.contains(session_id)
                        && record.message_id.as_ref().is_some_and(|message_id| {
                            !authoritative_message_refs
                                .contains(&format!("{}:{}", session_id, message_id))
                        }))
            });
            if deleted != record.deleted {
                record.deleted = deleted;
                artifact_revisions.push(record);
            }
        }
        append_json_lines(&self.root.join("artifacts.jsonl"), &artifact_revisions)?;
        self.cache_artifact_records(&artifact_revisions);
        Ok(())
    }

    fn read_session_metadata(&self) -> Result<Vec<Value>, String> {
        let path = self.data_dir.join("sessions.json");
        if !path.exists() {
            return Ok(Vec::new());
        }
        let raw =
            fs::read_to_string(&path).map_err(|e| format!("read {}: {}", path.display(), e))?;
        let value: Value = serde_json::from_str(raw.trim_start_matches('\u{feff}'))
            .map_err(|e| format!("parse {}: {}", path.display(), e))?;
        Ok(value.as_array().cloned().unwrap_or_default())
    }

    fn read_checkpoint(&self) -> MemoryHubCheckpoint {
        fs::read_to_string(self.root.join("checkpoints.json"))
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    fn load_activity_ids(&self) -> Result<HashSet<String>, String> {
        Ok(self
            .load_all_activities()?
            .into_iter()
            .map(|event| event.id)
            .collect())
    }

    fn load_all_activities(&self) -> Result<Vec<ActivityEvent>, String> {
        self.activity_cache
            .read()
            .map(|cache| cache.values().cloned().collect())
            .map_err(|error| format!("activity cache lock poisoned: {error}"))
    }

    fn load_latest_memories(&self) -> Result<Vec<MemoryRecord>, String> {
        self.memory_cache
            .read()
            .map(|cache| cache.values().cloned().collect())
            .map_err(|error| format!("memory cache lock poisoned: {error}"))
    }

    fn load_latest_artifacts(&self) -> Result<Vec<ArtifactRecord>, String> {
        let mut records = self
            .artifact_cache
            .read()
            .map(|cache| cache.values().cloned().collect::<Vec<_>>())
            .map_err(|error| format!("artifact cache lock poisoned: {error}"))?;
        for record in &mut records {
            record.missing = record
                .source_path
                .as_deref()
                .or(record.saved_path.as_deref())
                .is_some_and(|path| !Path::new(path).exists());
        }
        Ok(records)
    }

    fn cache_activity_records(&self, records: &[ActivityEvent]) {
        if let Ok(mut cache) = self.activity_cache.write() {
            for record in records {
                cache.insert(record.id.clone(), record.clone());
            }
        }
    }

    fn cache_memory_records(&self, records: &[MemoryRecord]) {
        if let Ok(mut cache) = self.memory_cache.write() {
            for record in records {
                if cache
                    .get(&record.id)
                    .map_or(true, |known| record.revision >= known.revision)
                {
                    cache.insert(record.id.clone(), record.clone());
                }
            }
        }
    }

    fn cache_artifact_records(&self, records: &[ArtifactRecord]) {
        if let Ok(mut cache) = self.artifact_cache.write() {
            for record in records {
                cache.insert(record.id.clone(), record.clone());
            }
        }
    }

    fn rebuild_memory_index(&self) {
        let Ok(records) = self.load_latest_memories() else {
            return;
        };
        let Ok(mut index) = self.memory_index.write() else {
            ulog_warn!("[memory-hub] memory index lock poisoned; using fallback search");
            return;
        };
        if index.is_none() {
            match MemoryIndex::new(self.root.join("index")) {
                Ok(new_index) => *index = Some(new_index),
                Err(error) => {
                    ulog_warn!("[memory-hub] memory index recovery failed: {}", error);
                    return;
                }
            }
        }
        if let Some(current) = index.as_ref() {
            if let Err(error) = current.rebuild(&records) {
                ulog_warn!(
                    "[memory-hub] memory index rebuild failed; using fallback search: {}",
                    error
                );
                *index = None;
            }
        }
    }

    pub async fn search(&self, input: MemorySearchInput) -> Result<MemorySearchResult, String> {
        let started = Instant::now();
        let config = self.config.read().await.clone();
        if !config.enabled || !config.recall_enabled {
            return Ok(MemorySearchResult {
                records: Vec::new(),
                context: String::new(),
                elapsed_ms: 0,
            });
        }
        let workspace_id = input
            .workspace_id
            .clone()
            .or_else(|| input.workspace_path.as_deref().map(stable_workspace_id));
        let agent_id = input.agent_id.clone().or_else(|| {
            self.agent_id_for_workspace(input.workspace_path.as_deref(), workspace_id.as_deref())
        });
        let query = input.query.trim().to_lowercase();
        let index_scores = if query.is_empty() || input.include_deleted {
            None
        } else {
            match self.memory_index.read() {
                Ok(index) => index.as_ref().and_then(|index| {
                    match index.search_scores(
                        &query,
                        input
                            .limit
                            .unwrap_or(8)
                            .saturating_mul(50)
                            .clamp(200, 5_000),
                    ) {
                        Ok(scores) => Some(scores),
                        Err(error) => {
                            ulog_warn!(
                                "[memory-hub] index search failed, using fallback: {}",
                                error
                            );
                            None
                        }
                    }
                }),
                Err(_) => None,
            }
        };
        let mut scored = self
            .load_latest_memories()?
            .into_iter()
            .filter(|record| {
                (input.include_deleted || record.status == MemoryStatus::Active)
                    && scope_visible(
                        record,
                        workspace_id.as_deref(),
                        agent_id.as_deref(),
                        &config,
                    )
                    && index_scores
                        .as_ref()
                        .map_or(true, |scores| scores.contains_key(&record.id))
            })
            .map(|record| {
                let score = memory_score(&record, &query)
                    + index_scores
                        .as_ref()
                        .and_then(|scores| scores.get(&record.id))
                        .copied()
                        .unwrap_or_default() as f64;
                (score, record)
            })
            .filter(|(score, _)| query.is_empty() || index_scores.is_some() || *score > 0.0)
            .collect::<Vec<_>>();
        scored.sort_by(|left, right| {
            right
                .0
                .partial_cmp(&left.0)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| right.1.updated_at.cmp(&left.1.updated_at))
        });
        let mut records = Vec::new();
        let mut context_chars = 0usize;
        for (_, record) in scored {
            if records.len() >= input.limit.unwrap_or(8).clamp(1, 50) {
                break;
            }
            let next_chars = record.summary.chars().count();
            if !records.is_empty() && context_chars + next_chars > MAX_RECALL_CONTEXT_CHARS {
                continue;
            }
            context_chars += next_chars;
            records.push(record);
        }
        let context = records
            .iter()
            .enumerate()
            .map(|(index, record)| {
                format!(
                    "{}. [{}|{}] {} (memoryId={})",
                    index + 1,
                    memory_scope_label(&record.scope),
                    memory_kind_label(record.kind),
                    record.summary,
                    record.id
                )
            })
            .collect::<Vec<_>>()
            .join("\n");
        Ok(MemorySearchResult {
            records,
            context,
            elapsed_ms: started.elapsed().as_millis() as u64,
        })
    }

    pub async fn list_memories(&self, input: MemoryListInput) -> Result<MemoryListResult, String> {
        let query = input.query.unwrap_or_default().trim().to_lowercase();
        let mut records = self
            .load_latest_memories()?
            .into_iter()
            .filter(|record| {
                input.kind.map_or(true, |kind| record.kind == kind)
                    && input.status.map_or(true, |status| record.status == status)
                    && input.workspace_id.as_deref().map_or(true, |id| {
                        record.scope.kind != MemoryScopeKind::Workspace
                            || record.scope.id.as_deref() == Some(id)
                    })
                    && input.agent_id.as_deref().map_or(true, |id| {
                        record.scope.kind != MemoryScopeKind::Agent
                            || record.scope.id.as_deref() == Some(id)
                    })
                    && (query.is_empty()
                        || record.summary.to_lowercase().contains(&query)
                        || record
                            .tags
                            .iter()
                            .any(|tag| tag.to_lowercase().contains(&query)))
            })
            .collect::<Vec<_>>();
        records.sort_by(|left, right| {
            right
                .pinned
                .cmp(&left.pinned)
                .then_with(|| right.updated_at.cmp(&left.updated_at))
        });
        let total = records.len();
        let offset = input.offset.unwrap_or(0);
        let limit = input.limit.unwrap_or(100).clamp(1, 500);
        let records = records.into_iter().skip(offset).take(limit).collect();
        Ok(MemoryListResult { records, total })
    }

    pub async fn create_memory(&self, input: MemoryCreateInput) -> Result<MemoryRecord, String> {
        let summary = sanitize_summary(&input.summary)?;
        let now = now_iso();
        let canonical_key = stable_id(
            "memory-key",
            &format!(
                "{:?}:{}:{}",
                input.scope.kind,
                input.scope.id.as_deref().unwrap_or(""),
                normalize_text(&summary)
            ),
        );
        let record = MemoryRecord {
            id: uuid::Uuid::new_v4().to_string(),
            kind: input.kind.unwrap_or(MemoryKind::Fact),
            canonical_key,
            scope: validate_scope(input.scope)?,
            summary,
            tags: normalize_tags(input.tags),
            importance: input.importance.unwrap_or(0.7).clamp(0.0, 1.0),
            confidence: input.confidence.unwrap_or(1.0).clamp(0.0, 1.0),
            valid_from: now.clone(),
            valid_to: None,
            status: MemoryStatus::Active,
            source_refs: input.source_refs,
            pinned: false,
            created_at: now.clone(),
            updated_at: now,
            revision: 1,
            extractor: Some("manual".to_string()),
        };
        let _write = self.write_lock.lock().await;
        append_json_lines(
            &self.root.join("memories.jsonl"),
            std::slice::from_ref(&record),
        )?;
        self.cache_memory_records(std::slice::from_ref(&record));
        self.rebuild_memory_index();
        Ok(record)
    }

    pub async fn update_memory(&self, input: MemoryUpdateInput) -> Result<MemoryRecord, String> {
        let mut record = self
            .load_latest_memories()?
            .into_iter()
            .find(|record| record.id == input.id)
            .ok_or_else(|| "memory not found".to_string())?;
        if let Some(summary) = input.summary {
            record.summary = sanitize_summary(&summary)?;
        }
        if let Some(kind) = input.kind {
            record.kind = kind;
        }
        if let Some(tags) = input.tags {
            record.tags = normalize_tags(tags);
        }
        if let Some(importance) = input.importance {
            record.importance = importance.clamp(0.0, 1.0);
        }
        if let Some(confidence) = input.confidence {
            record.confidence = confidence.clamp(0.0, 1.0);
        }
        if let Some(scope) = input.scope {
            record.scope = validate_scope(scope)?;
        }
        if let Some(pinned) = input.pinned {
            record.pinned = pinned;
        }
        record.revision += 1;
        record.updated_at = now_iso();
        record.extractor = Some("manual".to_string());
        let _write = self.write_lock.lock().await;
        append_json_lines(
            &self.root.join("memories.jsonl"),
            std::slice::from_ref(&record),
        )?;
        self.cache_memory_records(std::slice::from_ref(&record));
        self.rebuild_memory_index();
        Ok(record)
    }

    pub async fn delete_memory(&self, id: &str) -> Result<MemoryRecord, String> {
        let mut record = self
            .load_latest_memories()?
            .into_iter()
            .find(|record| record.id == id)
            .ok_or_else(|| "memory not found".to_string())?;
        record.status = MemoryStatus::Deleted;
        record.valid_to = Some(now_iso());
        record.updated_at = now_iso();
        record.revision += 1;
        let _write = self.write_lock.lock().await;
        append_json_lines(
            &self.root.join("memories.jsonl"),
            std::slice::from_ref(&record),
        )?;
        self.cache_memory_records(std::slice::from_ref(&record));
        self.rebuild_memory_index();
        Ok(record)
    }

    pub async fn pin_artifact(&self, input: ArtifactPinInput) -> Result<ArtifactRecord, String> {
        let mut record = self
            .load_latest_artifacts()?
            .into_iter()
            .find(|record| record.id == input.id)
            .ok_or_else(|| "artifact not found".to_string())?;
        record.pinned = input.pinned;
        let _write = self.write_lock.lock().await;
        append_json_lines(
            &self.root.join("artifacts.jsonl"),
            std::slice::from_ref(&record),
        )?;
        self.cache_artifact_records(std::slice::from_ref(&record));
        Ok(record)
    }

    pub async fn insights(&self, query: InsightsQuery) -> Result<InsightsResult, String> {
        let from_ms =
            parse_time_ms(&query.from).ok_or_else(|| "invalid from timestamp".to_string())?;
        let to_ms = parse_time_ms(&query.to).ok_or_else(|| "invalid to timestamp".to_string())?;
        if from_ms >= to_ms {
            return Err("from must be before to".to_string());
        }
        let timezone: Tz = query.timezone.parse().unwrap_or(chrono_tz::UTC);
        let workspace_filter = query.workspace_ids.clone().unwrap_or_default();
        let agent_filter = query.agent_ids.clone().unwrap_or_default();
        let live_session_ids: HashSet<String> = self
            .read_session_metadata()?
            .iter()
            .filter_map(|session| string_field(session, "id"))
            .collect();
        let live_task_ids = current_task_ids(&self.data_dir.join("tasks.jsonl"))?;
        let matches_scope = |workspace: Option<&str>, agent: Option<&str>| {
            (workspace_filter.is_empty()
                || workspace.is_some_and(|id| workspace_filter.iter().any(|value| value == id)))
                && (agent_filter.is_empty()
                    || agent.is_some_and(|id| agent_filter.iter().any(|value| value == id)))
        };
        let mut metrics = InsightsMetrics::default();
        let mut days: BTreeMap<String, InsightsDayPoint> = BTreeMap::new();
        let mut highlights = Vec::new();
        let mut workspaces = HashSet::new();
        let mut revision_digest = Sha256::new();
        revision_digest.update(query.timezone.as_bytes());
        revision_digest.update(
            serde_json::to_vec(&workspace_filter)
                .unwrap_or_default()
                .as_slice(),
        );
        revision_digest.update(
            serde_json::to_vec(&agent_filter)
                .unwrap_or_default()
                .as_slice(),
        );
        let activity_cache = self
            .activity_cache
            .read()
            .map_err(|error| format!("activity cache lock poisoned: {error}"))?;
        for event in activity_cache.values() {
            if (event.source == "session"
                && event
                    .session_id
                    .as_ref()
                    .is_some_and(|id| !live_session_ids.contains(id)))
                || (event.source == "task"
                    && event
                        .task_id
                        .as_ref()
                        .is_some_and(|id| !live_task_ids.contains(id)))
            {
                continue;
            }
            let Some(at_ms) = parse_time_ms(&event.occurred_at) else {
                continue;
            };
            if at_ms < from_ms
                || at_ms >= to_ms
                || !matches_scope(event.workspace_id.as_deref(), event.agent_id.as_deref())
            {
                continue;
            }
            revision_digest.update(event.id.as_bytes());
            revision_digest.update(event.source_revision.as_deref().unwrap_or("").as_bytes());
            let date = Utc
                .timestamp_millis_opt(at_ms)
                .single()
                .unwrap_or_else(Utc::now)
                .with_timezone(&timezone)
                .date_naive()
                .to_string();
            let day = days
                .entry(date.clone())
                .or_insert_with(|| InsightsDayPoint {
                    date,
                    ..Default::default()
                });
            metrics.input_tokens += event.metrics.input_tokens;
            metrics.output_tokens += event.metrics.output_tokens;
            metrics.duration_ms += event.metrics.duration_ms;
            metrics.tool_count += event.metrics.tool_count;
            day.input_tokens += event.metrics.input_tokens;
            day.output_tokens += event.metrics.output_tokens;
            if let Some(workspace) = &event.workspace_id {
                workspaces.insert(workspace.clone());
            }
            match event.event_type.as_str() {
                "chat.turn.completed" => {
                    metrics.conversation_count += 1;
                    day.conversations += 1;
                    if event.summary.is_some() && highlights.len() < MAX_HIGHLIGHTS {
                        highlights.push(event.clone());
                    }
                }
                "task.status.changed" => match event.status.as_deref() {
                    Some("done") => {
                        metrics.completed_task_count += 1;
                        day.completed_tasks += 1;
                    }
                    Some("blocked") => metrics.blocked_task_count += 1,
                    Some("running") | Some("verifying") | Some("todo") => {
                        metrics.active_task_count += 1
                    }
                    _ => {}
                },
                _ => {}
            }
        }
        drop(activity_cache);

        let artifact_cache = self
            .artifact_cache
            .read()
            .map_err(|error| format!("artifact cache lock poisoned: {error}"))?;
        let mut artifacts = artifact_cache
            .values()
            .filter(|record| {
                !record.deleted
                    && parse_time_ms(&record.created_at)
                        .is_some_and(|at| at >= from_ms && at < to_ms)
                    && matches_scope(record.workspace_id.as_deref(), record.agent_id.as_deref())
            })
            .cloned()
            .collect::<Vec<_>>();
        drop(artifact_cache);
        artifacts.sort_by(|left, right| right.created_at.cmp(&left.created_at));
        metrics.artifact_count = artifacts.len() as u64;
        metrics.active_workspace_count = workspaces.len() as u64;
        for artifact in &artifacts {
            revision_digest.update(artifact.id.as_bytes());
            revision_digest.update(artifact.created_at.as_bytes());
            if let Some(at_ms) = parse_time_ms(&artifact.created_at) {
                let date = Utc
                    .timestamp_millis_opt(at_ms)
                    .single()
                    .unwrap_or_else(Utc::now)
                    .with_timezone(&timezone)
                    .date_naive()
                    .to_string();
                let day = days
                    .entry(date.clone())
                    .or_insert_with(|| InsightsDayPoint {
                        date,
                        ..Default::default()
                    });
                day.artifacts += 1;
            }
        }

        let tasks = current_task_items(
            &self.data_dir.join("tasks.jsonl"),
            from_ms,
            to_ms,
            &workspace_filter,
        )?;
        for task in &tasks {
            revision_digest.update(task.id.as_bytes());
            revision_digest.update(task.status.as_bytes());
            revision_digest.update(task.updated_at.as_bytes());
        }
        highlights.sort_by(|left, right| right.occurred_at.cmp(&left.occurred_at));
        let revision_seed = format!("{}:{}:{:x}", from_ms, to_ms, revision_digest.finalize());
        Ok(InsightsResult {
            query,
            metrics,
            timeline: days.into_values().collect(),
            tasks,
            artifacts,
            highlights,
            data_revision: stable_id("insights", &revision_seed),
            generated_at: now_iso(),
        })
    }

    pub async fn generate_report(&self, query: InsightsQuery) -> Result<Value, String> {
        let insights = self.insights(query).await?;
        let cache_path = self
            .root
            .join("reports")
            .join(format!("{}.json", insights.data_revision));
        if let Ok(raw) = fs::read_to_string(&cache_path) {
            if let Ok(cached) = serde_json::from_str::<Value>(&raw) {
                return Ok(cached);
            }
        }
        let summary = format!(
            "本周期共完成 {} 个任务，沉淀 {} 个产出物，完成 {} 轮对话，使用 {} 次工具。{}",
            insights.metrics.completed_task_count,
            insights.metrics.artifact_count,
            insights.metrics.conversation_count,
            insights.metrics.tool_count,
            if insights.metrics.blocked_task_count > 0 {
                format!(
                    "当前有 {} 条阻塞记录需要关注。",
                    insights.metrics.blocked_task_count
                )
            } else {
                "当前没有新增阻塞记录。".to_string()
            }
        );
        let sources = insights
            .highlights
            .iter()
            .take(5)
            .map(|event| {
                json!({
                    "type": "session",
                    "id": event.id,
                    "title": event.title,
                    "sessionId": event.session_id,
                    "workspacePath": event.workspace_path,
                })
            })
            .chain(insights.tasks.iter().take(5).map(|task| {
                json!({
                    "type": "task",
                    "id": task.id,
                    "title": task.name,
                    "taskId": task.id,
                    "workspacePath": task.workspace_path,
                })
            }))
            .chain(insights.artifacts.iter().take(5).map(|artifact| {
                json!({
                    "type": "artifact",
                    "id": artifact.id,
                    "title": artifact.title,
                    "sessionId": artifact.session_id,
                    "workspacePath": artifact.workspace_path,
                    "path": artifact.source_path.as_ref().or(artifact.saved_path.as_ref()),
                })
            }))
            .collect::<Vec<_>>();
        let payload = json!({
            "summary": summary,
            "dataRevision": insights.data_revision,
            "generatedAt": now_iso(),
            "source": "local-deterministic",
            "sources": sources,
        });
        let _write = self.write_lock.lock().await;
        write_json_atomic(&cache_path, &payload)?;
        Ok(payload)
    }

    pub async fn status(&self) -> Result<MemoryHubStatus, String> {
        let runtime = self.runtime.read().await.clone();
        let config = self.config.read().await.clone();
        Ok(MemoryHubStatus {
            root_dir: self.root.display().to_string(),
            config: config.clone(),
            activity_count: self.load_all_activities()?.len(),
            memory_count: self
                .load_latest_memories()?
                .into_iter()
                .filter(|record| record.status == MemoryStatus::Active)
                .count(),
            artifact_count: self
                .load_latest_artifacts()?
                .into_iter()
                .filter(|record| !record.deleted)
                .count(),
            pending_extraction_count: 0,
            indexed_session_count: runtime.indexed_session_count,
            backfill_running: runtime.backfill_running,
            last_reconciled_at: runtime.last_reconciled_at,
            last_error: runtime.last_error,
            backend_healthy: config.backend == "local" || runtime.backend_healthy,
        })
    }

    pub async fn clear(&self) -> Result<(), String> {
        let _gate = self.reconcile_lock.lock().await;
        let _write = self.write_lock.lock().await;
        for relative in ["activities", "rollups", "reports", "outbox"] {
            let dir = self.root.join(relative);
            if dir.exists() {
                fs::remove_dir_all(&dir).map_err(|e| format!("clear {}: {}", dir.display(), e))?;
            }
            fs::create_dir_all(&dir).map_err(|e| format!("recreate {}: {}", dir.display(), e))?;
        }
        for file in ["memories.jsonl", "artifacts.jsonl"] {
            let path = self.root.join(file);
            if path.exists() {
                fs::remove_file(&path).map_err(|e| format!("remove {}: {}", path.display(), e))?;
            }
        }
        write_json_atomic(
            &self.root.join("checkpoints.json"),
            &MemoryHubCheckpoint::default(),
        )?;
        if let Ok(mut cache) = self.activity_cache.write() {
            cache.clear();
        }
        if let Ok(mut cache) = self.memory_cache.write() {
            cache.clear();
        }
        if let Ok(mut cache) = self.artifact_cache.write() {
            cache.clear();
        }
        self.rebuild_memory_index();
        *self.runtime.write().await = RuntimeStatus::default();
        Ok(())
    }

    pub async fn export(&self, destination_path: &str) -> Result<String, String> {
        let destination = crate::commands::validate_file_path(destination_path)?;
        let payload = json!({
            "schemaVersion": 1,
            "generatedAt": now_iso(),
            "config": self.config.read().await.clone(),
            "activities": self.load_all_activities()?,
            "memories": self.load_latest_memories()?,
            "artifacts": self.load_latest_artifacts()?,
        });
        let bytes = serde_json::to_vec_pretty(&payload)
            .map_err(|error| format!("serialize MemoryHub export: {error}"))?;
        crate::workspace_files::path_safety::atomic_write_file(&destination, &bytes)?;
        Ok(destination.display().to_string())
    }

    fn rebuild_rollups(&self) -> Result<(), String> {
        let mut rollups: BTreeMap<String, InsightsDayPoint> = BTreeMap::new();
        for event in self.load_all_activities()? {
            let date = event
                .occurred_at
                .get(0..10)
                .unwrap_or("unknown")
                .to_string();
            let day = rollups
                .entry(date.clone())
                .or_insert_with(|| InsightsDayPoint {
                    date,
                    ..Default::default()
                });
            day.input_tokens += event.metrics.input_tokens;
            day.output_tokens += event.metrics.output_tokens;
            if event.event_type == "chat.turn.completed" {
                day.conversations += 1;
            }
            if event.event_type == "task.status.changed" && event.status.as_deref() == Some("done")
            {
                day.completed_tasks += 1;
            }
        }
        for artifact in self.load_latest_artifacts()? {
            if artifact.deleted {
                continue;
            }
            let date = artifact
                .created_at
                .get(0..10)
                .unwrap_or("unknown")
                .to_string();
            let day = rollups
                .entry(date.clone())
                .or_insert_with(|| InsightsDayPoint {
                    date,
                    ..Default::default()
                });
            day.artifacts += 1;
        }
        for (date, rollup) in rollups {
            write_json_atomic(
                &self.root.join("rollups").join(format!("{}.json", date)),
                &rollup,
            )?;
        }
        Ok(())
    }
}

fn current_task_items(
    path: &Path,
    from_ms: i64,
    to_ms: i64,
    workspace_filter: &[String],
) -> Result<Vec<InsightsTaskItem>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let mut latest = HashMap::new();
    for row in read_jsonl_values(path)? {
        if let Some(id) = string_field(&row, "id") {
            latest.insert(id, row);
        }
    }
    let mut tasks = latest
        .into_iter()
        .filter_map(|(id, value)| {
            if value
                .get("deleted")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                return None;
            }
            let updated = value
                .get("updatedAt")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            let workspace_id = string_field(&value, "workspaceId");
            if updated < from_ms
                || updated >= to_ms
                || (!workspace_filter.is_empty()
                    && !workspace_id
                        .as_ref()
                        .is_some_and(|id| workspace_filter.contains(id)))
            {
                return None;
            }
            Some(InsightsTaskItem {
                id,
                name: string_field(&value, "name").unwrap_or_else(|| "Task".to_string()),
                status: string_field(&value, "status").unwrap_or_else(|| "todo".to_string()),
                workspace_id,
                workspace_path: string_field(&value, "workspacePath"),
                updated_at: millis_to_iso(updated),
            })
        })
        .collect::<Vec<_>>();
    tasks.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(tasks)
}

fn current_task_ids(path: &Path) -> Result<HashSet<String>, String> {
    if !path.exists() {
        return Ok(HashSet::new());
    }
    let mut latest = HashMap::new();
    for row in read_jsonl_values(path)? {
        if let Some(id) = string_field(&row, "id") {
            latest.insert(id, row);
        }
    }
    Ok(latest
        .into_iter()
        .filter(|(_, value)| {
            !value
                .get("deleted")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .map(|(id, _)| id)
        .collect())
}

fn read_cron_task_metadata(path: &Path) -> HashMap<String, Value> {
    let Ok(raw) = fs::read_to_string(path) else {
        return HashMap::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(raw.trim_start_matches('\u{feff}')) else {
        return HashMap::new();
    };
    value
        .get("tasks")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|task| string_field(task, "id").map(|id| (id, task.clone())))
        .collect()
}

fn collect_artifacts(
    content: Option<&Value>,
    session_id: &str,
    message_id: &str,
    created_at: &str,
    workspace_id: Option<&str>,
    workspace_path: Option<&str>,
    agent_id: Option<&str>,
) -> Vec<ArtifactRecord> {
    let Some(raw) = content.and_then(Value::as_str) else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(raw) else {
        return Vec::new();
    };
    let mut objects = Vec::new();
    collect_attachment_objects(&value, &mut objects);
    objects
        .into_iter()
        .enumerate()
        .filter(|(_, object)| {
            object
                .get("presentation")
                .and_then(Value::as_str)
                .unwrap_or("artifact")
                != "process"
        })
        .map(|(index, object)| {
            let kind = string_field(object, "kind").unwrap_or_else(|| "file".to_string());
            let mime_type = string_field(object, "mimeType")
                .unwrap_or_else(|| "application/octet-stream".to_string());
            let ref_path = string_field(object, "refPath");
            let saved_path = string_field(object, "savedPath");
            let source_path = string_field(object, "sourcePath");
            let produced_by = string_field(object, "producedBy");
            let title = string_field(object, "caption")
                .map(|value| truncate_chars(&value, 100))
                .or_else(|| {
                    source_path
                        .as_deref()
                        .or(saved_path.as_deref())
                        .and_then(file_name)
                })
                .or_else(|| produced_by.clone())
                .unwrap_or_else(|| format!("{} 产出物", kind));
            let identity = ref_path
                .as_deref()
                .or(saved_path.as_deref())
                .or(source_path.as_deref())
                .unwrap_or(&title);
            ArtifactRecord {
                id: stable_id(
                    "artifact",
                    &format!("{}:{}:{}:{}", session_id, message_id, index, identity),
                ),
                kind,
                mime_type,
                title,
                ref_path,
                saved_path: saved_path.clone(),
                source_path: source_path.clone(),
                size_bytes: object.get("sizeBytes").and_then(Value::as_u64),
                produced_by,
                workspace_id: workspace_id.map(str::to_string),
                workspace_path: workspace_path.map(str::to_string),
                agent_id: agent_id.map(str::to_string),
                session_id: Some(session_id.to_string()),
                task_id: None,
                message_id: Some(message_id.to_string()),
                created_at: created_at.to_string(),
                pinned: false,
                missing: source_path
                    .as_deref()
                    .or(saved_path.as_deref())
                    .is_some_and(|path| !Path::new(path).exists()),
                deleted: false,
            }
        })
        .collect()
}

fn collect_attachment_objects<'a>(value: &'a Value, output: &mut Vec<&'a Value>) {
    match value {
        Value::Array(values) => {
            for value in values {
                collect_attachment_objects(value, output);
            }
        }
        Value::Object(map) => {
            if map.contains_key("kind")
                && map.contains_key("mimeType")
                && map.contains_key("refPath")
            {
                output.push(value);
            }
            for value in map.values() {
                collect_attachment_objects(value, output);
            }
        }
        _ => {}
    }
}

fn extract_local_memory(
    text: &str,
    session_id: &str,
    message_id: &str,
    occurred_at: &str,
    workspace_id: Option<&str>,
    workspace_path: Option<&str>,
) -> Option<MemoryRecord> {
    let summary = text.trim();
    if summary.chars().count() < 4
        || summary.chars().count() > MAX_SUMMARY_CHARS
        || contains_sensitive_material(summary)
    {
        return None;
    }
    let (kind, user_scope) = if contains_any(
        summary,
        &["我喜欢", "我偏好", "我习惯", "以后请", "不要再", "请一直"],
    ) {
        (MemoryKind::Preference, true)
    } else if contains_any(summary, &["请记住", "记住", "我的名字", "我是", "我住在"])
    {
        (MemoryKind::Fact, true)
    } else if contains_any(summary, &["我的目标", "我想要", "我计划", "我要在"]) {
        (MemoryKind::Goal, false)
    } else if contains_any(summary, &["决定", "确定采用", "以后就", "最终选择"]) {
        (MemoryKind::Decision, false)
    } else if contains_any(summary, &["每次都", "工作流程", "步骤是", "固定流程"]) {
        (MemoryKind::Procedure, false)
    } else {
        return None;
    };
    let scope = if user_scope {
        MemoryScope {
            kind: MemoryScopeKind::User,
            id: None,
        }
    } else {
        MemoryScope {
            kind: MemoryScopeKind::Workspace,
            id: workspace_id.map(str::to_string),
        }
    };
    let normalized = normalize_text(summary);
    let canonical_key = stable_id(
        "memory-key",
        &format!(
            "{:?}:{}:{}",
            scope.kind,
            scope.id.as_deref().unwrap_or(""),
            normalized
        ),
    );
    let now = now_iso();
    Some(MemoryRecord {
        id: stable_id("memory", &canonical_key),
        kind,
        canonical_key,
        scope,
        summary: truncate_chars(summary, MAX_SUMMARY_CHARS),
        tags: Vec::new(),
        importance: 0.65,
        confidence: 0.72,
        valid_from: occurred_at.to_string(),
        valid_to: None,
        status: MemoryStatus::Active,
        source_refs: vec![MemorySourceRef {
            source_type: "session_message".to_string(),
            id: format!("{}:{}", session_id, message_id),
            session_id: Some(session_id.to_string()),
            message_id: Some(message_id.to_string()),
            task_id: None,
            path: workspace_path.map(str::to_string),
            revision: None,
        }],
        pinned: false,
        created_at: now.clone(),
        updated_at: now,
        revision: 1,
        extractor: Some("local_rules".to_string()),
    })
}

fn extract_turn_memory(
    user_text: &str,
    assistant_text: &str,
    session_id: &str,
    message_id: &str,
    occurred_at: &str,
    workspace_id: Option<&str>,
    workspace_path: Option<&str>,
) -> Option<MemoryRecord> {
    let user_text = user_text.trim();
    let assistant_text = assistant_text.trim();
    if user_text.chars().count() < 2
        || assistant_text.chars().count() < 2
        || contains_sensitive_material(user_text)
        || contains_sensitive_material(assistant_text)
    {
        return None;
    }
    let summary = truncate_chars(
        &format!(
            "用户关注：{}\n本轮结论：{}",
            truncate_chars(user_text, 220),
            truncate_chars(assistant_text, 360)
        ),
        MAX_SUMMARY_CHARS,
    );
    let scope = workspace_id.map_or(
        MemoryScope {
            kind: MemoryScopeKind::User,
            id: None,
        },
        |id| MemoryScope {
            kind: MemoryScopeKind::Workspace,
            id: Some(id.to_string()),
        },
    );
    let canonical_key = stable_id("memory-key", &format!("turn:{}:{}", session_id, message_id));
    let now = now_iso();
    Some(MemoryRecord {
        id: stable_id("memory", &canonical_key),
        kind: MemoryKind::ProjectState,
        canonical_key,
        scope,
        summary,
        tags: vec!["conversation".to_string()],
        importance: 0.35,
        confidence: 0.58,
        valid_from: occurred_at.to_string(),
        valid_to: None,
        status: MemoryStatus::Active,
        source_refs: vec![MemorySourceRef {
            source_type: "session_turn".to_string(),
            id: format!("{}:{}", session_id, message_id),
            session_id: Some(session_id.to_string()),
            message_id: Some(message_id.to_string()),
            task_id: None,
            path: workspace_path.map(str::to_string),
            revision: None,
        }],
        pinned: false,
        created_at: now.clone(),
        updated_at: now,
        revision: 1,
        extractor: Some("turn_projection".to_string()),
    })
}

fn scope_visible(
    record: &MemoryRecord,
    workspace_id: Option<&str>,
    agent_id: Option<&str>,
    config: &MemoryHubConfig,
) -> bool {
    match record.scope.kind {
        MemoryScopeKind::User => config.user_scope_enabled,
        MemoryScopeKind::Workspace => {
            config.workspace_scope_enabled
                && workspace_id.is_some()
                && record.scope.id.as_deref() == workspace_id
        }
        MemoryScopeKind::Agent => {
            config.agent_scope_enabled
                && agent_id.is_some()
                && record.scope.id.as_deref() == agent_id
        }
    }
}

fn memory_score(record: &MemoryRecord, query: &str) -> f64 {
    let haystack = format!("{} {}", record.summary, record.tags.join(" ")).to_lowercase();
    let mut score = record.importance * 2.0 + record.confidence;
    if record.pinned {
        score += 4.0;
    }
    if let Some(updated_ms) = parse_time_ms(&record.updated_at) {
        let age_days = (Utc::now().timestamp_millis() - updated_ms).max(0) as f64 / 86_400_000.0;
        score += 1.5 / (1.0 + age_days / 30.0);
    }
    let source_types = record
        .source_refs
        .iter()
        .map(|source| source.source_type.as_str())
        .collect::<HashSet<_>>()
        .len();
    score += (source_types.min(4) as f64) * 0.15;
    if query.is_empty() {
        return score;
    }
    if haystack.contains(query) {
        score += 10.0;
    }
    for token in search_tokens(query) {
        if haystack.contains(&token) {
            score += if token.chars().count() >= 2 {
                2.0
            } else {
                0.25
            };
        }
    }
    if score <= 3.0 {
        0.0
    } else {
        score
    }
}

fn search_tokens(query: &str) -> Vec<String> {
    let mut output = HashSet::new();
    for word in query.split_whitespace() {
        if !word.is_empty() {
            output.insert(word.to_string());
        }
    }
    let chars: Vec<char> = query
        .chars()
        .filter(|value| !value.is_whitespace())
        .collect();
    for window in chars.windows(2) {
        output.insert(window.iter().collect());
    }
    output.into_iter().collect()
}

fn memory_scope_label(scope: &MemoryScope) -> &'static str {
    match scope.kind {
        MemoryScopeKind::User => "用户",
        MemoryScopeKind::Workspace => "工作区",
        MemoryScopeKind::Agent => "智能体",
    }
}

fn memory_kind_label(kind: MemoryKind) -> &'static str {
    match kind {
        MemoryKind::Preference => "偏好",
        MemoryKind::Fact => "事实",
        MemoryKind::Decision => "决策",
        MemoryKind::Goal => "目标",
        MemoryKind::Procedure => "流程",
        MemoryKind::ProjectState => "项目状态",
    }
}

fn validate_scope(scope: MemoryScope) -> Result<MemoryScope, String> {
    match scope.kind {
        MemoryScopeKind::User => Ok(MemoryScope {
            kind: scope.kind,
            id: None,
        }),
        MemoryScopeKind::Workspace | MemoryScopeKind::Agent => {
            if scope.id.as_deref().map_or(true, str::is_empty) {
                Err("workspace/agent scope requires id".to_string())
            } else {
                Ok(scope)
            }
        }
    }
}

fn sanitize_summary(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("memory summary is required".to_string());
    }
    if trimmed.chars().count() > 4_000 {
        return Err("memory summary exceeds 4000 characters".to_string());
    }
    Ok(trimmed.to_string())
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    tags.into_iter()
        .map(|tag| tag.trim().to_string())
        .filter(|tag| !tag.is_empty() && tag.chars().count() <= 64)
        .filter(|tag| seen.insert(tag.to_lowercase()))
        .take(32)
        .collect()
}

fn visible_text_from_content(raw: &str) -> String {
    let visible = strip_leading_system_reminder(raw);
    let Ok(value) = serde_json::from_str::<Value>(&visible) else {
        return visible.trim().to_string();
    };
    match value {
        Value::Array(values) => values
            .iter()
            .filter(|value| value.get("type").and_then(Value::as_str) == Some("text"))
            .filter_map(|value| value.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string(),
        Value::String(value) => value,
        _ => visible.trim().to_string(),
    }
}

fn strip_leading_system_reminder(value: &str) -> String {
    let trimmed = value.trim_start();
    if !trimmed.starts_with("<system-reminder>") {
        return value.to_string();
    }
    let Some(index) = trimmed.find("</system-reminder>") else {
        return String::new();
    };
    trimmed[index + "</system-reminder>".len()..]
        .trim_start()
        .to_string()
}

fn is_internal_message(value: &str) -> bool {
    let trimmed = value.trim();
    trimmed.is_empty()
        || trimmed.starts_with("[System]")
        || trimmed.contains("<MEMORY_UPDATE>")
        || trimmed.contains("<HEARTBEAT>")
        || trimmed.contains("<CRON_TASK>")
}

fn load_activity_cache(dir: &Path) -> Result<HashMap<String, ActivityEvent>, String> {
    let mut cache = HashMap::new();
    let Ok(entries) = fs::read_dir(dir) else {
        return Ok(cache);
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("jsonl") {
            continue;
        }
        for record in read_jsonl::<ActivityEvent>(&path)? {
            cache.insert(record.id.clone(), record);
        }
    }
    Ok(cache)
}

fn load_memory_cache(path: &Path) -> Result<HashMap<String, MemoryRecord>, String> {
    let mut cache = HashMap::new();
    for record in read_jsonl::<MemoryRecord>(path)? {
        if cache.get(&record.id).map_or(true, |known: &MemoryRecord| {
            record.revision >= known.revision
        }) {
            cache.insert(record.id.clone(), record);
        }
    }
    Ok(cache)
}

fn load_artifact_cache(path: &Path) -> Result<HashMap<String, ArtifactRecord>, String> {
    let mut cache = HashMap::new();
    for record in read_jsonl::<ArtifactRecord>(path)? {
        cache.insert(record.id.clone(), record);
    }
    Ok(cache)
}

fn read_jsonl_values(path: &Path) -> Result<Vec<Value>, String> {
    read_jsonl(path)
}

fn read_jsonl<T: serde::de::DeserializeOwned>(path: &Path) -> Result<Vec<T>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let file = fs::File::open(path).map_err(|e| format!("open {}: {}", path.display(), e))?;
    let mut values = Vec::new();
    for (index, line) in BufReader::new(file).lines().enumerate() {
        let line =
            line.map_err(|e| format!("read {} line {}: {}", path.display(), index + 1, e))?;
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<T>(line.trim_start_matches('\u{feff}')) {
            Ok(value) => values.push(value),
            Err(error) => ulog_warn!(
                "[memory-hub] skip malformed {} line {}: {}",
                path.display(),
                index + 1,
                error
            ),
        }
    }
    Ok(values)
}

fn append_json_lines<T: serde::Serialize>(path: &Path, records: &[T]) -> Result<(), String> {
    if records.is_empty() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create {}: {}", parent.display(), e))?;
    }
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| format!("open {}: {}", path.display(), e))?;
    for record in records {
        serde_json::to_writer(&mut file, record)
            .map_err(|e| format!("serialize {}: {}", path.display(), e))?;
        file.write_all(b"\n")
            .map_err(|e| format!("write {}: {}", path.display(), e))?;
    }
    file.flush()
        .map_err(|e| format!("flush {}: {}", path.display(), e))?;
    file.sync_all()
        .map_err(|e| format!("sync {}: {}", path.display(), e))?;
    Ok(())
}

fn write_json_atomic<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|e| format!("serialize {}: {}", path.display(), e))?;
    crate::workspace_files::path_safety::atomic_write_file(path, &bytes)
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value_to_string(value.get(key))
}

fn value_to_string(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(value) => Some(value.clone()),
        Value::Number(value) => Some(value.to_string()),
        _ => None,
    }
}

fn stable_workspace_id(path: &str) -> String {
    stable_id(
        "workspace",
        &path.replace('\\', "/").trim_end_matches('/').to_lowercase(),
    )
}

fn load_agent_ids_by_workspace(data_dir: &Path) -> HashMap<String, String> {
    let Ok(raw) = fs::read_to_string(data_dir.join("config.json")) else {
        return HashMap::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(raw.trim_start_matches('\u{feff}')) else {
        return HashMap::new();
    };
    value
        .get("agents")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|agent| {
            let id = string_field(agent, "id")?;
            let workspace_path = string_field(agent, "workspacePath")?;
            Some((stable_workspace_id(&workspace_path), id))
        })
        .collect()
}

fn stable_id(namespace: &str, value: &str) -> String {
    let mut digest = Sha256::new();
    digest.update(namespace.as_bytes());
    digest.update(b"\0");
    digest.update(value.as_bytes());
    let output = digest.finalize();
    format!("{}-{:x}", namespace, output)[..namespace.len() + 1 + 24].to_string()
}

fn file_fingerprint(path: &Path) -> String {
    let metadata = fs::metadata(path).ok();
    let size = metadata
        .as_ref()
        .map(|value| value.len())
        .unwrap_or_default();
    let modified = metadata
        .and_then(|value| value.modified().ok())
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis())
        .unwrap_or_default();
    format!("{}:{}", size, modified)
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn millis_to_iso(value: i64) -> String {
    Utc.timestamp_millis_opt(value)
        .single()
        .unwrap_or_else(Utc::now)
        .to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn parse_time_ms(value: &str) -> Option<i64> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|date| date.timestamp_millis())
        .or_else(|| value.parse::<i64>().ok())
}

fn month_key(value: &str) -> String {
    DateTime::parse_from_rfc3339(value)
        .map(|date| format!("{:04}-{:02}", date.year(), date.month()))
        .unwrap_or_else(|_| Utc::now().format("%Y-%m").to_string())
}

fn normalize_text(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn truncate_chars(value: &str, max: usize) -> String {
    let mut chars = value.chars();
    let head: String = chars.by_ref().take(max).collect();
    if chars.next().is_some() {
        format!("{}…", head)
    } else {
        head
    }
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

fn contains_sensitive_material(value: &str) -> bool {
    let lower = value.to_lowercase();
    if [
        "api_key",
        "apikey",
        "access_token",
        "refresh_token",
        "authorization: bearer",
        "password",
        "client_secret",
        "private_key",
        "密钥",
        "密码",
        "令牌",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
    {
        return true;
    }
    value.lines().any(|line| {
        let Some((name, secret)) = line.split_once('=') else {
            return false;
        };
        let name = name.trim();
        !secret.trim().is_empty()
            && name.len() >= 3
            && name.chars().all(|character| {
                character.is_ascii_uppercase() || character == '_' || character.is_ascii_digit()
            })
    }) || lower
        .split_whitespace()
        .any(|token| token.starts_with("sk-") && token.len() >= 12)
}

fn non_empty(value: String) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value)
    }
}

fn file_name(path: &str) -> Option<String> {
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn test_hub() -> (TempDir, MemoryHub) {
        let temp = tempfile::tempdir().expect("tempdir");
        let hub = MemoryHub::new(temp.path().to_path_buf()).expect("memory hub");
        (temp, hub)
    }

    fn write_test_session(root: &Path, session_id: &str, with_artifact: bool) {
        fs::create_dir_all(root.join("sessions")).expect("sessions directory");
        let now = now_iso();
        write_json_atomic(
            &root.join("sessions.json"),
            &json!([{
                "id": session_id,
                "title": "Memory test",
                "agentDir": "E:/workspace/alpha",
                "lastActiveAt": now.clone(),
            }]),
        )
        .expect("sessions metadata");
        let assistant_content = if with_artifact {
            json!([
                { "type": "text", "text": "已完成，并生成文件。" },
                { "type": "tool_use", "tool": { "attachments": [{
                    "kind": "file",
                    "mimeType": "text/plain",
                    "refPath": format!("/api/attachment/tool/{session_id}/m2/result.txt"),
                    "presentation": "artifact"
                }]}}
            ])
            .to_string()
        } else {
            "已完成这个决定。".to_string()
        };
        append_json_lines(
            &root.join("sessions").join(format!("{session_id}.jsonl")),
            &[
                json!({
                    "id": "m1",
                    "role": "user",
                    "timestamp": now,
                    "content": "请记住我喜欢简短回答"
                }),
                json!({
                    "id": "m2",
                    "role": "assistant",
                    "timestamp": now,
                    "content": assistant_content,
                    "usage": { "inputTokens": 12, "outputTokens": 8 },
                    "durationMs": 250,
                    "toolCount": if with_artifact { 1 } else { 0 }
                }),
            ],
        )
        .expect("session jsonl");
    }

    #[test]
    fn strips_hidden_system_reminder_before_extracting_text() {
        let value =
            "<system-reminder><MEMORY_CONTEXT>secret</MEMORY_CONTEXT></system-reminder>用户问题";
        assert_eq!(visible_text_from_content(value), "用户问题");
    }

    #[test]
    fn process_attachments_are_not_artifacts() {
        let content = json!([{ "type": "tool_use", "tool": { "attachments": [
            { "kind": "image", "mimeType": "image/png", "refPath": "/a", "presentation": "process" },
            { "kind": "file", "mimeType": "text/plain", "refPath": "/b", "presentation": "artifact" }
        ]}}]).to_string();
        let wrapped = Value::String(content);
        let records = collect_artifacts(
            Some(&wrapped),
            "s",
            "m",
            "2026-07-22T00:00:00Z",
            None,
            None,
            None,
        );
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].kind, "file");
    }

    #[test]
    fn local_extraction_is_conservative() {
        assert!(extract_local_memory(
            "今天天气不错",
            "s",
            "m",
            "2026-07-22T00:00:00Z",
            Some("w"),
            None,
        )
        .is_none());
        let record = extract_local_memory(
            "请记住我喜欢简短回答",
            "s",
            "m",
            "2026-07-22T00:00:00Z",
            Some("w"),
            Some("E:/workspace/w"),
        )
        .unwrap();
        assert_eq!(record.kind, MemoryKind::Preference);
        assert_eq!(record.scope.kind, MemoryScopeKind::User);
        assert!(extract_local_memory(
            "请记住 API_KEY=super-secret-value",
            "s",
            "m",
            "2026-07-22T00:00:00Z",
            Some("w"),
            None,
        )
        .is_none());
    }

    #[test]
    fn every_completed_turn_has_a_traceable_episode_memory() {
        let record = extract_turn_memory(
            "帮我规划记忆中台",
            "建议采用本地优先的活动账本与分层记忆。",
            "session-1",
            "message-2",
            "2026-07-22T00:00:00Z",
            Some("workspace-1"),
            Some("E:/workspace/one"),
        )
        .expect("completed turns should become episodic memory");
        assert_eq!(record.kind, MemoryKind::ProjectState);
        assert_eq!(record.scope.id.as_deref(), Some("workspace-1"));
        assert_eq!(
            record.source_refs[0].path.as_deref(),
            Some("E:/workspace/one")
        );
        assert_eq!(
            record.source_refs[0].session_id.as_deref(),
            Some("session-1")
        );
    }

    #[tokio::test]
    async fn repeated_reconcile_is_idempotent() {
        let (_temp, hub) = test_hub();
        write_test_session(&hub.data_dir, "session-1", false);
        hub.reconcile(true).await.expect("first reconcile");
        let first_activity_count = hub.load_all_activities().unwrap().len();
        let first_memory_count = hub.load_latest_memories().unwrap().len();
        hub.reconcile(true).await.expect("second reconcile");
        assert_eq!(
            hub.load_all_activities().unwrap().len(),
            first_activity_count
        );
        assert_eq!(
            hub.load_latest_memories().unwrap().len(),
            first_memory_count
        );
    }

    #[tokio::test]
    async fn recall_never_crosses_workspace_scope() {
        let (_temp, hub) = test_hub();
        for (workspace, summary) in [
            ("workspace-a", "甲项目使用蓝色主题"),
            ("workspace-b", "乙项目使用红色主题"),
        ] {
            hub.create_memory(MemoryCreateInput {
                summary: summary.to_string(),
                kind: Some(MemoryKind::Decision),
                scope: MemoryScope {
                    kind: MemoryScopeKind::Workspace,
                    id: Some(workspace.to_string()),
                },
                tags: vec!["主题".to_string()],
                importance: None,
                confidence: None,
                source_refs: Vec::new(),
            })
            .await
            .unwrap();
        }
        let result = hub
            .search(MemorySearchInput {
                query: "主题".to_string(),
                workspace_id: Some("workspace-a".to_string()),
                limit: Some(10),
                ..Default::default()
            })
            .await
            .unwrap();
        assert_eq!(result.records.len(), 1);
        assert!(result.records[0].summary.contains('甲'));
    }

    #[tokio::test]
    async fn deleting_source_invalidates_derived_memory_and_artifact() {
        let (_temp, hub) = test_hub();
        write_test_session(&hub.data_dir, "session-delete", true);
        hub.reconcile(true).await.expect("initial reconcile");
        assert!(hub
            .load_latest_memories()
            .unwrap()
            .iter()
            .any(|record| record.status == MemoryStatus::Active));
        assert!(hub
            .load_latest_artifacts()
            .unwrap()
            .iter()
            .any(|record| !record.deleted));

        write_json_atomic(&hub.data_dir.join("sessions.json"), &json!([]))
            .expect("delete session metadata");
        hub.reconcile(true).await.expect("deletion reconcile");
        assert!(hub
            .load_latest_memories()
            .unwrap()
            .iter()
            .all(|record| record.status == MemoryStatus::Deleted));
        assert!(hub
            .load_latest_artifacts()
            .unwrap()
            .iter()
            .all(|record| record.deleted));
    }

    #[tokio::test]
    async fn insights_group_events_on_shanghai_day_boundaries() {
        let (_temp, hub) = test_hub();
        let event = ActivityEvent {
            id: "event-shanghai".to_string(),
            event_type: "chat.turn.completed".to_string(),
            occurred_at: "2026-07-21T16:30:00Z".to_string(),
            workspace_id: Some("workspace-a".to_string()),
            workspace_path: None,
            agent_id: Some("agent-a".to_string()),
            session_id: None,
            task_id: None,
            thought_id: None,
            message_id: None,
            title: None,
            summary: Some("跨日事件".to_string()),
            status: None,
            source: "manual".to_string(),
            metrics: ActivityMetrics::default(),
            source_revision: None,
        };
        append_json_lines(
            &hub.root.join("activities").join("2026-07.jsonl"),
            std::slice::from_ref(&event),
        )
        .unwrap();
        hub.cache_activity_records(std::slice::from_ref(&event));
        let result = hub
            .insights(InsightsQuery {
                from: "2026-07-21T16:00:00Z".to_string(),
                to: "2026-07-22T16:00:00Z".to_string(),
                timezone: "Asia/Shanghai".to_string(),
                workspace_ids: None,
                agent_ids: None,
            })
            .await
            .unwrap();
        assert_eq!(result.timeline.len(), 1);
        assert_eq!(result.timeline[0].date, "2026-07-22");
    }

    #[tokio::test]
    async fn restart_resumes_without_duplicating_projected_data() {
        let temp = tempfile::tempdir().expect("tempdir");
        let hub = MemoryHub::new(temp.path().to_path_buf()).expect("first memory hub");
        write_test_session(&hub.data_dir, "session-restart", false);
        hub.reconcile(true).await.expect("first reconcile");
        let activity_count = hub.load_all_activities().unwrap().len();
        let memory_count = hub.load_latest_memories().unwrap().len();
        drop(hub);

        let restarted = MemoryHub::new(temp.path().to_path_buf()).expect("restarted memory hub");
        restarted.reconcile(false).await.expect("restart reconcile");
        assert_eq!(
            restarted.load_all_activities().unwrap().len(),
            activity_count
        );
        assert_eq!(
            restarted.load_latest_memories().unwrap().len(),
            memory_count
        );
    }

    #[tokio::test]
    async fn rewinding_a_session_invalidates_removed_turn_derivatives() {
        let (_temp, hub) = test_hub();
        write_test_session(&hub.data_dir, "session-rewind", true);
        hub.reconcile(true).await.expect("initial reconcile");

        let session_path = hub.data_dir.join("sessions").join("session-rewind.jsonl");
        fs::remove_file(&session_path).expect("remove old transcript");
        append_json_lines(
            &session_path,
            &[json!({
                "id": "m1",
                "role": "user",
                "timestamp": now_iso(),
                "content": "请记住我喜欢简短回答"
            })],
        )
        .expect("write rewound transcript");
        hub.reconcile(true).await.expect("rewind reconcile");

        assert!(hub
            .load_latest_memories()
            .unwrap()
            .iter()
            .filter(|record| record.extractor.as_deref() == Some("turn_projection"))
            .all(|record| record.status == MemoryStatus::Deleted));
        assert!(hub
            .load_latest_artifacts()
            .unwrap()
            .iter()
            .all(|record| record.deleted));
    }

    #[tokio::test]
    async fn recall_never_crosses_agent_scope() {
        let (_temp, hub) = test_hub();
        write_json_atomic(
            &hub.data_dir.join("config.json"),
            &json!({ "agents": [{
                "id": "agent-b",
                "name": "B",
                "enabled": true,
                "workspacePath": "E:/workspace/b"
            }] }),
        )
        .expect("agent registry");
        hub.reconcile(true).await.expect("refresh agent registry");
        for (agent, summary) in [
            ("agent-a", "甲助手习惯先给结论"),
            ("agent-b", "乙助手习惯先列证据"),
        ] {
            hub.create_memory(MemoryCreateInput {
                summary: summary.to_string(),
                kind: Some(MemoryKind::Procedure),
                scope: MemoryScope {
                    kind: MemoryScopeKind::Agent,
                    id: Some(agent.to_string()),
                },
                tags: vec!["习惯".to_string()],
                importance: None,
                confidence: None,
                source_refs: Vec::new(),
            })
            .await
            .unwrap();
        }
        let result = hub
            .search(MemorySearchInput {
                query: "习惯".to_string(),
                workspace_path: Some("E:\\workspace\\b".to_string()),
                limit: Some(10),
                ..Default::default()
            })
            .await
            .unwrap();
        assert_eq!(result.records.len(), 1);
        assert!(result.records[0].summary.contains('乙'));
    }

    #[tokio::test]
    async fn unavailable_mem0_never_breaks_local_reconcile() {
        let (_temp, hub) = test_hub();
        let mut config = hub.get_config().await;
        config.backend = "mem0".to_string();
        config.mem0_base_url = Some("http://127.0.0.1:1".to_string());
        hub.update_config(config)
            .await
            .expect("save fallback config");
        write_test_session(&hub.data_dir, "session-offline", false);

        let status = hub
            .reconcile(true)
            .await
            .expect("local reconcile must succeed");
        assert!(!status.backend_healthy);
        assert!(status.memory_count > 0);
        assert!(status.last_error.is_some());
    }

    #[tokio::test]
    async fn corrupt_search_index_is_rebuilt_without_blocking_recall() {
        let temp = tempfile::tempdir().expect("tempdir");
        let index_dir = temp.path().join("memory-hub").join("index");
        fs::create_dir_all(&index_dir).expect("index directory");
        fs::write(index_dir.join("meta.json"), b"not a tantivy index")
            .expect("corrupt index fixture");
        let hub = MemoryHub::new(temp.path().to_path_buf()).expect("recover memory hub");
        hub.create_memory(MemoryCreateInput {
            summary: "项目固定采用蓝色主题".to_string(),
            kind: Some(MemoryKind::Decision),
            scope: MemoryScope {
                kind: MemoryScopeKind::User,
                id: None,
            },
            tags: vec!["主题".to_string()],
            importance: None,
            confidence: None,
            source_refs: Vec::new(),
        })
        .await
        .expect("create memory after recovery");
        let result = hub
            .search(MemorySearchInput {
                query: "蓝色主题".to_string(),
                limit: Some(8),
                ..Default::default()
            })
            .await
            .expect("recall after recovery");
        assert_eq!(result.records.len(), 1);
    }

    #[tokio::test]
    async fn hot_insights_handles_one_hundred_thousand_events() {
        let (_temp, hub) = test_hub();
        {
            let mut cache = hub.activity_cache.write().expect("activity cache");
            for index in 0..100_000_u32 {
                cache.insert(
                    format!("event-{index}"),
                    ActivityEvent {
                        id: format!("event-{index}"),
                        event_type: "chat.turn.completed".to_string(),
                        occurred_at: "2026-07-22T01:00:00Z".to_string(),
                        workspace_id: Some("workspace-a".to_string()),
                        workspace_path: None,
                        agent_id: Some("agent-a".to_string()),
                        session_id: None,
                        task_id: None,
                        thought_id: None,
                        message_id: None,
                        title: None,
                        summary: None,
                        status: None,
                        source: "benchmark".to_string(),
                        metrics: ActivityMetrics::default(),
                        source_revision: None,
                    },
                );
            }
        }
        let started = Instant::now();
        let result = hub
            .insights(InsightsQuery {
                from: "2026-07-22T00:00:00Z".to_string(),
                to: "2026-07-23T00:00:00Z".to_string(),
                timezone: "Asia/Shanghai".to_string(),
                workspace_ids: None,
                agent_ids: None,
            })
            .await
            .unwrap();
        assert_eq!(result.metrics.conversation_count, 100_000);
        assert!(
            started.elapsed() < Duration::from_secs(1),
            "hot insights took {:?}",
            started.elapsed()
        );
    }
}
