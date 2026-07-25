use super::types::{MemoryRecord, MemoryScopeKind, MemoryStatus};
use serde_json::{json, Value};
use std::time::Duration;

#[allow(dead_code, async_fn_in_trait)]
pub(crate) trait MemoryBackend {
    async fn health(&self) -> Result<(), String>;
    async fn search(&self, query: &str, record: &MemoryRecord) -> Result<Value, String>;
    async fn upsert(&self, record: &MemoryRecord) -> Result<(), String>;
    async fn delete(&self, id: &str) -> Result<(), String>;
    async fn rebuild(&self, records: &[MemoryRecord]) -> Result<(), String>;
}

/// Optional Mem0 OSS REST mirror.
///
/// Blex memory IDs are mapped to Mem0 `run_id` values. This lets an upsert
/// deterministically delete the previous external representation before
/// creating its replacement without persisting Mem0's generated IDs. The
/// local JSONL ledger and Tantivy index remain canonical at all times.
pub(crate) struct Mem0Backend {
    base_url: String,
    client: reqwest::Client,
    api_key: Option<String>,
}

impl Mem0Backend {
    pub fn new(base_url: &str) -> Result<Self, String> {
        let parsed =
            reqwest::Url::parse(base_url).map_err(|error| format!("invalid Mem0 URL: {error}"))?;
        if parsed.scheme() != "http" && parsed.scheme() != "https" {
            return Err("Mem0 URL must use http or https".to_string());
        }
        let is_loopback = parsed.host_str().is_some_and(|host| {
            host.eq_ignore_ascii_case("localhost")
                || host
                    .parse::<std::net::IpAddr>()
                    .is_ok_and(|address| address.is_loopback())
        });
        let client = if is_loopback {
            crate::local_http::builder()
                .timeout(Duration::from_secs(3))
                .build()
                .map_err(|error| format!("create local Mem0 HTTP client: {error}"))?
        } else {
            #[allow(clippy::disallowed_methods)]
            let builder = reqwest::Client::builder().timeout(Duration::from_secs(3));
            crate::proxy_config::build_client_with_proxy(builder)
                .map_err(|error| format!("create Mem0 HTTP client: {error}"))?
        };
        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            client,
            api_key: std::env::var("BLEX_MEM0_API_KEY")
                .or_else(|_| std::env::var("MEM0_API_KEY"))
                .ok()
                .filter(|value| !value.trim().is_empty()),
        })
    }

    fn request(&self, builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        match self.api_key.as_ref() {
            Some(key) => builder.header("X-API-Key", key),
            None => builder,
        }
    }

    async fn delete_by_run_id(&self, id: &str) -> Result<(), String> {
        let mut url = reqwest::Url::parse(&format!("{}/memories", self.base_url))
            .map_err(|error| format!("build Mem0 delete URL: {error}"))?;
        url.query_pairs_mut().append_pair("run_id", id);
        let response = self
            .request(self.client.delete(url))
            .send()
            .await
            .map_err(|error| format!("delete Mem0 memory: {error}"))?;
        if response.status().is_success() || response.status() == reqwest::StatusCode::NOT_FOUND {
            Ok(())
        } else {
            Err(format!(
                "delete Mem0 memory returned HTTP {}",
                response.status()
            ))
        }
    }
}

impl MemoryBackend for Mem0Backend {
    async fn health(&self) -> Result<(), String> {
        let response = self
            .request(
                self.client
                    .get(format!("{}/auth/setup-status", self.base_url)),
            )
            .send()
            .await
            .map_err(|error| format!("Mem0 health check failed: {error}"))?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!(
                "Mem0 health check returned HTTP {}",
                response.status()
            ))
        }
    }

    async fn search(&self, query: &str, record: &MemoryRecord) -> Result<Value, String> {
        let mut body = json!({ "query": query, "user_id": "blex-user" });
        if record.scope.kind != MemoryScopeKind::User {
            body["agent_id"] = Value::String(format!(
                "{}:{}",
                match record.scope.kind {
                    MemoryScopeKind::User => "user",
                    MemoryScopeKind::Workspace => "workspace",
                    MemoryScopeKind::Agent => "agent",
                },
                record.scope.id.as_deref().unwrap_or_default()
            ));
        }
        let response = self
            .request(self.client.post(format!("{}/search", self.base_url)))
            .json(&body)
            .send()
            .await
            .map_err(|error| format!("search Mem0: {error}"))?;
        response
            .error_for_status()
            .map_err(|error| format!("search Mem0: {error}"))?
            .json()
            .await
            .map_err(|error| format!("decode Mem0 search response: {error}"))
    }

    async fn upsert(&self, record: &MemoryRecord) -> Result<(), String> {
        if record.status != MemoryStatus::Active {
            return self.delete(&record.id).await;
        }
        self.delete_by_run_id(&record.id).await?;
        let scope_label = match record.scope.kind {
            MemoryScopeKind::User => "user",
            MemoryScopeKind::Workspace => "workspace",
            MemoryScopeKind::Agent => "agent",
        };
        let mut body = json!({
            "messages": [{ "role": "user", "content": record.summary }],
            "user_id": "blex-user",
            "run_id": record.id,
            "metadata": {
                "blex_memory_id": record.id,
                "blex_scope": scope_label,
                "blex_scope_id": record.scope.id,
                "blex_revision": record.revision,
                "blex_kind": record.kind,
            }
        });
        if record.scope.kind != MemoryScopeKind::User {
            body["agent_id"] = Value::String(format!(
                "{}:{}",
                scope_label,
                record.scope.id.as_deref().unwrap_or_default()
            ));
        }
        let response = self
            .request(self.client.post(format!("{}/memories", self.base_url)))
            .json(&body)
            .send()
            .await
            .map_err(|error| format!("upsert Mem0 memory: {error}"))?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!(
                "upsert Mem0 memory returned HTTP {}",
                response.status()
            ))
        }
    }

    async fn delete(&self, id: &str) -> Result<(), String> {
        self.delete_by_run_id(id).await
    }

    async fn rebuild(&self, records: &[MemoryRecord]) -> Result<(), String> {
        for record in records {
            self.upsert(record).await?;
        }
        Ok(())
    }
}
