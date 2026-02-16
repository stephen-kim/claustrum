import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGitRemoteUrl, slugifyRepoRootName } from './git-context.js';

test('parseGitRemoteUrl parses ssh form', () => {
  const parsed = parseGitRemoteUrl('git@github.com:openai/context-sync.git');
  assert.ok(parsed);
  assert.equal(parsed.host, 'github.com');
  assert.equal(parsed.owner, 'openai');
  assert.equal(parsed.repo, 'context-sync');
  assert.equal(parsed.normalized, 'openai/context-sync');
});

test('parseGitRemoteUrl parses https form', () => {
  const parsed = parseGitRemoteUrl('https://github.com/OpenAI/context-sync.git');
  assert.ok(parsed);
  assert.equal(parsed.host, 'github.com');
  assert.equal(parsed.owner, 'OpenAI');
  assert.equal(parsed.repo, 'context-sync');
  assert.equal(parsed.normalized, 'OpenAI/context-sync');
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
