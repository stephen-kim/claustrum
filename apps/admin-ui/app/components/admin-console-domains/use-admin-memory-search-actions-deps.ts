import type { AdminMemorySearchState } from './use-admin-memory-search-state';
import type { AdminCallApi, AdminCallApiRaw } from './types';

export type MemorySearchDeps = {
  callApi: AdminCallApi;
  callApiRaw: AdminCallApiRaw;
  selectedWorkspace: string;
  selectedProject: string;
  state: AdminMemorySearchState;
  setError: (message: string | null) => void;
};
