import { describe, expect, it, vi } from 'vitest';

import type { AgentConfig } from '../../../shared/types/agent';
import type { Project } from '../types';
import {
  ProjectRegistrationCompensationError,
  registerProjectWithAgent,
  type ProjectRegistrationDependencies,
} from './projectRegistrationService';

type FailurePoint = 'add-project' | 'metadata' | 'add-agent' | 'agent-binding';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-new',
    name: 'New Agent',
    path: 'D:\\Agents\\new-agent',
    providerId: null,
    permissionMode: null,
    ...overrides,
  };
}

function agentForProject(value: Project): AgentConfig {
  return {
    id: 'agent-new',
    name: value.displayName ?? value.name,
    workspacePath: value.path,
    enabled: false,
    channels: [],
    permissionMode: 'plan',
  };
}

function createHarness(
  initialProjects: Project[] = [],
  failurePoint?: FailurePoint,
) {
  let projects = initialProjects.map(value => ({ ...value }));
  let agents: AgentConfig[] = [];

  const dependencies: ProjectRegistrationDependencies = {
    loadProjects: vi.fn(async () => projects.map(value => ({ ...value }))),
    addProject: vi.fn(async path => {
      let value = projects.find(candidate => candidate.path.toLowerCase() === path.toLowerCase());
      if (value) {
        value = { ...value, lastOpened: '2026-07-13T12:00:00.000Z' };
        projects = projects.map(candidate => candidate.id === value?.id ? value : candidate);
      } else {
        value = project({ path });
        projects.push(value);
      }
      if (failurePoint === 'add-project') throw new Error('add project failed after write');
      return { ...value };
    }),
    patchProject: vi.fn(async (projectId, updates) => {
      const index = projects.findIndex(value => value.id === projectId);
      if (index < 0) return null;
      projects[index] = { ...projects[index], ...updates };
      for (const key of Object.keys(updates) as Array<keyof Omit<Project, 'id'>>) {
        if (updates[key] === undefined) delete projects[index][key];
      }
      const isAgentBinding = 'agentId' in updates;
      if (failurePoint === (isAgentBinding ? 'agent-binding' : 'metadata')) {
        throw new Error(`${isAgentBinding ? 'agent binding' : 'metadata'} failed after write`);
      }
      return { ...projects[index] };
    }),
    addAgent: vi.fn(async value => {
      agents.push({ ...value });
      if (failurePoint === 'add-agent') throw new Error('add agent failed after write');
    }),
    removeAgent: vi.fn(async agentId => {
      agents = agents.filter(value => value.id !== agentId);
    }),
    restoreProject: vi.fn(async (path, previousProject) => {
      projects = projects.filter(value => value.path.toLowerCase() !== path.toLowerCase());
      if (previousProject) projects.push({ ...previousProject });
    }),
  };

  return {
    dependencies,
    projects: () => projects,
    agents: () => agents,
  };
}

const request = {
  path: 'D:\\Agents\\new-agent',
  metadataPatch: {
    displayName: 'Life Manager',
    templateId: 'life-manager',
    templateSource: 'builtin' as const,
  },
  buildAgent: agentForProject,
};

describe('registerProjectWithAgent', () => {
  it('does not write anything when the strict project snapshot cannot be read', async () => {
    const harness = createHarness();
    vi.mocked(harness.dependencies.loadProjects).mockRejectedValueOnce(new Error('registry unreadable'));

    await expect(registerProjectWithAgent(request, harness.dependencies))
      .rejects.toThrow('registry unreadable');

    expect(harness.dependencies.addProject).not.toHaveBeenCalled();
    expect(harness.dependencies.patchProject).not.toHaveBeenCalled();
    expect(harness.dependencies.addAgent).not.toHaveBeenCalled();
    expect(harness.dependencies.restoreProject).not.toHaveBeenCalled();
  });

  it.each<FailurePoint>([
    'add-project',
    'metadata',
    'add-agent',
    'agent-binding',
  ])('removes all partially persisted config after a %s failure', async failurePoint => {
    const harness = createHarness([], failurePoint);

    await expect(registerProjectWithAgent(request, harness.dependencies)).rejects.toThrow();

    expect(harness.projects()).toEqual([]);
    expect(harness.agents()).toEqual([]);
    expect(harness.dependencies.restoreProject).toHaveBeenCalledWith(request.path, null);
  });

  it('restores an existing hidden project exactly when reopening it fails', async () => {
    const previous = project({
      id: 'existing-project',
      hidden: true,
      hiddenAt: '2026-07-01T00:00:00.000Z',
      lastOpened: '2026-06-01T00:00:00.000Z',
    });
    const harness = createHarness([previous], 'agent-binding');

    await expect(registerProjectWithAgent(request, harness.dependencies)).rejects.toThrow();

    expect(harness.projects()).toEqual([previous]);
    expect(harness.agents()).toEqual([]);
    expect(harness.dependencies.patchProject).toHaveBeenNthCalledWith(
      1,
      previous.id,
      expect.objectContaining({ hidden: false, hiddenAt: undefined }),
    );
  });

  it('returns a fully bound project only after every persistence step succeeds', async () => {
    const harness = createHarness();

    const result = await registerProjectWithAgent(request, harness.dependencies);

    expect(result.project).toMatchObject({
      displayName: 'Life Manager',
      templateId: 'life-manager',
      agentId: 'agent-new',
    });
    expect(result.createdAgent?.id).toBe('agent-new');
    expect(harness.projects()).toEqual([result.project]);
    expect(harness.agents()).toEqual([result.createdAgent]);
    expect(harness.dependencies.restoreProject).not.toHaveBeenCalled();
  });

  it('marks an incomplete compensation so the workspace directory is preserved', async () => {
    const harness = createHarness([], 'agent-binding');
    vi.mocked(harness.dependencies.removeAgent).mockRejectedValueOnce(new Error('config locked'));

    const failure = await registerProjectWithAgent(request, harness.dependencies)
      .then(() => null, error => error);

    expect(failure).toBeInstanceOf(ProjectRegistrationCompensationError);
    expect(harness.projects()).toEqual([]);
    expect(harness.agents()).toHaveLength(1);

    await (failure as ProjectRegistrationCompensationError).retryCompensation();
    expect(harness.projects()).toEqual([]);
    expect(harness.agents()).toEqual([]);
  });

  it('serializes registration and compensation for equivalent normalized workspace paths', async () => {
    let releaseFirstRestore!: () => void;
    let markFirstRestoreEntered!: () => void;
    const releaseFirstRestorePromise = new Promise<void>(resolve => { releaseFirstRestore = resolve; });
    const firstRestoreEntered = new Promise<void>(resolve => { markFirstRestoreEntered = resolve; });
    const firstHarness = createHarness([], 'agent-binding');
    const firstRestore = firstHarness.dependencies.restoreProject;
    firstHarness.dependencies.restoreProject = vi.fn(async (path, previousProject) => {
      markFirstRestoreEntered();
      await releaseFirstRestorePromise;
      await firstRestore(path, previousProject);
    });

    const secondHarness = createHarness();

    const firstResult = registerProjectWithAgent(
      { ...request, path: 'D:\\Agents\\new-agent\\' },
      firstHarness.dependencies,
    ).then(() => null, error => error);
    const secondResult = registerProjectWithAgent(
      { ...request, path: 'd:/agents/new-agent' },
      secondHarness.dependencies,
    );

    // Both calls are queued before the first reaches this explicit barrier. If
    // registration were not path-serialized, the second strict snapshot read
    // would necessarily have run before the first compensation got here.
    await firstRestoreEntered;
    expect(secondHarness.dependencies.loadProjects).not.toHaveBeenCalled();

    releaseFirstRestore();
    expect(await firstResult).toBeInstanceOf(Error);
    await expect(secondResult).resolves.toMatchObject({
      project: { agentId: 'agent-new' },
    });
    expect(secondHarness.dependencies.loadProjects).toHaveBeenCalledTimes(1);
  });
});
