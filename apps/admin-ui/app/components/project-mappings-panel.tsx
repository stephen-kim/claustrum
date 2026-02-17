'use client';

import type { FormEvent } from 'react';
import type { Project, ProjectMapping, ResolutionKind } from '../lib/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui';

const RESOLUTION_KINDS: ResolutionKind[] = ['github_remote', 'repo_root_slug', 'manual'];

type Props = {
  mappingReason: string;
  setMappingReason: (value: string) => void;
  createProjectMapping: (event: FormEvent) => void | Promise<void>;
  newMappingKind: ResolutionKind;
  setNewMappingKind: (kind: ResolutionKind) => void;
  newMappingProjectKey: string;
  setNewMappingProjectKey: (key: string) => void;
  newMappingExternalId: string;
  setNewMappingExternalId: (value: string) => void;
  newMappingPriority: string;
  setNewMappingPriority: (value: string) => void;
  newMappingEnabled: boolean;
  setNewMappingEnabled: (value: boolean) => void;
  projects: Project[];
  mappings: ProjectMapping[];
  patchMapping: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

export function ProjectMappingsPanel(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Mappings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="stack gap-1">
          <Label className="muted">Reason (for add/update audit)</Label>
          <Input
            value={props.mappingReason}
            onChange={(event) => props.setMappingReason(event.target.value)}
            placeholder="why this mapping changed"
          />
        </div>

        <form className="stack" onSubmit={props.createProjectMapping}>
          <div className="row">
            <Select
              value={props.newMappingKind}
              onChange={(event) => props.setNewMappingKind(event.target.value as ResolutionKind)}
            >
              {RESOLUTION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </Select>
            <Select
              value={props.newMappingProjectKey}
              onChange={(event) => props.setNewMappingProjectKey(event.target.value)}
            >
              {props.projects.map((project) => (
                <option key={project.id} value={project.key}>
                  {project.key}
                </option>
              ))}
            </Select>
          </div>
          <div className="row">
            <Input
              value={props.newMappingExternalId}
              onChange={(event) => props.setNewMappingExternalId(event.target.value)}
              placeholder="external id (owner/repo or slug)"
              required
            />
            <Input
              value={props.newMappingPriority}
              onChange={(event) => props.setNewMappingPriority(event.target.value)}
              placeholder="priority (optional)"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="new-mapping-enabled"
              checked={props.newMappingEnabled}
              onCheckedChange={(value) => props.setNewMappingEnabled(value === true)}
            />
            <Label htmlFor="new-mapping-enabled" className="text-sm text-muted-foreground">
              enabled
            </Label>
          </div>
          <Button type="submit">Add Mapping</Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>External Id</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.mappings.map((mapping) => (
              <TableRow key={mapping.id}>
                <TableCell>{mapping.kind}</TableCell>
                <TableCell>
                  <Input
                    defaultValue={mapping.external_id}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value && value !== mapping.external_id) {
                        void props.patchMapping(mapping.id, { external_id: value });
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={mapping.project.key}
                    onChange={(event) => void props.patchMapping(mapping.id, { project_key: event.target.value })}
                  >
                    {props.projects.map((project) => (
                      <option key={project.id} value={project.key}>
                        {project.key}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    defaultValue={mapping.priority}
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isNaN(value) && value !== mapping.priority) {
                        void props.patchMapping(mapping.id, { priority: value });
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={mapping.is_enabled}
                    onCheckedChange={(value) => void props.patchMapping(mapping.id, { is_enabled: value === true })}
                  />
                </TableCell>
                <TableCell>
                  <div className="inline-actions">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void props.patchMapping(mapping.id, { priority: Math.max(0, mapping.priority - 1) })}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void props.patchMapping(mapping.id, { priority: mapping.priority + 1 })}
                    >
                      ↓
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
