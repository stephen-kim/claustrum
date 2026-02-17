'use client';

import type { FormEvent } from 'react';
import type { ImportItem, ImportSource, StagedMemoryItem } from '../lib/types';
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
} from './ui';

type Props = {
  uploadImport: (event: FormEvent) => void | Promise<void>;
  importSource: ImportSource;
  setImportSource: (value: ImportSource) => void;
  setImportFile: (file: File | null) => void;
  importUseSelectedProject: boolean;
  setImportUseSelectedProject: (value: boolean) => void;
  imports: ImportItem[];
  setSelectedImportId: (id: string) => void;
  parseImport: (id: string) => Promise<void>;
  extractImport: (id: string) => Promise<void>;
  loadStagedMemories: (id: string) => Promise<void>;
  selectedImport: ImportItem | null;
  stagedMemories: StagedMemoryItem[];
  selectedStagedIds: string[];
  toggleStagedMemory: (id: string, selected: boolean) => void;
  selectedImportId: string;
  commitImport: (id: string) => Promise<void>;
};

export function ImportsPanel(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Imports</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="stack" onSubmit={props.uploadImport}>
          <div className="row">
            <Select
              value={props.importSource}
              onChange={(event) => props.setImportSource(event.target.value as ImportSource)}
            >
              <option value="codex">codex</option>
              <option value="claude">claude</option>
              <option value="generic">generic</option>
            </Select>
            <Input type="file" onChange={(event) => props.setImportFile(event.target.files?.[0] || null)} required />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="import-bind-selected-project"
              checked={props.importUseSelectedProject}
              onCheckedChange={(value) => props.setImportUseSelectedProject(value === true)}
            />
            <label htmlFor="import-bind-selected-project" className="text-sm text-muted-foreground">
              bind imported raw session to selected project when possible
            </label>
          </div>
          <Button type="submit">Upload Import</Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.imports.map((item) => (
              <TableRow key={item.id} onClick={() => props.setSelectedImportId(item.id)}>
                <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                <TableCell>{item.source}</TableCell>
                <TableCell>
                  <Badge>{item.status}</Badge>
                </TableCell>
                <TableCell>{item.fileName}</TableCell>
                <TableCell>
                  <div className="inline-actions">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        props.setSelectedImportId(item.id);
                        void props.parseImport(item.id);
                      }}
                    >
                      parse
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        props.setSelectedImportId(item.id);
                        void props.extractImport(item.id);
                      }}
                    >
                      extract
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        props.setSelectedImportId(item.id);
                        void props.loadStagedMemories(item.id);
                      }}
                    >
                      staged
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Staged Memories</h3>
        {props.selectedImport ? (
          <div className="muted">
            selected import: <strong>{props.selectedImport.fileName}</strong> ({props.selectedImport.status})
          </div>
        ) : (
          <div className="muted">Select an import row.</div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Select</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Content</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.stagedMemories.map((candidate) => (
              <TableRow key={candidate.id}>
                <TableCell>
                  <Checkbox
                    checked={props.selectedStagedIds.includes(candidate.id)}
                    onCheckedChange={(value) => props.toggleStagedMemory(candidate.id, value === true)}
                  />
                </TableCell>
                <TableCell>{candidate.type}</TableCell>
                <TableCell>{candidate.project?.key || '-'}</TableCell>
                <TableCell>{candidate.content}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="toolbar">
          <Button
            type="button"
            disabled={!props.selectedImportId || props.selectedStagedIds.length === 0}
            onClick={() => void props.commitImport(props.selectedImportId)}
          >
            Commit Selected ({props.selectedStagedIds.length})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
