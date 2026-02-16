import type { ResolutionKind } from './types';

export function toISOString(localDateTime: string): string | null {
  const date = new Date(localDateTime);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function reorderKinds(
  order: ResolutionKind[],
  from: ResolutionKind,
  to: ResolutionKind
): ResolutionKind[] {
  const list = [...order];
  const fromIndex = list.indexOf(from);
  const toIndex = list.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) {
    return order;
  }
  list.splice(fromIndex, 1);
  list.splice(toIndex, 0, from);
  return list;
}

export function kindDescription(kind: ResolutionKind): string {
  if (kind === 'github_remote') {
    return 'git remote origin에서 owner/repo 추출 후 매핑';
  }
  if (kind === 'repo_root_slug') {
    return 'repo root basename slug로 매핑';
  }
  return '사용자 지정 manual project key 선택';
}
