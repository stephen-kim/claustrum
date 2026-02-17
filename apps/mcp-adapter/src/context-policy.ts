export type SessionState = {
  currentProjectKey: string | null;
  currentRepoKey: string | null;
  currentSubprojectKey: string | null;
  pinMode: boolean;
};

export type EnsureContextSettings = {
  autoSwitchRepo: boolean;
  autoSwitchSubproject: boolean;
};

export type ResolvedContextCandidate = {
  projectKey: string;
  repoKey: string;
  subprojectKey: string | null;
};

export type ContextDecision = {
  switched: boolean;
  reason:
    | 'pin_mode'
    | 'initial'
    | 'repo_changed'
    | 'subproject_changed'
    | 'repo_switch_disabled'
    | 'subproject_switch_disabled'
    | 'unchanged';
  next: SessionState;
};

export function decideContextTransition(
  state: SessionState,
  settings: EnsureContextSettings,
  candidate: ResolvedContextCandidate
): ContextDecision {
  if (state.pinMode) {
    return {
      switched: false,
      reason: 'pin_mode',
      next: { ...state },
    };
  }

  if (!state.currentProjectKey || !state.currentRepoKey) {
    return {
      switched: true,
      reason: 'initial',
      next: {
        currentProjectKey: candidate.projectKey,
        currentRepoKey: candidate.repoKey,
        currentSubprojectKey: candidate.subprojectKey,
        pinMode: false,
      },
    };
  }

  if (state.currentRepoKey !== candidate.repoKey) {
    if (!settings.autoSwitchRepo) {
      return {
        switched: false,
        reason: 'repo_switch_disabled',
        next: { ...state },
      };
    }
    return {
      switched: true,
      reason: 'repo_changed',
      next: {
        currentProjectKey: candidate.projectKey,
        currentRepoKey: candidate.repoKey,
        currentSubprojectKey: candidate.subprojectKey,
        pinMode: false,
      },
    };
  }

  const currentSubproject = state.currentSubprojectKey || null;
  const nextSubproject = candidate.subprojectKey || null;
  if (currentSubproject !== nextSubproject) {
    if (!settings.autoSwitchSubproject) {
      return {
        switched: false,
        reason: 'subproject_switch_disabled',
        next: { ...state },
      };
    }
    return {
      switched: true,
      reason: 'subproject_changed',
      next: {
        currentProjectKey: candidate.projectKey,
        currentRepoKey: candidate.repoKey,
        currentSubprojectKey: candidate.subprojectKey,
        pinMode: false,
      },
    };
  }

  return {
    switched: false,
    reason: 'unchanged',
    next: { ...state },
  };
}

export function splitProjectKey(projectKey: string): {
  repoKey: string;
  subprojectKey: string | null;
} {
  const hashIndex = projectKey.indexOf('#');
  if (hashIndex > 0 && hashIndex < projectKey.length - 1) {
    return {
      repoKey: projectKey.slice(0, hashIndex),
      subprojectKey: projectKey.slice(hashIndex + 1),
    };
  }

  const colonIndex = findSubprojectColon(projectKey);
  if (colonIndex > 0 && colonIndex < projectKey.length - 1) {
    return {
      repoKey: projectKey.slice(0, colonIndex),
      subprojectKey: projectKey.slice(colonIndex + 1),
    };
  }

  return { repoKey: projectKey, subprojectKey: null };
}

function findSubprojectColon(value: string): number {
  const schemeIndex = value.indexOf(':');
  if (schemeIndex < 0) {
    return -1;
  }
  return value.indexOf(':', schemeIndex + 1);
}
