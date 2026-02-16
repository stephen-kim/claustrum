export const MCP_PROMPTS = [
  {
    name: 'context-sync-usage',
    description: 'Complete guide on how to use Context Sync effectively as an AI agent',
  },
  {
    name: 'debugging-context-sync',
    description: 'How to debug Context Sync when things go wrong',
  },
] as const;

export const MCP_RESOURCES = [
  {
    uri: 'context-sync://docs/usage-guide',
    mimeType: 'text/markdown',
    name: 'Context Sync Usage Guide',
    description: 'Complete guide on how to use Context Sync effectively as an AI agent',
  },
  {
    uri: 'context-sync://docs/debugging-guide',
    mimeType: 'text/markdown',
    name: 'Debugging Context Sync',
    description: 'How to debug Context Sync when things go wrong',
  },
  {
    uri: 'context-sync://docs/tool-flow',
    mimeType: 'text/markdown',
    name: 'Tool Flow Patterns',
    description: 'Common tool usage patterns and workflows',
  },
] as const;

const USAGE_PROMPT_TEXT = `# Context Sync - AI Agent Usage Guide

## Core Philosophy
Context Sync is a memory system for project continuity. Use it to keep architecture, constraints, and active work synchronized across sessions.

## Recommended Tool Flow
1. set_project({ key })
2. structure() / search() / read_file()
3. remember() for decisions, constraints, and active work
4. recall() at session start or before major changes

## Common Mistakes
- Calling tools before set_project
- Using inconsistent project keys
- Skipping recall during handoff ("continue", "good morning")
`;

const DEBUG_PROMPT_TEXT = `# Debugging Context Sync

## Quick Checks
1. set_project({ key }) succeeds
2. structure() returns files
3. remember() writes
4. recall() returns recent memory

## Frequent Failures
- No project set: initialize project first
- Unexpected detection: inspect root files with structure()
- Empty results: verify active project key and scope
`;

const TOOL_FLOW_TEXT = `# Tool Flow Patterns

## New Project
1. set_project
2. structure
3. search
4. read_file
5. remember(active_work)

## Debug Session
1. recall
2. git_status
3. git_context
4. remember(problem)

## Morning Handoff
1. set_project
2. recall(active work + decisions)
3. git_status
4. structure
`;

export function getPromptText(name: string): string | null {
  if (name === 'context-sync-usage') {
    return USAGE_PROMPT_TEXT;
  }
  if (name === 'debugging-context-sync') {
    return DEBUG_PROMPT_TEXT;
  }
  return null;
}

export function getResourceText(uri: string): string | null {
  if (uri === 'context-sync://docs/usage-guide') {
    return USAGE_PROMPT_TEXT;
  }
  if (uri === 'context-sync://docs/debugging-guide') {
    return DEBUG_PROMPT_TEXT;
  }
  if (uri === 'context-sync://docs/tool-flow') {
    return TOOL_FLOW_TEXT;
  }
  return null;
}
