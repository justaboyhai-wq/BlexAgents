//! Local-first memory and work-insights projection.
//!
//! Raw Session/Task/Thought files remain authoritative. `MemoryHub` owns a
//! rebuildable activity ledger, derived memories and artifact index under
//! `~/.blexagent/memory-hub/` and is the only writer of those files.

mod backend;
mod index;
mod store;
pub mod types;

use std::sync::{Arc, OnceLock};
use tauri::State;

pub use store::MemoryHub;
pub use types::*;

static GLOBAL_MEMORY_HUB: OnceLock<Arc<MemoryHub>> = OnceLock::new();

pub fn set_global_memory_hub(hub: Arc<MemoryHub>) {
    let _ = GLOBAL_MEMORY_HUB.set(hub);
}

pub fn global_memory_hub() -> Option<&'static Arc<MemoryHub>> {
    GLOBAL_MEMORY_HUB.get()
}

#[tauri::command]
pub async fn cmd_memory_get_config(
    hub: State<'_, Arc<MemoryHub>>,
) -> Result<MemoryHubConfig, String> {
    Ok(hub.get_config().await)
}

#[tauri::command]
pub async fn cmd_memory_update_config(
    hub: State<'_, Arc<MemoryHub>>,
    config: MemoryHubConfig,
) -> Result<MemoryHubConfig, String> {
    hub.update_config(config).await
}

#[tauri::command]
pub async fn cmd_memory_search(
    hub: State<'_, Arc<MemoryHub>>,
    input: MemorySearchInput,
) -> Result<MemorySearchResult, String> {
    hub.search(input).await
}

#[tauri::command]
pub async fn cmd_memory_list(
    hub: State<'_, Arc<MemoryHub>>,
    input: MemoryListInput,
) -> Result<MemoryListResult, String> {
    hub.list_memories(input).await
}

#[tauri::command]
pub async fn cmd_memory_create(
    hub: State<'_, Arc<MemoryHub>>,
    input: MemoryCreateInput,
) -> Result<MemoryRecord, String> {
    hub.create_memory(input).await
}

#[tauri::command]
pub async fn cmd_memory_update(
    hub: State<'_, Arc<MemoryHub>>,
    input: MemoryUpdateInput,
) -> Result<MemoryRecord, String> {
    hub.update_memory(input).await
}

#[tauri::command]
pub async fn cmd_memory_delete(
    hub: State<'_, Arc<MemoryHub>>,
    id: String,
) -> Result<MemoryRecord, String> {
    hub.delete_memory(&id).await
}

#[tauri::command]
pub async fn cmd_memory_pin(
    hub: State<'_, Arc<MemoryHub>>,
    id: String,
    pinned: bool,
) -> Result<MemoryRecord, String> {
    hub.update_memory(MemoryUpdateInput {
        id,
        summary: None,
        kind: None,
        tags: None,
        importance: None,
        confidence: None,
        scope: None,
        pinned: Some(pinned),
    })
    .await
}

#[tauri::command]
pub async fn cmd_memory_status(hub: State<'_, Arc<MemoryHub>>) -> Result<MemoryHubStatus, String> {
    hub.status().await
}

#[tauri::command]
pub async fn cmd_memory_rebuild(hub: State<'_, Arc<MemoryHub>>) -> Result<MemoryHubStatus, String> {
    hub.reconcile(true).await
}

#[tauri::command]
pub async fn cmd_memory_backfill(
    hub: State<'_, Arc<MemoryHub>>,
    days: Option<u32>,
) -> Result<MemoryHubStatus, String> {
    if let Some(days) = days {
        let mut config = hub.get_config().await;
        config.backfill_days = days.clamp(1, 3650);
        hub.update_config(config).await?;
    }
    hub.reconcile(true).await
}

#[tauri::command]
pub async fn cmd_memory_clear(hub: State<'_, Arc<MemoryHub>>) -> Result<(), String> {
    hub.clear().await
}

#[tauri::command]
pub async fn cmd_memory_export(
    hub: State<'_, Arc<MemoryHub>>,
    destination_path: String,
) -> Result<String, String> {
    hub.export(&destination_path).await
}

#[tauri::command]
pub async fn cmd_insights_query(
    hub: State<'_, Arc<MemoryHub>>,
    query: InsightsQuery,
) -> Result<InsightsResult, String> {
    hub.insights(query).await
}

#[tauri::command]
pub async fn cmd_insights_generate_report(
    hub: State<'_, Arc<MemoryHub>>,
    query: InsightsQuery,
) -> Result<serde_json::Value, String> {
    hub.generate_report(query).await
}

#[tauri::command]
pub async fn cmd_artifact_pin(
    hub: State<'_, Arc<MemoryHub>>,
    id: String,
) -> Result<ArtifactRecord, String> {
    hub.pin_artifact(ArtifactPinInput { id, pinned: true })
        .await
}

#[tauri::command]
pub async fn cmd_artifact_unpin(
    hub: State<'_, Arc<MemoryHub>>,
    id: String,
) -> Result<ArtifactRecord, String> {
    hub.pin_artifact(ArtifactPinInput { id, pinned: false })
        .await
}
