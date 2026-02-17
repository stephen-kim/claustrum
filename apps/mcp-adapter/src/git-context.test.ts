import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveMonorepoCandidateSubpath,
  deriveRelativePath,
  parseGitRemoteUrl,
  slugifyRepoRootName,
} from './git-context.js';

test('parseGitRemoteUrl parses ssh form', () => {
  const parsed = parseGitRemoteUrl('git@github.com:openai/claustrum.git');
  assert.ok(parsed);
  assert.equal(parsed.host, 'github.com');
  assert.equal(parsed.owner, 'openai');
  assert.equal(parsed.repo, 'claustrum');
  assert.equal(parsed.normalized, 'openai/claustrum');
});

test('parseGitRemoteUrl parses https form', () => {
  const parsed = parseGitRemoteUrl('https://github.com/OpenAI/claustrum.git');
  assert.ok(parsed);
  assert.equal(parsed.host, 'github.com');
  assert.equal(parsed.owner, 'OpenAI');
  assert.equal(parsed.repo, 'claustrum');
  assert.equal(parsed.normalized, 'OpenAI/claustrum');
});

test('parseGitRemoteUrl returns null for invalid value', () => {
  const parsed = parseGitRemoteUrl('not-a-remote');
  assert.equal(parsed, null);
});

test('slugifyRepoRootName normalizes basename', () => {
  assert.equal(slugifyRepoRootName('Video Transcriber'), 'video-transcriber');
  assert.equal(slugifyRepoRootName('My_repo!!!'), 'my-repo');
  assert.equal(slugifyRepoRootName('___'), 'project');
});

test('deriveRelativePath returns repo-local relative path', () => {
  assert.equal(
    deriveRelativePath('/repo/apps/memory-core/src', '/repo'),
    'apps/memory-core/src'
  );
  assert.equal(deriveRelativePath('/repo', '/repo'), null);
  assert.equal(deriveRelativePath('/other/path', '/repo'), null);
});

test('deriveMonorepoCandidateSubpath picks default apps/packages workspace root', () => {
  assert.equal(
    deriveMonorepoCandidateSubpath('apps/memory-core/src/routes'),
    'apps/memory-core'
  );
  assert.equal(
    deriveMonorepoCandidateSubpath('packages/shared/src'),
    'packages/shared'
  );
});

test('deriveMonorepoCandidateSubpath supports custom globs', () => {
  assert.equal(
    deriveMonorepoCandidateSubpath('services/gateway/http', ['services/*'], 3),
    'services/gateway'
  );
  assert.equal(
    deriveMonorepoCandidateSubpath('services/platform/api/http', ['services/*/*'], 3),
    'services/platform/api'
  );
});
