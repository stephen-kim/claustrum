import test from 'node:test';
import assert from 'node:assert/strict';
import { decideContextTransition, splitProjectKey, type SessionState } from './context-policy.js';

function baseState(): SessionState {
  return {
    currentProjectKey: null,
    currentRepoKey: null,
    currentSubprojectKey: null,
    pinMode: false,
  };
}

test('auto-switches when moving repo A to repo B', () => {
  const decision = decideContextTransition(
    {
      currentProjectKey: 'github:acme/repo-a',
      currentRepoKey: 'github:acme/repo-a',
      currentSubprojectKey: null,
      pinMode: false,
    },
    { autoSwitchRepo: true, autoSwitchSubproject: false },
    {
      projectKey: 'github:acme/repo-b',
      repoKey: 'github:acme/repo-b',
      subprojectKey: null,
    }
  );
  assert.equal(decision.switched, true);
  assert.equal(decision.reason, 'repo_changed');
  assert.equal(decision.next.currentProjectKey, 'github:acme/repo-b');
});

test('does not switch subproject when auto_switch_subproject is false', () => {
  const decision = decideContextTransition(
    {
      currentProjectKey: 'github:acme/mono',
      currentRepoKey: 'github:acme/mono',
      currentSubprojectKey: 'apps/admin-ui',
      pinMode: false,
    },
    { autoSwitchRepo: true, autoSwitchSubproject: false },
    {
      projectKey: 'github:acme/mono#apps/memory-core',
      repoKey: 'github:acme/mono',
      subprojectKey: 'apps/memory-core',
    }
  );
  assert.equal(decision.switched, false);
  assert.equal(decision.reason, 'subproject_switch_disabled');
  assert.equal(decision.next.currentProjectKey, 'github:acme/mono');
});

test('switches subproject when auto_switch_subproject is true', () => {
  const decision = decideContextTransition(
    {
      currentProjectKey: 'github:acme/mono#apps/admin-ui',
      currentRepoKey: 'github:acme/mono',
      currentSubprojectKey: 'apps/admin-ui',
      pinMode: false,
    },
    { autoSwitchRepo: true, autoSwitchSubproject: true },
    {
      projectKey: 'github:acme/mono#apps/memory-core',
      repoKey: 'github:acme/mono',
      subprojectKey: 'apps/memory-core',
    }
  );
  assert.equal(decision.switched, true);
  assert.equal(decision.reason, 'subproject_changed');
  assert.equal(decision.next.currentProjectKey, 'github:acme/mono#apps/memory-core');
});

test('pin mode keeps current project even when cwd context changes', () => {
  const decision = decideContextTransition(
    {
      currentProjectKey: 'github:acme/mono#apps/admin-ui',
      currentRepoKey: 'github:acme/mono',
      currentSubprojectKey: 'apps/admin-ui',
      pinMode: true,
    },
    { autoSwitchRepo: true, autoSwitchSubproject: true },
    {
      projectKey: 'github:acme/mono#apps/memory-core',
      repoKey: 'github:acme/mono',
      subprojectKey: 'apps/memory-core',
    }
  );
  assert.equal(decision.switched, false);
  assert.equal(decision.reason, 'pin_mode');
  assert.equal(decision.next.currentProjectKey, 'github:acme/mono#apps/admin-ui');
});

test('unset pin allows automatic switching again', () => {
  const pinned = {
    currentProjectKey: 'github:acme/mono#apps/admin-ui',
    currentRepoKey: 'github:acme/mono',
    currentSubprojectKey: 'apps/admin-ui',
    pinMode: true,
  };
  const unpinned: SessionState = { ...pinned, pinMode: false };
  const decision = decideContextTransition(
    unpinned,
    { autoSwitchRepo: true, autoSwitchSubproject: true },
    {
      projectKey: 'github:acme/mono#apps/memory-core',
      repoKey: 'github:acme/mono',
      subprojectKey: 'apps/memory-core',
    }
  );
  assert.equal(decision.switched, true);
  assert.equal(decision.next.currentProjectKey, 'github:acme/mono#apps/memory-core');
});

test('splitProjectKey parses repo/subproject forms', () => {
  assert.deepEqual(splitProjectKey('github:acme/mono#apps/memory-core'), {
    repoKey: 'github:acme/mono',
    subprojectKey: 'apps/memory-core',
  });
  assert.deepEqual(splitProjectKey('github:acme/mono:apps/admin-ui'), {
    repoKey: 'github:acme/mono',
    subprojectKey: 'apps/admin-ui',
  });
  assert.deepEqual(splitProjectKey('github:acme/mono'), {
    repoKey: 'github:acme/mono',
    subprojectKey: null,
  });
  assert.deepEqual(splitProjectKey(baseState().currentProjectKey || ''), {
    repoKey: '',
    subprojectKey: null,
  });
});
