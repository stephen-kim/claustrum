'use client';

import type { FormEvent } from 'react';
import type { Project } from '../lib/types';
import { isSubprojectKey } from '../lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui';

type ProjectViewFilter = 'all' | 'repo_only' | 'subprojects_only';

type Props = {
  projects: Project[];
  selectedProject: string;
  setSelectedProject: (key: string) => void;
  projectViewFilter: ProjectViewFilter;
  setProjectViewFilter: (value: ProjectViewFilter) => void;
  createProject: (event: FormEvent) => void | Promise<void>;
  newProjectKey: string;
  setNewProjectKey: (value: string) => void;
  newProjectName: string;
  setNewProjectName: (value: string) => void;
};

export function ProjectsPanel(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="stack gap-1">
          <label className="muted">Project filter</label>
          <Select
            value={props.projectViewFilter}
            onChange={(event) => props.setProjectViewFilter(event.target.value as ProjectViewFilter)}
          >
            <option value="all">all</option>
            <option value="repo_only">repo only</option>
            <option value="subprojects_only">subprojects only</option>
          </Select>
        </div>
        <div className="list">
          {props.projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={project.key === props.selectedProject ? 'active' : ''}
              onClick={() => props.setSelectedProject(project.key)}
            >
              <strong>{project.name}</strong>
              <div className="muted">{project.key}</div>
              <div className="mt-1">
                <Badge variant={isSubprojectKey(project.key) ? 'default' : 'secondary'}>
                  {isSubprojectKey(project.key) ? 'subproject' : 'repo'}
                </Badge>
              </div>
            </button>
          ))}
        </div>
        <form className="row" onSubmit={props.createProject}>
          <Input
            value={props.newProjectKey}
            onChange={(event) => props.setNewProjectKey(event.target.value)}
            placeholder="project key"
            required
          />
          <Input
            value={props.newProjectName}
            onChange={(event) => props.setNewProjectName(event.target.value)}
            placeholder="project name"
            required
          />
          <Button type="submit" className="md:col-span-2">
            Create Project
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
