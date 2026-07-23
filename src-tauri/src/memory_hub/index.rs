use super::types::{MemoryRecord, MemoryStatus};
use crate::search::tokenizer;
use crate::ulog_warn;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex as StdMutex;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::{
    Field, IndexRecordOption, Schema, TextFieldIndexing, TextOptions, STORED, STRING,
};
use tantivy::{doc, Index, IndexReader, IndexWriter, ReloadPolicy};

const SCHEMA_VERSION: u32 = 1;

#[derive(Clone)]
struct MemoryFields {
    id: Field,
    summary: Field,
    tags: Field,
}

/// Rebuildable BM25 index for active memories.
///
/// The JSONL ledger remains authoritative. A failed or corrupt index can be
/// recreated without losing data, and callers always retain a linear-search
/// fallback so recall never blocks a conversation.
pub struct MemoryIndex {
    index: Index,
    reader: IndexReader,
    writer: StdMutex<IndexWriter>,
    fields: MemoryFields,
}

impl MemoryIndex {
    pub fn new(index_dir: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&index_dir)
            .map_err(|error| format!("create memory index directory: {error}"))?;
        let version_path = index_dir.join(".schema_version");
        let stored_version = fs::read_to_string(&version_path)
            .ok()
            .and_then(|value| value.trim().parse::<u32>().ok());
        if stored_version != Some(SCHEMA_VERSION) && index_dir.join("meta.json").exists() {
            for entry in fs::read_dir(&index_dir)
                .map_err(|error| format!("read memory index directory: {error}"))?
                .flatten()
            {
                let path = entry.path();
                let _ = fs::remove_file(&path).or_else(|_| fs::remove_dir_all(&path));
            }
        }

        let (schema, fields) = memory_schema();
        let index = if index_dir.join("meta.json").exists() {
            match Index::open_in_dir(&index_dir) {
                Ok(index) => index,
                Err(error) => {
                    ulog_warn!(
                        "[memory-hub] corrupt Tantivy index at {}, rebuilding: {}",
                        index_dir.display(),
                        error
                    );
                    for entry in fs::read_dir(&index_dir)
                        .map_err(|read_error| format!("read memory index directory: {read_error}"))?
                        .flatten()
                    {
                        let path = entry.path();
                        let _ = fs::remove_file(&path).or_else(|_| fs::remove_dir_all(&path));
                    }
                    Index::create_in_dir(&index_dir, schema)
                        .map_err(|create_error| format!("recreate memory index: {create_error}"))?
                }
            }
        } else {
            Index::create_in_dir(&index_dir, schema)
                .map_err(|error| format!("create memory index: {error}"))?
        };
        fs::write(&version_path, SCHEMA_VERSION.to_string())
            .map_err(|error| format!("write memory index version: {error}"))?;
        index.tokenizers().register(
            tokenizer::TOKENIZER_NAME,
            tokenizer::build_chinese_tokenizer(),
        );

        let writer = match index.writer(15_000_000) {
            Ok(writer) => writer,
            Err(first_error) => {
                let lock_path = index_dir.join(".tantivy-writer.lock");
                if !lock_path.exists() {
                    return Err(format!("create memory index writer: {first_error}"));
                }
                let _ = fs::remove_file(&lock_path);
                ulog_warn!(
                    "[memory-hub] recovered stale Tantivy writer lock at {}",
                    lock_path.display()
                );
                index.writer(15_000_000).map_err(|error| {
                    format!("create memory index writer after recovery: {error}")
                })?
            }
        };
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|error| format!("create memory index reader: {error}"))?;

        Ok(Self {
            index,
            reader,
            writer: StdMutex::new(writer),
            fields,
        })
    }

    pub fn rebuild(&self, records: &[MemoryRecord]) -> Result<(), String> {
        let mut writer = self
            .writer
            .lock()
            .map_err(|error| format!("memory index writer mutex poisoned: {error}"))?;
        writer
            .delete_all_documents()
            .map_err(|error| format!("clear memory index: {error}"))?;
        for record in records
            .iter()
            .filter(|record| record.status == MemoryStatus::Active)
        {
            writer
                .add_document(doc!(
                    self.fields.id => record.id.as_str(),
                    self.fields.summary => record.summary.as_str(),
                    self.fields.tags => record.tags.join(" "),
                ))
                .map_err(|error| format!("index memory {}: {error}", record.id))?;
        }
        writer
            .commit()
            .map_err(|error| format!("commit memory index: {error}"))?;
        drop(writer);
        self.reader
            .reload()
            .map_err(|error| format!("reload memory index: {error}"))
    }

    pub fn search_scores(&self, query: &str, limit: usize) -> Result<HashMap<String, f32>, String> {
        if query.trim().is_empty() {
            return Ok(HashMap::new());
        }
        let mut parser =
            QueryParser::for_index(&self.index, vec![self.fields.summary, self.fields.tags]);
        parser.set_field_boost(self.fields.summary, 2.0);
        let parsed = parser
            .parse_query(query)
            .map_err(|error| format!("parse memory query: {error}"))?;
        let searcher = self.reader.searcher();
        let hits = searcher
            .search(&parsed, &TopDocs::with_limit(limit.clamp(1, 5_000)))
            .map_err(|error| format!("search memory index: {error}"))?;
        let mut scores = HashMap::new();
        for (score, address) in hits {
            let document = searcher
                .doc::<tantivy::TantivyDocument>(address)
                .map_err(|error| format!("read memory index document: {error}"))?;
            let Some(tantivy::schema::OwnedValue::Str(id)) = document.get_first(self.fields.id)
            else {
                continue;
            };
            scores.insert(id.clone(), score);
        }
        Ok(scores)
    }
}

fn memory_schema() -> (Schema, MemoryFields) {
    let mut builder = Schema::builder();
    let text_options = TextOptions::default().set_stored().set_indexing_options(
        TextFieldIndexing::default()
            .set_tokenizer(tokenizer::TOKENIZER_NAME)
            .set_index_option(IndexRecordOption::WithFreqsAndPositions),
    );
    let id = builder.add_text_field("id", STRING | STORED);
    let summary = builder.add_text_field("summary", text_options.clone());
    let tags = builder.add_text_field("tags", text_options);
    let schema = builder.build();
    (schema, MemoryFields { id, summary, tags })
}
