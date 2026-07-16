// Provider and permission configuration types

import type { HeartbeatConfig, MemoryAutoUpdateConfig, MemoryEvolutionConfig } from './types/im';
import type { RuntimeSource, RuntimeType } from './types/runtime';
import type { UiLanguage } from './i18n';
import type { OfficialToolId, OfficialToolSettings } from './official-tools';
import type { SubscriptionVerifyFailureKind } from './subscription';

/**
 * Permission mode for agent behavior
 */
export type PermissionMode = 'auto' | 'plan' | 'fullAgency';
export type ConversationMode = 'standard' | 'minimal';

/**
 * Background-agent permission policy (issue #264).
 * - 'inherit'    — background (run_in_background) sub-agents inherit only the
 *                  user's session "always allow" grants; ungranted tools denied.
 * - 'fullAgency' — background lane fully autonomous (non-interaction tools allowed).
 * See src/server/utils/background-agent-permission.ts for the decision core.
 */
export type BackgroundAgentPermissionMode = 'inherit' | 'fullAgency';

/**
 * Permission mode display configuration
 * Based on PRD 0.0.17 mode definitions
 */
export const PERMISSION_MODES: {
  value: PermissionMode;
  label: string;
  icon: string;
  description: string;
  sdkValue: string;
}[] = [
    {
      value: 'auto',
      label: '行动',
      icon: '⚡',
      description: 'Agent 在工作区内行动，使用工具需确认',
      sdkValue: 'acceptEdits',
    },
    {
      value: 'plan',
      label: '规划',
      icon: '📋',
      description: 'Agent 仅研究信息并与您讨论规划',
      sdkValue: 'plan',
    },
    {
      value: 'fullAgency',
      label: '自主行动',
      icon: '🚀',
      description: 'Agent 拥有完全自主权限，无需人工确认',
      sdkValue: 'bypassPermissions',
    },
  ];

/**
 * Model entity representing a single model configuration
 */
export interface ModelEntity {
  // === 核心字段（必填）===
  model: string;         // API 代码，如 "claude-sonnet-4-6"
  modelName: string;     // 显示名称，如 "Claude Sonnet 4.6"
  modelSeries: string;   // 品牌系列，如 "claude" | "deepseek" | "zhipu"

  // === 元数据字段（可选，API 发现时填充）===
  contextLength?: number;       // 上下文窗口（token 数）
  maxOutputTokens?: number;     // 最大输出 token 数
  inputModalities?: string[];   // 输入模态 ["text", "image", "video"]
  outputModalities?: string[];  // 输出模态 ["text"]

  // === 来源标记 ===
  source?: 'preset' | 'discovered' | 'manual';
}

/**
 * Merge a persisted preset-provider custom entry into a bundled preset model.
 *
 * User-authored entries (`source: manual`, plus legacy entries with no source)
 * are explicit overrides: if the user typed a bundled model id and filled
 * context/modalities/name, the UI must show what the runtime will use.
 *
 * Discovered entries are API metadata and lower-trust for bundled models, so
 * they only fill fields the curated preset left empty. This keeps automatic
 * discovery from poisoning hand-maintained presets while still preserving
 * useful gaps.
 */
export function mergePresetModelWithCustomEntry(
  preset: ModelEntity,
  custom: ModelEntity | undefined,
): ModelEntity {
  if (!custom) return preset;

  if (custom.source === 'discovered') {
    return {
      ...preset,
      contextLength: preset.contextLength ?? custom.contextLength,
      maxOutputTokens: preset.maxOutputTokens ?? custom.maxOutputTokens,
      inputModalities: preset.inputModalities ?? custom.inputModalities,
      outputModalities: preset.outputModalities ?? custom.outputModalities,
    };
  }

  return {
    ...preset,
    modelName: custom.modelName ?? preset.modelName,
    modelSeries: custom.modelSeries ?? preset.modelSeries,
    contextLength: custom.contextLength ?? preset.contextLength,
    maxOutputTokens: custom.maxOutputTokens ?? preset.maxOutputTokens,
    inputModalities: custom.inputModalities ?? preset.inputModalities,
    outputModalities: custom.outputModalities ?? preset.outputModalities,
  };
}

const PROVIDER_MODEL_LIST_SEPARATOR_RE = /[,，]/;

export function splitProviderModelInput(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (!PROVIDER_MODEL_LIST_SEPARATOR_RE.test(trimmed)) return [trimmed];
  return trimmed
    .split(PROVIDER_MODEL_LIST_SEPARATOR_RE)
    .map(part => part.trim())
    .filter(Boolean);
}

/**
 * Model type for model selection (API code)
 */
export type ModelId = string;

/**
 * Model alias mapping for non-Anthropic providers.
 * Maps SDK model aliases (fable/opus/sonnet/haiku) to provider-specific model IDs.
 * When Claude Agent SDK sub-agents use hardcoded model aliases like "fable",
 * the bridge translates them to the actual provider model via this mapping.
 */
export interface ModelAliases {
  fable?: string;  // e.g., 'deepseek-reasoner'
  sonnet?: string;  // e.g., 'deepseek-chat'
  opus?: string;    // e.g., 'deepseek-reasoner'
  haiku?: string;   // e.g., 'deepseek-chat'
}

export function completeModelAliases(
  aliases: ModelAliases | undefined,
  fallbackModel?: string,
): ModelAliases | undefined {
  const fable = aliases?.fable ?? aliases?.opus ?? aliases?.sonnet ?? aliases?.haiku ?? fallbackModel;
  const opus = aliases?.opus ?? aliases?.fable ?? aliases?.sonnet ?? aliases?.haiku ?? fallbackModel;
  const sonnet = aliases?.sonnet ?? aliases?.opus ?? aliases?.fable ?? aliases?.haiku ?? fallbackModel;
  const haiku = aliases?.haiku ?? aliases?.sonnet ?? aliases?.opus ?? aliases?.fable ?? fallbackModel;
  const completed: ModelAliases = {};
  if (fable) completed.fable = fable;
  if (opus) completed.opus = opus;
  if (sonnet) completed.sonnet = sonnet;
  if (haiku) completed.haiku = haiku;
  return Object.keys(completed).length > 0 ? completed : undefined;
}

export interface ProviderOrderSettings {
  providerOrder?: string[];
  disabledProviderIds?: string[];
}

/** Subscription provider ID for verification caching */
export const SUBSCRIPTION_PROVIDER_ID = 'anthropic-sub';

/** Legacy persisted ID. It is not present in the provider catalogue. */
export const CODEX_SUBSCRIPTION_PROVIDER_ID = 'codex-sub';

type ProviderOrderable = {
  id: string;
  enabled?: unknown;
};

const MISSING_PROVIDER_INSERT_AFTER: Record<string, string> = {};

export function normalizeProviderOrder(providerIds: string[], providerOrder?: string[]): string[] {
  const known = new Set(providerIds);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of providerOrder ?? []) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  for (const id of providerIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const insertAfter = MISSING_PROVIDER_INSERT_AFTER[id];
    const insertAfterIndex = insertAfter ? ordered.indexOf(insertAfter) : -1;
    if (insertAfterIndex >= 0) {
      ordered.splice(insertAfterIndex + 1, 0, id);
    } else {
      ordered.push(id);
    }
  }

  return ordered;
}

export function normalizeDisabledProviderIds(providerIds: string[], disabledProviderIds?: string[]): string[] {
  const known = new Set(providerIds);
  const seen = new Set<string>();
  const disabled: string[] = [];

  for (const id of disabledProviderIds ?? []) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    disabled.push(id);
  }

  return disabled;
}

export function applyProviderEnablementAndOrder<T extends ProviderOrderable>(
  providers: T[],
  settings?: ProviderOrderSettings,
): T[] {
  const byId = new Map(providers.map(provider => [provider.id, provider] as const));
  const orderedIds = normalizeProviderOrder(providers.map(provider => provider.id), settings?.providerOrder);
  const disabled = new Set(normalizeDisabledProviderIds(orderedIds, settings?.disabledProviderIds));

  return orderedIds
    .map(id => {
      const provider = byId.get(id);
      if (!provider) return undefined;
      const nextEnabled = !disabled.has(id);
      if (provider.enabled === nextEnabled || (nextEnabled && provider.enabled === undefined)) {
        return provider;
      }
      return { ...provider, enabled: nextEnabled };
    })
    .filter((provider): provider is T => Boolean(provider));
}

export function isProviderEnabled(provider: { enabled?: unknown } | null | undefined): boolean {
  return provider?.enabled !== false;
}

/**
 * Get the display name for a model
 */
export function getModelDisplayName(provider: Provider, modelId: string): string {
  const model = provider.models?.find(m => m.model === modelId);
  return model?.modelName ?? modelId;
}

/**
 * Get available models for a provider
 */
export function getProviderModels(provider: Provider): ModelEntity[] {
  return provider.models ?? [];
}

/**
 * Get effective primary model (user override > preset default)
 */
export function getEffectivePrimaryModel(
  provider: Provider,
  providerPrimaryModels?: Record<string, string>,
): string {
  const userOverride = providerPrimaryModels?.[provider.id];
  if (userOverride && provider.models?.some(m => m.model === userOverride)) {
    return userOverride;
  }
  return provider.primaryModel;
}

/**
 * Get display string for provider models (for compact UI display)
 * @param maxLength Maximum length before truncation (default 35)
 */
export function getModelsDisplay(provider: Provider, maxLength = 35): string {
  const models = provider.models?.map(m => m.model) ?? [];
  const display = models.join(', ');
  return display.length > maxLength ? display.slice(0, maxLength - 3) + '...' : display;
}

/**
 * Authentication type for API providers
 * - 'auth_token': Only set ANTHROPIC_AUTH_TOKEN
 * - 'api_key': Only set ANTHROPIC_API_KEY
 * - 'both': Set both ANTHROPIC_AUTH_TOKEN and ANTHROPIC_API_KEY (default for backward compatibility)
 * - 'auth_token_clear_api_key': Set AUTH_TOKEN and explicitly clear API_KEY (required by OpenRouter)
 */
export type ProviderAuthType = 'auth_token' | 'api_key' | 'both' | 'auth_token_clear_api_key';

/**
 * API protocol type for provider communication
 * - 'anthropic': Native Anthropic Messages API (default)
 * - 'openai': OpenAI Chat Completions API (translated via built-in bridge)
 */
export type ApiProtocol = 'anthropic' | 'openai';

export type ProviderExecution =
  | { kind: 'builtin' }
  | {
      kind: 'runtime-backed';
      runtime: Exclude<RuntimeType, 'builtin'>;
      source: Extract<RuntimeSource, 'managed-provider'>;
    };

/**
 * Service provider configuration
 */
export interface Provider {
  id: string;
  name: string;
  subtitle?: string;
  vendor: string;           // 厂商名: 'Anthropic', 'DeepSeek', etc.
  cloudProvider: string;    // 云服务商: '模型官方', '云服务商', etc.
  type: 'subscription' | 'api';
  execution?: ProviderExecution; // undefined == { kind: 'builtin' }
  primaryModel: string;     // 默认模型 API 代码
  isBuiltin: boolean;
  enabled?: boolean;        // Runtime-derived: false when globally disabled by the user
  runtimeReady?: boolean;   // Runtime-backed providers only: true when their managed runtime/auth preconditions are ready

  // API 配置
  config: {
    baseUrl?: string;            // ANTHROPIC_BASE_URL
    timeout?: number;            // API_TIMEOUT_MS
    disableNonessential?: boolean; // CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
  };

  // 认证方式 (默认 'both' 以保持向后兼容)
  authType?: ProviderAuthType;

  // API 协议 (默认 'anthropic')
  apiProtocol?: ApiProtocol;

  // 上游 API 格式（仅 apiProtocol === 'openai' 时生效）
  // 'chat_completions' (默认): OpenAI Chat Completions API
  // 'responses': OpenAI Responses API
  upstreamFormat?: 'chat_completions' | 'responses';

  // 最大输出 token 数限制（仅 apiProtocol === 'openai' 时生效）
  // 有值时 Bridge 向上游注入此 token limit；空/undefined = 不发送
  maxOutputTokens?: number;
  // 上游 API 的 token limit 参数名（仅 apiProtocol === 'openai' 时生效）
  // 'max_tokens' (默认，兼容大多数 provider)
  // 'max_completion_tokens' (OpenAI o1/o3/GPT-5、vLLM、OpenRouter)
  // 'max_output_tokens' (OpenAI Responses API)
  maxOutputTokensParamName?: 'max_tokens' | 'max_completion_tokens' | 'max_output_tokens';

  // 官网链接 (用于"去官网"入口)
  websiteUrl?: string;

  // 模型发现端点 URL（可选覆盖）
  // 默认行为：GET {config.baseUrl}/v1/models
  // 当供应商的 Anthropic 路径不支持 /v1/models 时，指向其 OpenAI 路径
  modelListUrl?: string;

  // 是否支持通过远端接口发现模型。默认 true；订阅套餐等仅提供固定
  // 推理端点、没有模型目录接口时显式设为 false，避免错误探测 /v1/models。
  supportsModelDiscovery?: boolean;

  // 模型列表 - 使用新的 ModelEntity 结构
  models: ModelEntity[];

  // SDK 模型别名映射（非 Anthropic provider 的子 Agent 模型重定向）
  // SDK 内置子 Agent (如 Explore) 会硬编码 model: "haiku"，通过此映射转为实际模型
  modelAliases?: ModelAliases;

  // 用户输入的 API Key (运行时填充，不持久化到 provider 定义)
  apiKey?: string;
}

/**
 * Project/workspace configuration
 */
export type WorkspaceType = 'user' | 'system-preset';
export type SystemPresetWorkspaceId = 'mino';

export interface Project {
  id: string;
  name: string;
  path: string;
  lastOpened?: string;
  /** Launcher right rail pin time. Pinned workspaces sort newest-first. */
  pinnedAt?: string | undefined;
  // Project-specific settings (null means use default)
  providerId: string | null;
  permissionMode: PermissionMode | null;
  model?: string | null;
  // Custom permission rules for 'custom' mode
  customPermissions?: {
    allow: string[];
    deny: string[];
  };
  // Workspace-level MCP enabled servers (IDs of globally enabled MCPs that are turned on for this workspace)
  // null/undefined = none enabled, array of IDs = those MCPs are enabled for this workspace
  mcpEnabledServers?: string[];
  /** PRD 0.2.17 — Claude plugins enabled for this workspace (subset of globally
   *  visible plugins). Mirrors mcpEnabledServers semantics exactly. */
  enabledPluginIds?: string[];
  /** BlexAgent official CLI tools enabled for this workspace. Separate from MCP ids. */
  enabledOfficialToolIds?: OfficialToolId[];
  /** Internal projects (e.g. ~/.blexagent diagnostic workspace) hidden from Launcher */
  internal?: boolean;
  /** Custom emoji icon for display, defaults to FolderOpen if absent */
  icon?: string;
  /** Custom display name, defaults to folder name extracted from path */
  displayName?: string;
  /** Whether this workspace has been upgraded to an Agent (v0.1.41) */
  isAgent?: boolean;
  /** Associated Agent ID when isAgent=true (v0.1.41) */
  agentId?: string;
  /** Source template ID used when this workspace was created from a template. */
  templateId?: string;
  /** Template source. Built-in templates can carry product-level Agent defaults. */
  templateSource?: WorkspaceTemplateSource;
  /** Lifecycle owner. Missing means ordinary user workspace for backward compatibility. */
  workspaceType?: WorkspaceType;
  /** Stable ID for a system-preset workspace instance. Current preset set: mino. */
  systemPresetId?: SystemPresetWorkspaceId;
  /** Soft-delete flag. Hidden projects remain persisted but are excluded from user-facing lists. */
  hidden?: boolean;
  /** ISO timestamp for soft deletion. Diagnostic/future restore metadata only. */
  hiddenAt?: string;
  /** ISO timestamp for user-facing archive. Archived workspaces stay restorable. */
  archivedAt?: string;
  /** Whether proactive Agent mode was enabled when the workspace was archived. */
  archivedAgentEnabledBeforeArchive?: boolean;
}

export type ProjectPatch = Partial<Omit<Project, 'id'>>;

// ===== Workspace Template Types =====

export type WorkspaceTemplateSource = 'builtin' | 'user';

export interface WorkspaceTemplateAgentDefaults {
  /** Whether the created workspace's Agent starts in proactive mode. */
  enabled?: boolean;
  /** Agent-level heartbeat defaults; channels remain user-created/credential-gated. */
  heartbeat?: HeartbeatConfig;
  /** Agent-level memory maintenance defaults. */
  memoryAutoUpdate?: MemoryAutoUpdateConfig;
  /** Agent-level long-term memory evolution defaults. */
  memoryEvolution?: MemoryEvolutionConfig;
}

/**
 * Workspace template definition
 */
export interface WorkspaceTemplate {
  id: string;           // kebab-case unique ID
  name: string;         // Display name
  description: string;  // Description (can be empty)
  icon?: string;        // Phosphor icon ID (e.g. "sparkle") or emoji fallback; defaults to cube icon if absent
  isBuiltin: boolean;   // true = preset template bundled with app
  path?: string;        // User template: absolute path under ~/.blexagent/templates/
  /** Product-level Agent defaults applied when creating a workspace from this template. */
  agentDefaults?: WorkspaceTemplateAgentDefaults;
}

export const DEFAULT_BUNDLED_WORKSPACE_TEMPLATE_ID = 'mino';
export const DEFAULT_SYSTEM_PRESET_WORKSPACE_ID: SystemPresetWorkspaceId = 'mino';
export const DEFAULT_SYSTEM_PRESET_WORKSPACE_DISPLAY_NAME = 'Blex';
export const LEGACY_SYSTEM_PRESET_WORKSPACE_DISPLAY_NAME = 'Mino';

export function isSystemPresetProject(
  project: Pick<Project, 'workspaceType' | 'systemPresetId'> | null | undefined,
): boolean {
  return project?.workspaceType === 'system-preset' && !!project.systemPresetId;
}

export function isProjectVisibleToUser(
  project: Pick<Project, 'internal' | 'hidden'> | null | undefined,
): boolean {
  return !!project && project.internal !== true && project.hidden !== true;
}

export function isProjectArchived(
  project: Pick<Project, 'archivedAt'> | null | undefined,
): boolean {
  return typeof project?.archivedAt === 'string' && project.archivedAt.length > 0;
}

export function isProjectActiveForUser(
  project: Pick<Project, 'internal' | 'hidden' | 'archivedAt'> | null | undefined,
): boolean {
  return isProjectVisibleToUser(project) && !isProjectArchived(project);
}

export function getSystemPresetProjectMetadata(
  presetId: SystemPresetWorkspaceId,
): ProjectPatch {
  switch (presetId) {
    case 'mino':
      return {
        workspaceType: 'system-preset',
        systemPresetId: 'mino',
        icon: 'lightning',
        displayName: DEFAULT_SYSTEM_PRESET_WORKSPACE_DISPLAY_NAME,
        templateId: DEFAULT_BUNDLED_WORKSPACE_TEMPLATE_ID,
        templateSource: 'builtin',
      };
  }
}

export function getSystemPresetProjectMetadataPatch(
  project: Project,
  presetId: SystemPresetWorkspaceId,
): ProjectPatch {
  const metadata = getSystemPresetProjectMetadata(presetId);
  const patch: ProjectPatch = {};

  if (metadata.workspaceType && project.workspaceType !== metadata.workspaceType) patch.workspaceType = metadata.workspaceType;
  if (metadata.systemPresetId && project.systemPresetId !== metadata.systemPresetId) patch.systemPresetId = metadata.systemPresetId;
  if (metadata.templateId && project.templateId !== metadata.templateId) patch.templateId = metadata.templateId;
  if (metadata.templateSource && project.templateSource !== metadata.templateSource) patch.templateSource = metadata.templateSource;
  if (!project.icon && metadata.icon) patch.icon = metadata.icon;
  const shouldRepairDisplayName = !project.displayName
    || (
      presetId === DEFAULT_SYSTEM_PRESET_WORKSPACE_ID
      && project.displayName === LEGACY_SYSTEM_PRESET_WORKSPACE_DISPLAY_NAME
    );
  if (shouldRepairDisplayName && metadata.displayName) patch.displayName = metadata.displayName;

  return patch;
}

/**
 * Preset workspace templates bundled with the app
 */
export const PRESET_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: DEFAULT_BUNDLED_WORKSPACE_TEMPLATE_ID,
    name: DEFAULT_SYSTEM_PRESET_WORKSPACE_DISPLAY_NAME,
    description: '能记忆、会进化的 AI Agent。从 minimal 开始，长成你想要的样子。',
    icon: 'lightning',
    isBuiltin: true,
    agentDefaults: {
      enabled: true,
      heartbeat: {
        enabled: true,
        intervalMinutes: 240,
        ackMaxChars: 300,
        activeHours: {
          start: '09:00',
          end: '21:00',
          timezone: 'Asia/Shanghai',
        },
      },
      memoryAutoUpdate: {
        enabled: true,
        intervalHours: 24,
        queryThreshold: 3,
        updateWindowStart: '21:00',
        updateWindowEnd: '09:00',
        updateWindowTimezone: undefined,
      },
      memoryEvolution: {
        enabled: true,
      },
    },
  },
];

/**
 * Provider verification status (with expiry support)
 */
export interface ProviderVerifyStatus {
  status: 'valid' | 'invalid';
  verifiedAt: string; // ISO timestamp
  accountEmail?: string; // For subscription: detect account change
  invalidReason?: SubscriptionVerifyFailureKind | 'provider_verify_failed' | 'network_error';
  error?: string;
}

/** Verification expiry in days */
export const VERIFY_EXPIRY_DAYS = 30;

/** Legacy managed-Codex state retained only while old configurations are migrated. */
export interface ManagedCodexRuntimeInstallState {
  status: 'not-installed' | 'checking' | 'downloading' | 'installed' | 'update-required' | 'error';
  requiredVersion?: string;
  installedVersion?: string;
  platform?: string;
  installedAt?: string;
  lastCheckedAt?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  progressPercent?: number;
  error?: string;
}

export interface ManagedCodexAuthState {
  status: 'unknown' | 'valid' | 'invalid' | 'logging-in' | 'logged-out' | 'error';
  authMethod?: 'chatgpt' | 'api-key' | 'access-token';
  accountEmail?: string;
  verifiedAt?: string;
  error?: string;
}

export const MANAGED_CODEX_REQUIRED_RUNTIME = {
  component: 'codex', version: '0.142.2', runtimeSet: 'retired', manifestBaseUrl: '', manifestPublicKeyId: '',
} as const;

/** Check if verification has expired */
export function isVerifyExpired(verifiedAt: string): boolean {
  const verifiedDate = new Date(verifiedAt);
  // Invalid date string returns NaN, treat as expired to trigger re-verification
  if (isNaN(verifiedDate.getTime())) {
    return true;
  }
  const now = new Date();
  const daysDiff = (now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > VERIFY_EXPIRY_DAYS;
}

/**
 * Network proxy protocol type
 */
export type ProxyProtocol = 'http' | 'https' | 'socks5';

/**
 * Network proxy default values
 */
export const PROXY_DEFAULTS = {
  protocol: 'http' as ProxyProtocol,
  host: '127.0.0.1',
  port: 7897,
} as const;

/**
 * Validate proxy host (localhost, IP address, or hostname)
 */
export function isValidProxyHost(host: string): boolean {
  if (!host || host.length > 253) return false;
  // localhost, IPv4, or valid hostname
  return /^(localhost|(\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)*)$/.test(host);
}

/**
 * Network proxy settings (General settings)
 */
export type ProxyScopeMode = 'all' | 'custom';

export interface ProxyScopeSettings {
  mode: ProxyScopeMode;
  providerIds?: string[];
}

export interface ProxySettings {
  enabled: boolean;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  scope?: ProxyScopeSettings;
}

/**
 * App-level configuration
 */
export const DEFAULT_CLAUDE_TRANSCRIPT_CLEANUP_PERIOD_DAYS = 365;

export type ChatQueueResponseMode = 'realtime' | 'turn';

export function normalizeChatQueueResponseMode(value: unknown): ChatQueueResponseMode {
  return value === 'turn' ? 'turn' : 'realtime';
}

export function normalizeClaudeTranscriptCleanupPeriodDays(value: unknown): number {
  const numericValue = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_CLAUDE_TRANSCRIPT_CLEANUP_PERIOD_DAYS;
  }
  return Math.max(1, Math.floor(numericValue));
}

export interface AppConfig {
  // Default settings for new projects
  defaultProviderId?: string;
  defaultPermissionMode: PermissionMode;
  // Background-agent permission policy (issue #264). Controls what a
  // `run_in_background` sub-agent may do when it hits a tool the SDK can't
  // auto-resolve. 'inherit' (default) = background agents inherit only the
  // user's session "always allow" grants, ungranted tools are denied with a
  // clear message; 'fullAgency' = background lane is fully autonomous (every
  // non-interaction tool allowed). Omitted/undefined ⇒ treated as 'inherit'.
  backgroundAgentPermissionMode?: BackgroundAgentPermissionMode;
  // UI preferences
  theme: 'light' | 'dark' | 'system';
  /** Theme color preset. Omitted/undefined ⇒ 'ocean-blue' (default). */
  themePreset?: string;
  /** Product UI language. Existing pre-i18n configs missing this field migrate
   *  to `zh-CN`; new installs default to `system`. */
  uiLanguage?: UiLanguage;
  minimizeToTray: boolean;
  /** 全局「始终阻止电脑睡眠」开关（PRD 0.2.35）。
   *  默认 `false` ⇒ 沿用「智能模式」：AI 跑中由 sidecar.rs / cron_task.rs 各自持锁。
   *  `true` ⇒ 进程启动起就持一把常开 wake-lock，直到关闭开关 / 进程结束。
   *  写盘 + acquire/drop OS 锁 + emit + 托盘 set_checked 由 Rust 的
   *  `cmd_set_force_wake_lock` 原子完成；ConfigProvider.updateConfig 识别到该
   *  字段时**特化分支**，不走默认 atomicModifyConfig（避免 disk/锁中间态打架，
   *  PRD §3.3 / D2）。 */
  forceWakeLock?: boolean;
  /** 对话输入框发送键偏好。缺省视同 'enter'（Enter 发送，Shift+Enter 换行）。
   *  'modEnter' 则 ⌘/Ctrl+Enter 发送、Enter 换行。统一作用于全部"和 AI 对话"的
   *  输入：主对话框 / AI 小助理 / 问题反馈（见 utils/chatSendKey.ts）。 */
  chatSendShortcut?: 'enter' | 'modEnter';
  /** 桌面 Chat 连续发送 query 时的队列投递策略。
   *  'realtime'（默认）= busy 时尽快交给可实时响应的 runtime
   *  （builtin SDK async queue；Codex app-server turn/steer）；
   *  'turn' = busy 时留在 turn-boundary queue，上一轮结束后再作为下一轮发送。
   *  不支持实时 steering 的 external runtime 自动 fallback 到 'turn' 行为。
   *  仅桌面交互发送读取；IM/Cron/Inbox 等非桌面来源保持既有语义。 */
  chatQueueResponseMode?: ChatQueueResponseMode;
  showDevTools: boolean; // 显示开发者工具 (Logs/System Info)
  /** @deprecated Legacy disk value; the product always uses the built-in SDK. */
  multiAgentRuntime?: boolean;
  experimentalSplitView?: boolean; // 实验性：文件预览在右侧分屏而非弹窗
  /** 实验室：用户注册 CLI 工具注册表（PRD 0.2.36）。默认关。
   *  只控制工具箱里的 CLI 工具注册/管理/AI 自动发现；不影响 blexagent CLI
   *  本身以及 cron / task / widget / thought 等已发布 CLI 能力。 */
  cliToolRegistryEnabled?: boolean;
  /** 隐藏开发者开关：桌面宠物功能门控。默认开；普通用户不可见。 */
  floatingBallDevGate?: boolean;
  /** 开发者总门控：团队 Space（BlexAgent Space / Cloud Space）。默认关。
   *  功能未完成前隐藏标题栏入口与已恢复的团队 tab。 */
  teamSpaceEnabled?: boolean;
  /** 悬浮球本体显隐开关；由桌面宠物设置页顶部开关控制。默认关。 */
  floatingBallEnabled?: boolean;
  /** 悬浮球本体外观。缺省视同 'pet'（PRD 0.2.34 floating_ball_pet_mode Phase 1）。 */
  floatingBallAppearance?: 'pet' | 'orb';
  /** 当前选中的桌宠资源包。缺省视同内置 Blex（持久化资源 ID 仍为 mino）。 */
  floatingBallPetId?: string;
  /** Agent Plan TTS 发音角色。缺省使用 Vivi 2.0。 */
  speechSynthesisVoice?: string;
  /** Agent Plan TTS 语速倍率，官方支持范围 0.1-2.0。 */
  speechSynthesisSpeed?: number;
  /** Agent Plan TTS 音量倍率，官方支持范围 0.5-2.0。 */
  speechSynthesisVolume?: number;
  /** 桌面渠道持久 session id（伴侣窗自铸 UUID v4；轮换见下两个字段，PRD §6.2）。 */
  floatingBallSessionId?: string;
  /** 上述 session 的铸造日期（本地 YYYY-MM-DD）。与今天不同时轮换新 session。 */
  floatingBallSessionDate?: string;
  /** 上述 session 绑定的工作区路径。session 身份是 (id, workspace, date) 三元组——
   *  SDK 的对话树按工作区落盘，跨工作区 resume 必然 "No conversation found"；
   *  默认工作区变更时必须轮换新 session（验收实战教训）。 */
  floatingBallSessionWorkspace?: string;
  /** 悬浮球工作区绑定覆盖（PRD 0.2.34 §14 D17）。null / 缺省 = 跟随主端默认
   *  工作区（config.defaultWorkspacePath）；设为具体工作区路径 = 钉死在该工作区
   *  （不再跟随默认）。切换它触发 session 轮换（铸新 owned session）。 */
  floatingBallWorkspaceOverride?: string | null;
  /** 鼠标悬停悬浮球时自动展开半透明伴侣窗。缺省视同 true；关闭后点击
   *  悬浮球仍会打开 pin 态窗口。 */
  floatingBallHoverPeekEnabled?: boolean;
  /** 开发者：定期从 LiteLLM (GitHub) 拉取 model_prices_and_context_window.json，
   *  作为模型 contextLength/maxOutputTokens 的最低优先级兜底数据源。缺省视同 true。
   *  抓取在 Rust 侧（启动条件检查 + 24h interval，ETag/If-None-Match 增量）。 */
  liteLLMModelDataRefresh?: boolean;
  /** 开发者：fork 走 SDK 独立 `forkSession()` 急切分叉（SDK↔SDK uuid 重映射），
   *  而非旧的 forkFrom 懒分叉状态机。缺省视同 true（默认开）；关掉则回退旧路径。
   *  详见 specs/prd/prd_0.2.27_fork_standalone_migration.md。 */
  eagerFork?: boolean;
  /** 开发者：传给 Claude Agent SDK `settings.cleanupPeriodDays` 的本地 transcript 保留天数。
   *  缺省视同 365，最小 1。 */
  claudeTranscriptCleanupPeriodDays?: number;
  // General settings
  autoStart: boolean; // 开机启动
  /** PRD 0.2.16 全局唤起快捷键。缺省视同 enabled=true + 默认键。
   *  accelerator 形如 'CmdOrCtrl+Shift+M'（Tauri accelerator 语法）。 */
  globalSummonShortcut?: {
    enabled: boolean;
    accelerator: string;
  };
  /** 全局语音唤醒快捷键，Windows 缺省为灵玑 AI 键。 */
  globalVoiceShortcut?: {
    enabled: boolean;
    accelerator: string;
  };
  // OS-level desktop notifications. When false, ALL notification trigger
  // points are suppressed at the Rust entry point (cron complete, task
  // complete, AI turn complete, permission request, ask-user-question,
  // plan-mode review). Renamed from `cronNotifications` in 0.2.14 — the
  // legacy name was misleading because only one of the six triggers is
  // cron-related; the toggle was decorative until 0.2.14 wired it up.
  osNotifications: boolean;
  notificationSound: boolean; // 通知提醒声音（OS 通知是否播放声音）
  /** 通知数字提示：在 Dock / taskbar / tray app icon 上展示未读数字。缺省视同 false。 */
  notificationBadge?: boolean;
  // API Keys for providers (stored separately for security)
  providerApiKeys?: Record<string, string>;
  // Provider verification status (persisted after API key validation)
  // Key is provider ID (e.g., 'anthropic-sub', 'deepseek')
  providerVerifyStatus?: Record<string, ProviderVerifyStatus>;

  // ===== Provider Custom Models =====
  // User-added custom models for preset providers (key = provider ID)
  // These are merged with preset models at runtime, allowing users to add models
  // while keeping preset definitions unchanged (updated with app releases)
  presetCustomModels?: Record<string, ModelEntity[]>;
  // Preset models explicitly removed by user (key = provider ID, value = model IDs)
  // App upgrades won't re-add these; new models NOT in this list appear automatically
  presetRemovedModels?: Record<string, string[]>;

  // ===== Provider Primary Model (user overrides) =====
  // Maps provider ID → user's preferred primary model (overrides preset primaryModel)
  providerPrimaryModels?: Record<string, string>;

  // ===== Provider Model Aliases (user overrides) =====
  // Maps provider ID → user-configured model alias overrides (merged with preset defaults)
  providerModelAliases?: Record<string, ModelAliases>;

  // ===== Provider Enablement / Ordering =====
  // Provider IDs in user-defined display/fallback order.
  providerOrder?: string[];
  // Provider IDs hidden from selectors and runtime resolution without deleting their settings.
  disabledProviderIds?: string[];

  /** @deprecated Legacy disk values removed by configuration migration. */
  managedCodexRuntimeInstall?: ManagedCodexRuntimeInstallState;
  /** @deprecated Legacy disk values removed by configuration migration. */
  managedCodexAuth?: ManagedCodexAuthState;

  // ===== MCP Configuration =====
  // Custom MCP servers added by user (merged with presets)
  mcpServers?: McpServerDefinition[];
  // IDs of globally enabled MCP servers (both presets and custom)
  mcpEnabledServers?: string[];
  // Environment variables for MCP servers that require config (e.g., API keys)
  mcpServerEnv?: Record<string, Record<string, string>>;
  // Extra args for MCP servers (appended to preset args)
  // undefined = never customized, [] = user explicitly cleared
  mcpServerArgs?: Record<string, string[]>;

  // ===== CLI Tool Registry (PRD 0.2.36) =====
  // Per-tool environment variables (API keys etc.) for registered CLI tools
  // (~/.blexagent/tools/). Same shape as mcpServerEnv. The ~/.blexagent/bin
  // launcher shims read this at runtime, so env changes apply on next launch
  // without re-registration.
  cliToolEnv?: Record<string, Record<string, string>>;

  // ===== Official CLI Tools =====
  // Global visibility gate for BlexAgent-owned CLI tools (not user registry tools).
  enabledOfficialToolIds?: OfficialToolId[];
  officialToolSettings?: OfficialToolSettings;

  // ===== Network Proxy (General) =====
  // HTTP/SOCKS5 proxy settings for external network requests
  proxySettings?: ProxySettings;

  // ===== Default Workspace =====
  // Path to the default workspace shown on Launcher
  defaultWorkspacePath?: string;

  // ===== Launcher Last-Used Settings =====
  // Persisted on send from Launcher, restored on next app launch
  // Note: workspace is NOT included — always uses defaultWorkspacePath
  launcherLastUsed?: {
    providerId?: string;
    model?: string;
    permissionMode?: PermissionMode;
    mcpEnabledServers?: string[];
    /** PRD 0.2.17 — last-selected plugin set in Launcher, restored on next open. */
    enabledPluginIds?: string[];
    enabledOfficialToolIds?: OfficialToolId[];
  };

  // ===== Agent Configuration (v0.1.41) =====
  agents?: import('./types/agent').AgentConfig[];

  // ===== Claude Plugin Configuration (PRD 0.2.17) =====
  /** Installed Claude plugins. Each entry's installPath points at a directory
   *  under ~/.blexagent/plugins/<name>/ containing .claude-plugin/plugin.json.
   *  Disk is the source of truth; this is the index. */
  plugins?: import('./types/plugin').PluginEntry[];
  /** Global VISIBILITY gate keyed by PluginEntry.id ("<name>@local").
   *  - `true`  → plugin appears in workspace/Agent plugin selectors as a candidate.
   *  - missing / `false` → plugin is hidden from every workspace (effectively
   *    "installed but quarantined"). Toggle lives in Settings → Plugins.
   *
   *  This is the OUTER layer of the two-layer model (mirrors MCP):
   *  - Layer 1 (this field): "globally visible / quarantined"
   *  - Layer 2 (Agent.enabledPluginIds / Project.enabledPluginIds / Tab session
   *    state): "actually enabled for this specific context"
   *
   *  Format matches Claude Code's settings.json::enabledPlugins so future
   *  marketplace support / cross-import doesn't drift. */
  enabledPlugins?: Record<string, boolean>;
  /** Reserved for future plugin.json::userConfig values (v0.2.18+). v0.2.17
   *  does not collect these via UI but the field is persisted so power users
   *  can hand-edit and survive upgrades. */
  pluginConfigs?: Record<string, { options?: Record<string, unknown> }>;

  // ===== IM Bot Configuration (legacy) =====
  /** @deprecated Migrated to imBotConfigs[]. Only used for migration. */
  imBotConfig?: import('./types/im').ImBotConfig;
  /** @deprecated Migrated to agents[]. Retained for migration detection + Phase 2 Rust shim. */
  imBotConfigs?: import('./types/im').ImBotConfig[];

  // ===== Global Provider Cache (v0.1.26) =====
  /** Pre-built available providers JSON for IM Bot /provider and /model commands.
   *  Written by rebuildAndPersistAvailableProviders() whenever provider config changes.
   *  Read lazily by Rust IM command handlers. */
  availableProvidersJson?: string;
}

/**
 * Project-level settings (synced to .claude/settings.json)
 * Based on PRD 0.0.4 data persistence spec
 */
export interface ProjectSettings {
  // Permission configuration
  permissions?: {
    mode: string;       // SDK permission mode value
    allow?: string[];   // Custom allowed tools
    deny?: string[];    // Custom denied tools
  };
  // Provider environment variables
  env?: Record<string, string>;
}

// Preset providers with ModelEntity structure

/** Legacy tombstone used to recognize and remove old persisted provider state. */
export const MANAGED_CODEX_PROVIDER: Provider = {
  id: CODEX_SUBSCRIPTION_PROVIDER_ID,
  name: 'Retired Codex Provider',
  vendor: 'OpenAI',
  cloudProvider: 'Retired',
  type: 'subscription',
  execution: { kind: 'runtime-backed', runtime: 'codex', source: 'managed-provider' },
  primaryModel: '',
  isBuiltin: false,
  config: {},
  models: [],
};

export interface ManagedCodexProviderReadiness {
  visible: boolean;
  selectable: boolean;
  reason: 'runtime-not-installed' | 'runtime-downloading' | 'runtime-update-required' | 'runtime-error' | 'auth-missing' | 'auth-logging-in' | 'auth-invalid' | 'auth-error' | 'provider-disabled' | 'ready';
  requiredVersion: string;
}

export function isManagedCodexRequiredRuntimeInstalled(_state: ManagedCodexRuntimeInstallState | undefined): boolean {
  return false;
}

export function isManagedCodexSubscriptionAuthValid(_state: ManagedCodexAuthState | undefined): boolean {
  return false;
}

export function getManagedCodexProviderReadiness(_config: Pick<AppConfig, 'disabledProviderIds' | 'managedCodexRuntimeInstall' | 'managedCodexAuth'>): ManagedCodexProviderReadiness {
  return { visible: false, selectable: false, reason: 'provider-disabled', requiredVersion: MANAGED_CODEX_REQUIRED_RUNTIME.version };
}
/** Anthropic 官方预设模型（订阅和 API 共用）
 *  contextLength / maxOutputTokens：来源 Anthropic Models overview (2026-07-03)
 *  inputModalities：Anthropic current Claude models all support text+image input.
 *  contextLength > 200K 由 applyContextWindowSuffix 自动加 [1m] 走 SDK 1M 上下文路径。 */
/** Anthropic 官方默认别名（对齐 SDK 0.3.201 当前模型族：fable5/opus48/sonnet5/haiku45）。
 *  显式 pin 可避免未来 SDK 默认变动时用户体验突变。 */
/** 小米 MiMo 开放平台模型目录（按量付费与 Token Plan 订阅共用，仅端点 / 计费不同）。
 *  规格来源：platform.xiaomimimo.com 模型卡 + Kilo Code 模型页一致（1,048,576 上下文 / 131,072 输出，2026-06）。
 *  contextLength > 200K（SDK 默认窗口）→ applyContextWindowSuffix 自动加 [1m] 走 SDK 1M 上下文路径（#335 起含 200K–1M 中间档）
 *  （MiMo 的 Claude Code 接入文档让手动用户手填 mimo-v2.5-pro[1m]，本产品自动完成；
 *   SDK normalizeModelStringForAPI 在 wire 上再把 [1m] 剥掉，上游收到的是 mimo-v2.5-pro）。 */
export const PRESET_PROVIDERS: Provider[] = [
  {
    id: 'volcengine',
    name: '火山方舟 Coding Plan',
    vendor: '字节跳动',
    cloudProvider: '云服务商',
    type: 'api',
    primaryModel: 'doubao-seed-2.0-code',
    isBuiltin: true,
    authType: 'auth_token',
    websiteUrl: 'https://console.volcengine.com/',
    config: {
      baseUrl: 'https://ark.cn-beijing.volces.com/api/coding',
      disableNonessential: true,
    },
    modelAliases: { sonnet: 'doubao-seed-2.0-code', opus: 'doubao-seed-2.0-code', haiku: 'doubao-seed-2.0-code' },
    models: [
      // doubao-seed-2.0-code: 256K (seed.bytedance.com); Doubao Seed 2.0 全系多模态(text/image/video)
      // 其余 Volcengine 转发上游模型，inputModalities 跟随上游原生能力
      { model: 'doubao-seed-2.0-code', modelName: 'Doubao Seed 2.0 Code', modelSeries: 'volcengine', contextLength: 262_144, maxOutputTokens: 128_000, inputModalities: ['text', 'image', 'video'] },
      { model: 'glm-4.7', modelName: 'GLM 4.7', modelSeries: 'volcengine', contextLength: 200_000, maxOutputTokens: 128_000, inputModalities: ['text'] },
      { model: 'deepseek-v3.2', modelName: 'DeepSeek V3.2', modelSeries: 'volcengine', contextLength: 163_840, maxOutputTokens: 163_840, inputModalities: ['text'] },
      { model: 'kimi-k2.5', modelName: 'Kimi K2.5', modelSeries: 'volcengine', contextLength: 262_144, maxOutputTokens: 262_144, inputModalities: ['text', 'image'] },
    ],
  },
  {
    id: 'volcengine-agent-plan',
    name: '火山引擎 Agent Plan',
    vendor: '字节跳动',
    cloudProvider: '云服务商',
    type: 'api',
    primaryModel: 'ark-code-latest',
    isBuiltin: true,
    // Agent Plan is a Claude Agent SDK endpoint, not an OpenAI-compatible
    // endpoint. Its dedicated plan base URL accepts ANTHROPIC_AUTH_TOKEN.
    authType: 'auth_token',
    apiProtocol: 'anthropic',
    supportsModelDiscovery: false,
    websiteUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?advancedActiveKey=agentPlan',
    config: {
      // Agent Plan has its own quota endpoint. Do not use /api/v3, which is
      // billed as ordinary Ark API usage instead of the subscribed plan.
      baseUrl: 'https://ark.cn-beijing.volces.com/api/plan',
    },
    modelAliases: { sonnet: 'ark-code-latest', opus: 'ark-code-latest', haiku: 'ark-code-latest' },
    models: [
      // Agent Plan exposes a curated subscription catalogue rather than a
      // /v1/models endpoint. Keep this list aligned with the plan console.
      // Dedicated video/image/embedding/speech models are intentionally not
      // selectable as the Claude Agent SDK's primary conversational model.
      { model: 'ark-code-latest', modelName: 'Auto（智能调度）', modelSeries: 'volcengine-agent-plan', contextLength: 256_000, maxOutputTokens: 32_000, inputModalities: ['text', 'image'] },
      { model: 'doubao-seed-2.0-code', modelName: 'Doubao Seed 2.0 Code', modelSeries: 'volcengine-agent-plan', contextLength: 256_000, maxOutputTokens: 128_000, inputModalities: ['text', 'image'] },
      { model: 'doubao-seed-2.0-pro', modelName: 'Doubao Seed 2.0 Pro', modelSeries: 'volcengine-agent-plan', contextLength: 256_000, maxOutputTokens: 128_000, inputModalities: ['text', 'image'] },
      { model: 'doubao-seed-2.0-lite', modelName: 'Doubao Seed 2.0 Lite', modelSeries: 'volcengine-agent-plan', inputModalities: ['text', 'image', 'video', 'audio'] },
      { model: 'doubao-seed-2.0-mini', modelName: 'Doubao Seed 2.0 Mini', modelSeries: 'volcengine-agent-plan', inputModalities: ['text', 'image'] },
      { model: 'glm-5.2', modelName: 'GLM 5.2', modelSeries: 'volcengine-agent-plan', contextLength: 1_000_000, inputModalities: ['text'] },
      { model: 'kimi-k2.7-code', modelName: 'Kimi K2.7 Code', modelSeries: 'volcengine-agent-plan', inputModalities: ['text', 'image', 'video'] },
      { model: 'deepseek-v4-pro', modelName: 'DeepSeek V4 Pro', modelSeries: 'volcengine-agent-plan', inputModalities: ['text'] },
      { model: 'deepseek-v4-flash', modelName: 'DeepSeek V4 Flash', modelSeries: 'volcengine-agent-plan', inputModalities: ['text'] },
      { model: 'minimax-m3', modelName: 'MiniMax M3', modelSeries: 'volcengine-agent-plan', inputModalities: ['text'] },
      { model: 'minimax-m2.7', modelName: 'MiniMax M2.7', modelSeries: 'volcengine-agent-plan', inputModalities: ['text'] },
      { model: 'kimi-k2.6', modelName: 'Kimi K2.6', modelSeries: 'volcengine-agent-plan', inputModalities: ['text'] },
      { model: 'deepseek-v3.2', modelName: 'DeepSeek V3.2', modelSeries: 'volcengine-agent-plan', inputModalities: ['text'] },
    ],
  },
  {
    id: 'aliyun-bailian-coding',
    name: '阿里云百炼 Coding Plan',
    vendor: '阿里云',
    cloudProvider: '云服务商',
    type: 'api',
    primaryModel: 'qwen3.7-plus',
    isBuiltin: true,
    authType: 'auth_token',
    websiteUrl: 'https://bailian.console.aliyun.com/',
    config: {
      baseUrl: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
    },
    modelAliases: { sonnet: 'qwen3.7-plus', opus: 'qwen3.7-plus', haiku: 'qwen3.7-plus' },
    models: [
      // qwen3.7-plus 为当前官方推荐旗舰（1M 上下文，原生多模态）；3.5-plus 落后两代但仍在白名单保留。
      // qwen3-coder-plus 为编码专用（1M）。其余为 Coding Plan 转发的三方模型，跟随上游原生模态。
      { model: 'qwen3.7-plus', modelName: 'Qwen 3.7 Plus', modelSeries: 'aliyun', contextLength: 1_048_576, maxOutputTokens: 65_536, inputModalities: ['text', 'image', 'video'] },
      { model: 'qwen3-coder-plus', modelName: 'Qwen3 Coder Plus', modelSeries: 'aliyun', contextLength: 1_048_576, maxOutputTokens: 65_536, inputModalities: ['text'] },
      { model: 'qwen3.5-plus', modelName: 'Qwen 3.5 Plus', modelSeries: 'aliyun', contextLength: 991_808, maxOutputTokens: 65_536, inputModalities: ['text', 'image', 'video'] },
      { model: 'kimi-k2.5', modelName: 'Kimi K2.5', modelSeries: 'aliyun', contextLength: 262_144, maxOutputTokens: 262_144, inputModalities: ['text', 'image'] },
      { model: 'glm-5', modelName: 'GLM 5', modelSeries: 'aliyun', contextLength: 200_000, maxOutputTokens: 128_000, inputModalities: ['text'] },
      { model: 'MiniMax-M2.5', modelName: 'MiniMax M2.5', modelSeries: 'aliyun', contextLength: 196_608, maxOutputTokens: 8_192, inputModalities: ['text'] },
    ],
  },
];

// ===== MCP Server Configuration Types =====

/**
 * MCP Server type
 */
export type McpServerType = 'stdio' | 'sse' | 'http';

/**
 * MCP Server definition - unified configuration for all MCP server types
 */
export interface McpServerDefinition {
  id: string;
  name: string;            // Display name
  description?: string;    // Feature description
  type: McpServerType;

  // stdio configuration
  command?: string;        // Command to run (e.g., 'npx')
  args?: string[];         // Command arguments
  env?: Record<string, string>;  // Environment variables

  // sse/http configuration
  url?: string;
  headers?: Record<string, string>;

  // Metadata
  isBuiltin: boolean;      // Is a preset MCP
  isFree?: boolean;        // No API key / paid service required
  requiresConfig?: string[];  // Required config fields (e.g., API keys)
  websiteUrl?: string;     // Website for API key registration
  configHint?: string;     // Help text shown in settings dialog (e.g., "去官网注册获取 API Key")
  /**
   * Platforms this preset supports. Undefined = all platforms.
   * Values match `process.platform` / `NodeJS.Platform`
   * (`'darwin' | 'win32' | 'linux'`). Presets with a set platforms list are
   * filtered out of the catalogue on non-matching hosts — both in the
   * renderer `mcpService.ts` and the sidecar `admin-config.ts` so the UI
   * and the effective server list stay in sync.
   */
  platforms?: NodeJS.Platform[];
}

/**
 * MCP Server status (runtime)
 */
export type McpServerStatus = 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled';

/**
 * MCP enable error type (returned by /api/mcp/enable)
 */
export type McpEnableErrorType = 'command_not_found' | 'warmup_failed' | 'package_not_found' | 'runtime_error' | 'connection_failed' | 'unknown';

/**
 * MCP enable error response
 */
export interface McpEnableError {
  type: McpEnableErrorType;
  message: string;
  command?: string;
  runtimeName?: string;
  downloadUrl?: string;
}

/**
 * Preset MCP servers that come bundled with the app
 */
export const PRESET_MCP_SERVERS: McpServerDefinition[] = [
  {
    id: 'playwright',
    name: 'Playwright 浏览器',
    description: '浏览器自动化能力，支持网页浏览、截图、表单填写等',
    type: 'stdio',
    command: 'npx',
    args: ['@playwright/mcp@latest'],
    isBuiltin: true,
    isFree: true,
  },
  {
    id: 'ddg-search',
    name: 'DuckDuckGo 搜索引擎',
    description: '无需 API Key。受 DuckDuckGo 频率限制（≤1次/秒，≤15000次/月），高频使用可能返回 400 错误',
    type: 'stdio',
    command: 'uvx',
    args: ['duckduckgo-mcp-server'],
    isBuiltin: true,
    isFree: true,
  },
  {
    id: 'tavily-search',
    name: 'Tavily 搜索引擎',
    description: '专为 AI 优化的全网搜索，返回结构化结果。免费 1000 次/月，无需信用卡',
    type: 'http',
    url: 'https://mcp.tavily.com/mcp/?tavilyApiKey={{TAVILY_API_KEY}}',
    isBuiltin: true,
    requiresConfig: ['TAVILY_API_KEY'],
    websiteUrl: 'https://app.tavily.com/home',
    configHint: '免费注册即可获取 API Key（1000 次/月，无需信用卡）',
  },
  {
    id: 'gemini-image',
    name: 'Nano Banana 图片生成',
    description: '支持图片生成与多轮编辑（基于 Gemini Nano Banana）',
    type: 'stdio',
    command: '__builtin__',
    args: [],
    isBuiltin: true,
    requiresConfig: ['GEMINI_API_KEY'],
    websiteUrl: 'https://aistudio.google.com/apikey',
    configHint: '在 Google AI Studio 一键创建 API Key',
  },
  {
    id: 'edge-tts',
    name: 'Edge TTS 语音合成',
    description: '免费文字转语音，支持 400+ 语音（基于 Microsoft Edge TTS，无需 API Key）',
    type: 'stdio',
    command: '__builtin__',
    args: [],
    isBuiltin: true,
    isFree: true,
  },
  {
    id: 'cuse',
    name: 'Cuse 电脑控制',
    description: '让 AI 直接操作你的电脑：截图、点击、输入、滚动。',
    type: 'stdio',
    // Sentinel resolved at MCP launch to the bundled cuse binary path —
    // see getBundledCusePath() in src/server/utils/runtime.ts.
    command: '__bundled_cuse__',
    args: ['mcp', '--caller-app', 'BlexAgent'],
    isBuiltin: true,
    isFree: true,
    platforms: ['darwin', 'win32'],
  },
];

// ===== MCP OAuth 2.0 Types =====

/**
 * OAuth 2.0 configuration — see ManualOAuthConfig for manual mode,
 * McpOAuthState (mcp-oauth/types.ts) for backend state.
 */

/** OAuth status for display in the UI */
export type McpOAuthStatus = 'disconnected' | 'connecting' | 'connected' | 'expired' | 'error';

/** Result of probing an MCP server for OAuth requirements */
export type OAuthProbeResult =
  | { required: false }
  | { required: true; supportsDynamicRegistration: boolean; scopes?: string[] };

/** Manual OAuth config (advanced fallback when dynamic registration unavailable) */
export interface ManualOAuthConfig {
  clientId: string;
  clientSecret?: string;
  callbackPort?: number;
  scopes?: string[];
  authorizationUrl?: string;
  tokenUrl?: string;
}

/**
 * MCP discovery links
 */
export const MCP_DISCOVERY_LINKS = [
  { name: 'MCP.SO', url: 'https://mcp.so/' },
  { name: '智谱MCP', url: 'https://bigmodel.cn/marketplace/index/mcp' },
];

/**
 * Get preset MCP server by ID
 */
export function getPresetMcpServer(id: string): McpServerDefinition | undefined {
  return PRESET_MCP_SERVERS.find(s => s.id === id);
}

/**
 * Get effective model aliases for a provider (preset defaults merged with user overrides).
 * Anthropic providers don't need aliases (SDK natively supports their models).
 */
export function getEffectiveModelAliases(
  provider: Provider,
  userOverrides?: Record<string, ModelAliases>,
): ModelAliases | undefined {
  // Anthropic providers don't need alias mapping
  if (provider.id === 'anthropic-sub' || provider.id === 'anthropic-api') return undefined;
  const defaults = provider.modelAliases ?? {};
  const overrides = userOverrides?.[provider.id];
  if (overrides) {
    // User has explicit overrides — merge with defaults (overrides win, including empty strings)
    return completeModelAliases({ ...defaults, ...overrides });
  }
  // No user overrides — return preset defaults if any
  const completedDefaults = completeModelAliases(defaults);
  if (completedDefaults) return completedDefaults;
  // Fallback: no preset aliases and no user overrides — use provider's first model or primaryModel
  // so sub-agents (model: "fable"/"sonnet"/"opus"/"haiku") don't send raw claude-* to the third-party API.
  const fallbackModel = provider.primaryModel || provider.models?.[0]?.model;
  return completeModelAliases(undefined, fallbackModel);
}

export const DEFAULT_CONFIG: AppConfig = {
  defaultProviderId: undefined, // No default — resolved at runtime from first available provider
  defaultPermissionMode: 'auto',
  backgroundAgentPermissionMode: 'inherit', // background agents inherit granted perms; nothing wider (#264)
  theme: 'system',
  themePreset: 'ocean-blue',
  uiLanguage: 'system',
  minimizeToTray: true,   // 默认开启最小化到托盘
  forceWakeLock: false,   // 默认关闭常开阻睡（智能模式仍在跑，覆盖 AI 工作期间）
  chatQueueResponseMode: 'realtime',
  showDevTools: false,
  teamSpaceEnabled: false, // 默认隐藏未发布的团队 Space 入口
  floatingBallDevGate: true,
  floatingBallEnabled: false,
  speechSynthesisVoice: 'zh_female_vv_uranus_bigtts',
  speechSynthesisSpeed: 1,
  speechSynthesisVolume: 1,
  floatingBallHoverPeekEnabled: true,
  liteLLMModelDataRefresh: true, // 默认开启 LiteLLM 模型数据兜底刷新（开发者可关）
  claudeTranscriptCleanupPeriodDays: DEFAULT_CLAUDE_TRANSCRIPT_CLEANUP_PERIOD_DAYS,
  autoStart: false,       // 默认不开启开机启动
  osNotifications: true,  // 默认开启系统通知
  notificationSound: true, // 默认开启通知声音
  notificationBadge: false, // 默认关闭通知数字提示（待验证稳定后再恢复默认开启）
  globalSummonShortcut: {
    enabled: true,
    accelerator: 'CmdOrCtrl+Shift+M',
  },
  globalVoiceShortcut: {
    enabled: true,
    accelerator: 'LingjiAI',
  },
};

/** Default accelerator string for the global summon shortcut (PRD 0.2.16).
 *  Mirrors the Rust constant `global_shortcut::DEFAULT_ACCELERATOR`. */
export const DEFAULT_SUMMON_ACCELERATOR = 'CmdOrCtrl+Shift+M';
export const DEFAULT_VOICE_ACCELERATOR = 'LingjiAI';
