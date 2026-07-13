import type { AgentConfig } from '../../../shared/types/agent';
import { normalizeWorkspacePathIdentity, workspacePathsEqual } from '../../../shared/workspacePath';
import type { Project } from '../types';
import {
  addProject,
  loadProjectsStrict,
  patchProject,
  restoreProjectRegistrationSnapshot,
} from './projectService';
import { addAgentConfig, removeAgentConfig } from './agentConfigService';

export interface ProjectRegistrationRequest {
  path: string;
  metadataPatch: Partial<Omit<Project, 'id'>>;
  buildAgent: (project: Project) => AgentConfig;
}

export interface ProjectRegistrationResult {
  project: Project;
  createdAgent: AgentConfig | null;
}

export interface ProjectRegistrationDependencies {
  loadProjects: () => Promise<Project[]>;
  addProject: (path: string) => Promise<Project>;
  patchProject: (
    projectId: string,
    updates: Partial<Omit<Project, 'id'>>,
  ) => Promise<Project | null>;
  addAgent: (agent: AgentConfig) => Promise<void>;
  removeAgent: (agentId: string) => Promise<void>;
  restoreProject: (path: string, previousProject: Project | null) => Promise<void>;
}

const DEFAULT_DEPENDENCIES: ProjectRegistrationDependencies = {
  loadProjects: loadProjectsStrict,
  addProject,
  patchProject,
  addAgent: addAgentConfig,
  removeAgent: removeAgentConfig,
  restoreProject: restoreProjectRegistrationSnapshot,
};

const workspaceRegistrationTails = new Map<string, Promise<void>>();

/** Serialize the complete registration and compensation lifecycle per workspace. */
function withWorkspaceRegistrationLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const key = normalizeWorkspacePathIdentity(path);
  const previous = workspaceRegistrationTails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const tail = new Promise<void>(resolve => { release = resolve; });
  workspaceRegistrationTails.set(key, tail);

  return previous
    .then(operation)
    .finally(() => {
      release();
      if (workspaceRegistrationTails.get(key) === tail) {
        workspaceRegistrationTails.delete(key);
      }
    });
}

export type RetryProjectRegistrationCompensation = () => Promise<void>;

/**
 * Signals that config compensation itself failed. In this state the caller
 * must preserve the workspace directory: either a project row or an Agent may
 * still reference it, so deleting the directory would create a dangling
 * registration.
 */
export class ProjectRegistrationCompensationError extends Error {
  readonly originalError: unknown;
  readonly compensationErrors: readonly unknown[];
  readonly retryCompensation: RetryProjectRegistrationCompensation;

  constructor(
    originalError: unknown,
    compensationErrors: readonly unknown[],
    retryCompensation: RetryProjectRegistrationCompensation,
  ) {
    super('Project registration failed and its config compensation was incomplete.');
    this.name = 'ProjectRegistrationCompensationError';
    this.originalError = originalError;
    this.compensationErrors = compensationErrors;
    this.retryCompensation = retryCompensation;
  }
}

export function getProjectRegistrationCompensationRecovery(
  error: unknown,
): RetryProjectRegistrationCompensation | null {
  return error instanceof ProjectRegistrationCompensationError
    ? error.retryCompensation
    : null;
}

function registrationStepFailed(step: string): Error {
  return new Error(`Project registration step did not persist a project: ${step}`);
}

/**
 * Register a workspace and its default Agent as one compensating transaction.
 *
 * projects.json and config.json intentionally retain their existing independent
 * locks. If any later step fails (including a write that persisted before
 * throwing), the generated Agent is removed and the exact prior project row is
 * restored before the error is returned to the directory-creation caller.
 */
export async function registerProjectWithAgent(
  request: ProjectRegistrationRequest,
  dependencies: ProjectRegistrationDependencies = DEFAULT_DEPENDENCIES,
): Promise<ProjectRegistrationResult> {
  return withWorkspaceRegistrationLock(request.path, () => (
    registerProjectWithAgentUnlocked(request, dependencies)
  ));
}

async function compensateProjectRegistration(
  request: ProjectRegistrationRequest,
  dependencies: ProjectRegistrationDependencies,
  previousProject: Project | null,
  createdAgent: AgentConfig | null,
): Promise<unknown[]> {
  const compensationErrors: unknown[] = [];

  if (createdAgent) {
    try {
      await dependencies.removeAgent(createdAgent.id);
    } catch (compensationError) {
      compensationErrors.push(compensationError);
    }
  }

  try {
    await dependencies.restoreProject(request.path, previousProject);
  } catch (compensationError) {
    compensationErrors.push(compensationError);
  }

  return compensationErrors;
}

async function registerProjectWithAgentUnlocked(
  request: ProjectRegistrationRequest,
  dependencies: ProjectRegistrationDependencies,
): Promise<ProjectRegistrationResult> {
  const previousProject = (await dependencies.loadProjects())
    .find(project => workspacePathsEqual(project.path, request.path)) ?? null;
  let createdAgent: AgentConfig | null = null;

  try {
    let project = await dependencies.addProject(request.path);

    const metadataPatch = { ...request.metadataPatch };
    if (project.hidden) {
      metadataPatch.hidden = false;
      metadataPatch.hiddenAt = undefined;
    }
    if (Object.keys(metadataPatch).length > 0) {
      const updated = await dependencies.patchProject(project.id, metadataPatch);
      if (!updated) throw registrationStepFailed('metadata');
      project = updated;
    }

    if (!project.agentId) {
      createdAgent = request.buildAgent(project);
      // The cleanup path removes this ID even if addAgent persists and then
      // throws, covering post-write I/O failures.
      await dependencies.addAgent(createdAgent);
      const updated = await dependencies.patchProject(project.id, {
        agentId: createdAgent.id,
        ...(createdAgent.enabled ? { isAgent: true } : {}),
      });
      if (!updated) throw registrationStepFailed('agent binding');
      project = updated;
    }

    return { project, createdAgent };
  } catch (error) {
    const compensationErrors = await compensateProjectRegistration(
      request,
      dependencies,
      previousProject,
      createdAgent,
    );

    if (compensationErrors.length > 0) {
      const retryCompensation: RetryProjectRegistrationCompensation = () => (
        withWorkspaceRegistrationLock(request.path, async () => {
          const retryErrors = await compensateProjectRegistration(
            request,
            dependencies,
            previousProject,
            createdAgent,
          );
          if (retryErrors.length > 0) {
            throw new ProjectRegistrationCompensationError(error, retryErrors, retryCompensation);
          }
        })
      );
      throw new ProjectRegistrationCompensationError(error, compensationErrors, retryCompensation);
    }
    throw error;
  }
}
