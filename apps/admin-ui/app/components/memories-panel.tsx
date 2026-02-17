'use client';

import type { FormEvent } from 'react';
import { MEMORY_TYPES, type MemoryItem } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from './ui';

type Props = {
  runMemorySearch: (event?: FormEvent) => void | Promise<void>;
  queryText: string;
  setQueryText: (value: string) => void;
  queryType: string;
  setQueryType: (value: string) => void;
  queryMode: 'hybrid' | 'keyword' | 'semantic';
  setQueryMode: (value: 'hybrid' | 'keyword' | 'semantic') => void;
  queryStatus: '' | 'draft' | 'confirmed' | 'rejected';
  setQueryStatus: (value: '' | 'draft' | 'confirmed' | 'rejected') => void;
  querySource: '' | 'auto' | 'human' | 'import';
  setQuerySource: (value: '' | 'auto' | 'human' | 'import') => void;
  queryConfidenceMin: string;
  setQueryConfidenceMin: (value: string) => void;
  queryConfidenceMax: string;
  setQueryConfidenceMax: (value: string) => void;
  querySince: string;
  setQuerySince: (value: string) => void;
  queryLimit: number;
  setQueryLimit: (value: number) => void;
  scopeSelectedProject: boolean;
  setScopeSelectedProject: (value: boolean) => void;
  memories: MemoryItem[];
  setSelectedMemoryId: (id: string) => void;
  createMemory: (event: FormEvent) => void | Promise<void>;
  newMemoryType: string;
  setNewMemoryType: (value: string) => void;
  selectedProject: string;
  newMemoryContent: string;
  setNewMemoryContent: (value: string) => void;
  newMemoryMetadata: string;
  setNewMemoryMetadata: (value: string) => void;
  selectedMemory: MemoryItem | null;
  selectedMemoryDraftContent: string;
  setSelectedMemoryDraftContent: (value: string) => void;
  updateSelectedMemoryStatus: (status: 'draft' | 'confirmed' | 'rejected') => Promise<void> | void;
  saveSelectedMemoryContent: () => Promise<void> | void;
};

export function MemoriesPanel(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Decisions & Memories</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="stack" onSubmit={props.runMemorySearch}>
          <div className="row">
            <Input
              value={props.queryText}
              onChange={(event) => props.setQueryText(event.target.value)}
              placeholder="search content"
            />
            <Select
              value={props.queryMode}
              onChange={(event) =>
                props.setQueryMode(event.target.value as 'hybrid' | 'keyword' | 'semantic')
              }
            >
              <option value="hybrid">hybrid</option>
              <option value="keyword">keyword</option>
              <option value="semantic">semantic</option>
            </Select>
            <Select value={props.queryType} onChange={(event) => props.setQueryType(event.target.value)}>
              <option value="">All types</option>
              {MEMORY_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div className="row">
            <Select
              value={props.queryStatus}
              onChange={(event) =>
                props.setQueryStatus(event.target.value as '' | 'draft' | 'confirmed' | 'rejected')
              }
            >
              <option value="">all status</option>
              <option value="draft">draft</option>
              <option value="confirmed">confirmed</option>
              <option value="rejected">rejected</option>
            </Select>
            <Select
              value={props.querySource}
              onChange={(event) => props.setQuerySource(event.target.value as '' | 'auto' | 'human' | 'import')}
            >
              <option value="">all source</option>
              <option value="auto">auto</option>
              <option value="human">human</option>
              <option value="import">import</option>
            </Select>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={props.queryConfidenceMin}
              onChange={(event) => props.setQueryConfidenceMin(event.target.value)}
              placeholder="confidence min"
            />
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={props.queryConfidenceMax}
              onChange={(event) => props.setQueryConfidenceMax(event.target.value)}
              placeholder="confidence max"
            />
          </div>
          <div className="row">
            <Input
              type="datetime-local"
              value={props.querySince}
              onChange={(event) => props.setQuerySince(event.target.value)}
            />
            <Input
              type="number"
              min={1}
              max={200}
              value={props.queryLimit}
              onChange={(event) => props.setQueryLimit(Number(event.target.value))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="scope-selected-project"
              checked={props.scopeSelectedProject}
              onCheckedChange={(value) => props.setScopeSelectedProject(value === true)}
            />
            <label htmlFor="scope-selected-project" className="text-sm text-muted-foreground">
              scope to selected project
            </label>
          </div>
          <div className="toolbar">
            <Button type="submit">Search</Button>
            <Button variant="ghost" type="button" onClick={() => void props.runMemorySearch()}>
              Refresh
            </Button>
          </div>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Content</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.memories.map((memory) => (
              <TableRow key={memory.id} onClick={() => props.setSelectedMemoryId(memory.id)}>
                <TableCell>{new Date(memory.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge>{memory.type}</Badge>
                </TableCell>
                <TableCell>{memory.status || '-'}</TableCell>
                <TableCell>{memory.source || '-'}</TableCell>
                <TableCell>
                  {typeof memory.confidence === 'number' ? memory.confidence.toFixed(2) : '-'}
                </TableCell>
                <TableCell>
                  {memory.project.workspace.key}/{memory.project.key}
                </TableCell>
                <TableCell>{memory.content}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Create Memory</h3>
        <form className="stack" onSubmit={props.createMemory}>
          <div className="row">
            <Select value={props.newMemoryType} onChange={(event) => props.setNewMemoryType(event.target.value)}>
              {MEMORY_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Input value={props.selectedProject} readOnly />
          </div>
          <Textarea
            value={props.newMemoryContent}
            onChange={(event) => props.setNewMemoryContent(event.target.value)}
            placeholder="memory content"
            required
          />
          <Textarea
            value={props.newMemoryMetadata}
            onChange={(event) => props.setNewMemoryMetadata(event.target.value)}
            placeholder='{"source":"admin-ui"}'
          />
          <Button type="submit">Store Memory</Button>
        </form>

        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Memory Detail</h3>
        {props.selectedMemory ? (
          <div className="stack">
            <Textarea
              value={props.selectedMemoryDraftContent}
              onChange={(event) => props.setSelectedMemoryDraftContent(event.target.value)}
              rows={6}
            />
            <div className="toolbar">
              <Button type="button" variant="secondary" onClick={() => void props.saveSelectedMemoryContent()}>
                Save Content
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void props.updateSelectedMemoryStatus('confirmed')}
              >
                Confirm
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void props.updateSelectedMemoryStatus('rejected')}
              >
                Reject
              </Button>
              <Button type="button" variant="ghost" onClick={() => void props.updateSelectedMemoryStatus('draft')}>
                Back to Draft
              </Button>
            </div>
            <pre>{JSON.stringify(props.selectedMemory, null, 2)}</pre>
          </div>
        ) : (
          <div className="muted">Select a memory row to inspect details.</div>
        )}
      </CardContent>
    </Card>
  );
}
