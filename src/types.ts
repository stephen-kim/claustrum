export interface ProjectContext {
  id: string;
  name: string;
  path?: string;
  architecture?: string;
  techStack: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Decision {
  id: string;
  projectId: string;
  type: 'architecture' | 'library' | 'pattern' | 'configuration' | 'other';
  description: string;
  reasoning?: string;
  timestamp: Date;
}
