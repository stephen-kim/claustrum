/**
 * Context Sync Server - Core Simplification
 * 8 essential tools, everything else is internal
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Storage } from './storage.js';
import { ProjectDetector } from './project-detector.js';
import { WorkspaceDetector } from './workspace-detector.js';
import { CORE_TOOLS } from './core-tools.js';
import type { ProjectIdentity, RememberInput, RecallResult } from './context-layers.js';
import { ProjectProfiler } from './project-profiler.js';
import { RecallEngine } from './recall-engine.js';
import { RememberEngine } from './remember-engine.js';
import { ReadFileEngine } from './read-file-engine.js';
import { SearchEngine } from './search-engine.js';
import { StructureEngine } from './structure-engine.js';
import { GitStatusEngine } from './git-status-engine.js';
import { GitContextEngine } from './git-context-engine.js';
import { GitIntegration } from './git-integration.js';
import { GitHookManager } from './git-hook-manager.js';
import { NotionIntegration } from './notion-integration.js';
import { createNotionHandlers } from './notion-handlers.js';
import { logger } from './logger.js';
import { normalizeProjectKey } from './project-key.js';
import {
  MCP_PROMPTS,
  MCP_RESOURCES,
  getPromptText,
  getResourceText,
} from './server-docs.js';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

type PromptRequest = { params: { name: string } };
type ResourceRequest = { params: { uri: string } };
type ToolCallRequest = { params: { name: string; arguments?: unknown } };

export class ContextSyncServer {
  private server: Server;
  private storage: Storage;
  private projectDetector: ProjectDetector;
  private workspaceDetector: WorkspaceDetector;
  private notionIntegration: NotionIntegration | null = null;
  private notionHandlers: ReturnType<typeof createNotionHandlers>;
  
  // Session-specific current project
  private currentProjectKey: string | null = null;

  constructor() {
    this.storage = new Storage();
    this.projectDetector = new ProjectDetector(this.storage);
    this.workspaceDetector = new WorkspaceDetector(this.storage, this.projectDetector);

    // Initialize with null integration (will be set up if config exists)
    this.notionHandlers = createNotionHandlers(null);

    // Initialize Notion integration (optional - gracefully handles missing config)
    this.initializeNotion();

    this.server = new Server(
      {
        name: 'context-sync',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Initialize Notion integration from user config
   */
  private async initializeNotion(): Promise<void> {
    try {
      const configPath = path.join(os.homedir(), '.context-sync', 'config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      if (config.notion?.token) {
        this.notionIntegration = new NotionIntegration({
          token: config.notion.token,
          defaultParentPageId: config.notion.defaultParentPageId
        });
      }
    } catch {
      // Config doesn't exist or invalid - Notion not configured
      this.notionIntegration = null;
    }
    
    // Always create handlers (they handle null gracefully)
    this.notionHandlers = createNotionHandlers(this.notionIntegration);
  }

  private setupHandlers(): void {
    // List our 8 core tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: CORE_TOOLS,
    }));

    // List available prompts (AI usage instructions)
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [...MCP_PROMPTS],
    }));

    // Get prompt content
    this.server.setRequestHandler(GetPromptRequestSchema, async (request: PromptRequest) => {
      const { name } = request.params;
      const text = getPromptText(name);
      if (!text) {
        throw new Error(`Unknown prompt: ${name}`);
      }
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text,
            },
          },
        ],
      };
    });

    // List available resources (AI documentation)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [...MCP_RESOURCES],
    }));

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request: ResourceRequest) => {
      const { uri } = request.params;
      const text = getResourceText(uri);
      if (!text) {
        throw new Error(`Unknown resource: ${uri}`);
      }
      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text,
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: ToolCallRequest) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'set_project':
          return await this.handleSetProject(args as any);
        case 'remember':
          return await this.handleRemember(args as any);
        case 'recall':
          return await this.handleRecall(args as any);
        case 'read_file':
          return await this.handleReadFile(args as any);
        case 'search':
          return await this.handleSearch(args as any);
        case 'structure':
          return await this.handleStructure(args as any);
        case 'git':
          return await this.handleGit(args as any);
        case 'notion':
          return await this.handleNotion(args as any);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  // ========== CORE HANDLERS ==========

  /**
   * Initialize or switch logical project scope.
   */
  private async handleSetProject(args: {
    key: string;
    label?: string;
    metadata?: Record<string, unknown>;
    enable_git_hooks?: boolean;
  }) {
    try {
      const keyInput = args.key?.trim();
      if (!keyInput) {
        return {
          content: [{
            type: 'text',
            text: 'Missing required argument: key',
          }],
          isError: true,
        };
      }

      const key = normalizeProjectKey(keyInput);
      const label = args.label?.trim() || key;
      const metadataInput =
        args.metadata && typeof args.metadata === 'object' && !Array.isArray(args.metadata)
          ? args.metadata
          : {};
      const metadata = {
        ...metadataInput,
      };
      const enableGitHooks = args.enable_git_hooks === true;

      // Key-only mode: default workspace is the current process CWD.
      let workspaceSet = false;
      try {
        this.workspaceDetector.setWorkspace(process.cwd());
        workspaceSet = true;
      } catch (error) {
        logger.warn('Workspace attachment failed', error);
      }

      let profileSummary = '';
      if (workspaceSet) {
        try {
          const analysis = await ProjectProfiler.analyze(process.cwd());
          await this.storage.upsertProjectMetrics({
            projectKey: key,
            linesOfCode: analysis.metrics.linesOfCode,
            fileCount: analysis.metrics.fileCount,
            complexity:
              analysis.metrics.complexity === null || analysis.metrics.complexity === undefined
                ? null
                : String(analysis.metrics.complexity),
            contributors: 0,
            lastCommit: null,
            hotspots: [],
          });
          profileSummary =
            `\nTech stack: ${analysis.techStack.join(', ') || 'unknown'}\n` +
            `Architecture: ${analysis.architecture || 'unknown'}\n` +
            `Metrics: ${analysis.metrics.linesOfCode.toLocaleString()} LOC, ${analysis.metrics.fileCount} files`;
        } catch (error) {
          logger.warn('Project profiling failed', error);
        }
      }

      const project = await this.storage.upsertProject({
        key,
        label,
        path: workspaceSet ? process.cwd() : undefined,
        metadata,
      });
      this.currentProjectKey = project.id;

      const metrics = await this.storage.getProjectMetrics(project.id);
      let response = `Project scope set: ${project.name}\n`;
      response += `Project key: ${project.id}\n`;
      if (workspaceSet) {
        response += `Workspace root: ${process.cwd()}\n`;
      }

      if (enableGitHooks) {
        const hookWorkerPath = this.resolveHookWorkerPath();
        if (!fsSync.existsSync(hookWorkerPath)) {
          response += `Git hooks: skipped (hook worker not found at ${hookWorkerPath})\n`;
        } else {
          const hookManager = new GitHookManager({
            projectPath: process.cwd(),
            projectKey: project.id,
            hookWorkerPath,
            memoryCoreUrl: process.env.MEMORY_CORE_URL,
            memoryCoreApiKey: process.env.MEMORY_CORE_API_KEY,
            memoryCoreWorkspaceKey: process.env.MEMORY_CORE_WORKSPACE_KEY,
          });

          if (!hookManager.isGitRepo()) {
            response += 'Git hooks: skipped (current directory is not a git repository)\n';
          } else {
            const installResult = hookManager.installHooks();
            if (installResult.success) {
              response += `Git hooks: installed (${installResult.installed.join(', ')})\n`;
              if (
                process.env.MEMORY_CORE_URL &&
                process.env.MEMORY_CORE_API_KEY &&
                process.env.MEMORY_CORE_WORKSPACE_KEY
              ) {
                response += 'Git hooks: memory-core forwarding enabled (/v1/git-events).\n';
              } else {
                response +=
                  'Git hooks: memory-core forwarding disabled (set MEMORY_CORE_URL, MEMORY_CORE_API_KEY, MEMORY_CORE_WORKSPACE_KEY).\n';
              }
            } else {
              response += `Git hooks: partial/failed install (${installResult.errors.join('; ')})\n`;
            }
          }
        }
      } else {
        response += 'Git hooks: disabled (default). Pass `enable_git_hooks=true` to install.\n';
      }

      if (metrics) {
        response += `Metrics: ${metrics.linesOfCode.toLocaleString()} LOC, ${metrics.fileCount} files`;
        if (metrics.complexity) {
          response += `, complexity=${metrics.complexity}`;
        }
        response += '\n';
      } else if (profileSummary) {
        response += profileSummary + '\n';
      }
      response += 'Use `remember` and `recall` for memory operations.';

      return {
        content: [{ type: 'text', text: response }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Failed to initialize project: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  /**
   * Remember - Store context intentionally
   */
  private async handleRemember(args: RememberInput & { project_key?: string }) {
    const scopedProject = await this.resolveProjectScope(args.project_key);
    if (!scopedProject) {
      return {
        content: [{
          type: 'text',
          text: 'No project scope selected. Run `set_project({ key })` first or pass `project_key`.',
        }],
        isError: true,
      };
    }

    const { type, content, metadata, project_key } = args;

    try {
      const engine = new RememberEngine(
        this.storage.getDb(),
        scopedProject.id,
        scopedProject.path
      );
      const result = await engine.remember({ type, content, metadata });

      let response = `Remember ${result.action}: ${type}\n`;
      response += `Project key: ${scopedProject.id}\n`;
      if (project_key) {
        response += `Scoped via project_key override.\n`;
      }
      response += `"${content}"\n`;
      if (result.gitContext) {
        response += `Branch: ${result.gitContext.branch}\n`;
      }
      if (result.fileContext?.files.length) {
        response += `Files: ${result.fileContext.files.map((file) => file.path).join(', ')}\n`;
      }

      return {
        content: [{
          type: 'text',
          text: response,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Failed to remember: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  /**
   * Recall - Retrieve layered context
   */
  private async handleRecall(args?: {
    query?: string;
    limit?: number;
    project_key?: string;
    all_projects?: boolean;
  }) {
    const allProjects = args?.all_projects === true;
    const scopedProject = allProjects ? null : await this.resolveProjectScope(args?.project_key);
    if (!allProjects && !scopedProject) {
      return {
        content: [{
          type: 'text',
          text: 'No project scope selected. Run `set_project({ key })` first, pass `project_key`, or use `all_projects=true`.',
        }],
        isError: true,
      };
    }

    const limit = args?.limit || 10;
    const query = args?.query;

    try {
      const engine = new RecallEngine(this.storage.getDb(), scopedProject?.id);
      const synthesis = await engine.recall({
        query,
        limit,
        projectKey: args?.project_key,
        allProjects,
      });

      let response = `Context Recall\n`;
      response += allProjects
        ? `Scope: all projects (${synthesis.projectKeys.length})\n`
        : `Scope: ${scopedProject!.id}\n`;
      if (query) {
        response += `Query: "${query}"\n`;
      }
      response += '\nWhere You Left Off\n';
      response += synthesis.summary;
      response += '\n\n';

      if (synthesis.criticalPath.length > 0) {
        response += `Critical Path\n`;
        synthesis.criticalPath.forEach((step, index) => {
          response += `${index + 1}. ${step}\n`;
        });
        response += '\n';
      }

      const { fresh, recent, stale, expired } = synthesis.freshness;
      const total = fresh + recent + stale + expired;
      if (total > 0) {
        response += `Freshness: `;
        const parts = [];
        if (fresh > 0) parts.push(`${fresh} fresh`);
        if (recent > 0) parts.push(`${recent} recent`);
        if (stale > 0) parts.push(`${stale} stale`);
        if (expired > 0) parts.push(`${expired} expired`);
        response += parts.join(', ');
        response += '\n\n';
      }

      if (synthesis.activeWork.length > 0) {
        response += `Active Work\n`;
        synthesis.activeWork.forEach((work: any) => {
          response += `- ${work.content}`;
          if (allProjects) {
            response += ` [${work.projectKey}]`;
          }
          response += '\n';
          if (work.metadata?.files && work.metadata.files.length > 0) {
            response += `  Files: ${work.metadata.files.join(', ')}\n`;
          }
        });
        response += '\n';
      }

      if (synthesis.caveats.length > 0) {
        response += `Tech Debt & Unresolved Issues (${synthesis.caveats.length})\n`;
        synthesis.caveats.forEach((cav: any) => {
          const category = String(cav.metadata?.category || 'workaround').toUpperCase();
          response += `- [${category}] ${cav.content}\n`;
          if (cav.metadata?.attempted) {
            response += `  Attempted: ${cav.metadata.attempted}\n`;
          }
          if (cav.metadata?.recovery) {
            response += `  Recovery: ${cav.metadata.recovery}\n`;
          }
          if (cav.metadata?.action_required) {
            response += `  Action Required: ${cav.metadata.action_required}\n`;
          }
        });
        response += '\n';
      }

      if (synthesis.problems.length > 0) {
        response += `Open Problems\n`;
        synthesis.problems.slice(0, 3).forEach((p: any) => {
          response += `- ${p.content}\n`;
        });
        if (synthesis.problems.length > 3) {
          response += `... and ${synthesis.problems.length - 3} more\n`;
        }
        response += '\n';
      }

      if (synthesis.constraints.length > 0) {
        response += `Constraints\n`;
        synthesis.constraints.slice(0, 3).forEach((c: any) => {
          response += `- ${c.content}\n`;
        });
        response += '\n';
      }

      if (synthesis.goals.length > 0) {
        response += `Goals\n`;
        synthesis.goals.slice(0, 3).forEach((g: any) => {
          response += `- ${g.content}`;
          if (g.metadata?.status) {
            response += ` [${g.metadata.status}]`;
          }
          response += '\n';
        });
        response += '\n';
      }

      if (synthesis.relationships.size > 0) {
        response += `Relationships\n`;
        let count = 0;
        for (const [decision, files] of synthesis.relationships) {
          if (count >= 2) break;
          response += `- "${decision}" affects: ${files.join(', ')}\n`;
          count++;
        }
        response += '\n';
      }

      if (synthesis.gaps.length > 0) {
        response += `Context Gaps\n`;
        synthesis.gaps.forEach((gap) => {
          response += `- ${gap}\n`;
        });
        response += '\n';
      }

      if (synthesis.suggestions.length > 0) {
        response += `Suggestions\n`;
        synthesis.suggestions.forEach((suggestion) => {
          response += `- ${suggestion}\n`;
        });
        response += '\n';
      }

      if (total === 0) {
        response += 'No context stored yet. Use `remember` to add information.';
      }

      return {
        content: [{ type: 'text', text: response }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Failed to recall: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  /**
   * Read file from workspace
   */
  private async handleReadFile(args: { path: string }) {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    if (!workspace) {
      return {
        content: [{
          type: 'text',
          text: ' No workspace set. Run `set_project` first.',
        }],
      };
    }

    try {
      // Use optimized read file engine
      const engine = new ReadFileEngine(workspace);
      const fileContext = await engine.read(args.path);

      // Format rich response
      let response = ` **${fileContext.path}**\n\n`;

      // Metadata section
      response += ` **Metadata**\n`;
      response += ` Language: ${fileContext.metadata.language}\n`;
      response += ` Size: ${(fileContext.metadata.size / 1024).toFixed(1)} KB\n`;
      response += ` Lines: ${fileContext.metadata.linesOfCode} LOC\n`;
      response += ` Last Modified: ${fileContext.metadata.lastModified.toLocaleDateString()}\n`;
      if (fileContext.metadata.author) {
        response += ` Last Author: ${fileContext.metadata.author}\n`;
      }
      if (fileContext.metadata.changeFrequency > 0) {
        response += ` Change Frequency: ${fileContext.metadata.changeFrequency} commit(s) in last 30 days\n`;
      }
      response += `\n`;

      // Complexity section
      const complexityEmoji = {
        'low': '',
        'medium': '',
        'high': '',
        'very-high': ''
      };
      response += `${complexityEmoji[fileContext.complexity.level]} **Complexity: ${fileContext.complexity.level}** (score: ${fileContext.complexity.score})\n`;
      if (fileContext.complexity.reasons.length > 0) {
        response += `   ${fileContext.complexity.reasons.join(', ')}\n`;
      }
      response += `\n`;

      // Relationships section
      if (fileContext.relationships.imports.length > 0) {
        response += ` **Imports** (${fileContext.relationships.imports.length}):\n`;
        fileContext.relationships.imports.slice(0, 5).forEach(imp => {
          response += `    ${imp}\n`;
        });
        if (fileContext.relationships.imports.length > 5) {
          response += `   ... and ${fileContext.relationships.imports.length - 5} more\n`;
        }
        response += `\n`;
      }

      if (fileContext.relationships.relatedTests.length > 0) {
        response += ` **Related Tests**:\n`;
        fileContext.relationships.relatedTests.forEach(test => {
          response += `    ${test}\n`;
        });
        response += `\n`;
      }

      if (fileContext.relationships.relatedConfigs.length > 0) {
        response += ` **Related Configs**:\n`;
        fileContext.relationships.relatedConfigs.forEach(config => {
          response += `    ${config}\n`;
        });
        response += `\n`;
      }

      // Content section
      response += ` **Content**\n\n\`\`\`${fileContext.metadata.language.toLowerCase()}\n${fileContext.content}\n\`\`\``;

      return {
        content: [{
          type: 'text',
          text: response,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: ` Failed to read file: ${error.message}\n\nStack: ${error.stack}`,
        }],
      };
    }
  }

  /**
   * Search workspace (unified search for files and content)
   */
  private async handleSearch(args: { query: string; type: 'files' | 'content'; options?: any }) {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    if (!workspace) {
      return {
        content: [{
          type: 'text',
          text: ' No workspace set. Run `set_project` first.',
        }],
      };
    }

    try {
      const { query, type, options = {} } = args;
      
      // Use optimized search engine
      const engine = new SearchEngine(workspace);

      if (type === 'files') {
        const result = await engine.searchFiles(query, {
          maxResults: options.maxResults || 50,
          enrichContext: true,
          caseSensitive: options.caseSensitive || false
        });
        
        if (result.totalMatches === 0) {
          return {
            content: [{
              type: 'text',
              text: ` No files found matching "${query}"`,
            }],
          };
        }

        let response = ` **Found ${result.totalMatches} files**\n\n`;
        
        // Show top matches with context
        result.matches.slice(0, 20).forEach((match, i) => {
          const score = Math.round(match.relevanceScore);
          const matchTypeEmoji = match.matchType === 'exact' ? '' : 
                                 match.matchType === 'prefix' ? '' : '';
          
          response += `${i + 1}. ${matchTypeEmoji} ${match.relativePath}`;
          
          // Show file context if available
          if (match.context) {
            const complexityEmoji = match.context.complexity === 'low' ? '' : 
                                   match.context.complexity === 'medium' ? '' : 
                                   match.context.complexity === 'high' ? '' : '';
            response += ` (${complexityEmoji} ${match.context.complexity}`;
            if (match.context.linesOfCode) {
              response += `, ${match.context.linesOfCode} LOC`;
            }
            response += `)`;
          }
          response += `\n`;
        });

        if (result.totalMatches > 20) {
          response += `\n... and ${result.totalMatches - 20} more matches`;
        }

        // Show suggestions
        if (result.suggestions && result.suggestions.length > 0) {
          response += `\n\n **Suggestions:** ${result.suggestions.join(', ')}`;
        }

        // Show clusters
        if (result.clusters && Object.keys(result.clusters).length > 1) {
          response += `\n\n **Clustered by directory:**\n`;
          Object.entries(result.clusters).slice(0, 5).forEach(([dir, matches]) => {
            response += `   ${dir}: ${matches.length} file(s)\n`;
          });
        }
        
        return {
          content: [{ type: 'text', text: response }],
        };
      } else {
        const result = await engine.searchContent(query, {
          maxResults: options.maxResults || 100,
          filePattern: options.filePattern,
          caseSensitive: options.caseSensitive || false,
          regex: options.regex || false,
          enrichContext: false // Skip for performance on content search
        });
        
        if (result.totalMatches === 0) {
          return {
            content: [{
              type: 'text',
              text: ` No content found matching "${query}"`,
            }],
          };
        }

        let response = ` **Found ${result.totalMatches} matches**\n\n`;
        
        // Group by file for better readability
        if (result.clusters) {
          const files = Object.keys(result.clusters).slice(0, 10);
          files.forEach(file => {
            const matches = result.clusters![file];
            response += ` **${file}** (${matches.length} match${matches.length > 1 ? 'es' : ''})\n`;
            matches.slice(0, 3).forEach(match => {
              response += `   Line ${match.line}: ${match.text?.trim().substring(0, 100)}\n`;
            });
            if (matches.length > 3) {
              response += `   ... and ${matches.length - 3} more\n`;
            }
            response += `\n`;
          });

          if (Object.keys(result.clusters).length > 10) {
            response += `... and ${Object.keys(result.clusters).length - 10} more files\n`;
          }
        }

        return {
          content: [{ type: 'text', text: response }],
        };
      }
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: ` Search failed: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Get project structure with complexity analysis
   */
  private async handleStructure(args?: { depth?: number }) {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    if (!workspace) {
      return {
        content: [{
          type: 'text',
          text: ' No workspace set. Run `set_project` first.',
        }],
      };
    }

    try {
      const depth = args?.depth || 3;
      
      // Use optimized structure engine
      const engine = new StructureEngine(workspace);
      const result = await engine.getStructure(depth, {
        includeMetadata: true,
        analyzeComplexity: true,
        detectHotspots: true
      });

      let response = ` **Project Structure**\n\n`;
      response += `\`\`\`\n${result.tree}\`\`\`\n\n`;
      
      // Summary statistics
      response += ` **Summary**\n`;
      response += ` ${result.summary.totalFiles} files, ${result.summary.totalDirectories} directories\n`;
      if (result.summary.totalLOC > 0) {
        response += ` ${result.summary.totalLOC.toLocaleString()} lines of code\n`;
      }
      response += ` ${(result.summary.totalSize / (1024 * 1024)).toFixed(2)} MB total size\n`;
      
      if (Object.keys(result.summary.languages).length > 0) {
        const languages = Object.entries(result.summary.languages)
          .sort(([, a], [, b]) => b - a)
          .map(([lang]) => lang)
          .slice(0, 3)
          .join(', ');
        response += ` Languages: ${languages}\n`;
      }
      
      // Architecture pattern
      if (result.summary.architecturePattern) {
        response += `\n **Architecture:** ${result.summary.architecturePattern}\n`;
      }

      // Hotspots
      if (result.summary.hotspots && result.summary.hotspots.length > 0) {
        response += `\n **Hotspots** (high complexity areas):\n`;
        result.summary.hotspots.forEach((hotspot, i) => {
          const complexityEmoji = hotspot.complexity >= 60 ? '' : '';
          response += `${i + 1}. ${complexityEmoji} ${hotspot.path} - ${hotspot.reason} (${hotspot.loc.toLocaleString()} LOC)\n`;
        });
      }

      // Insights
      if (result.insights && result.insights.length > 0) {
        response += `\n **Insights**\n`;
        result.insights.forEach(insight => {
          response += ` ${insight}\n`;
        });
      }

      return {
        content: [{
          type: 'text',
          text: response,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: ` Failed to get structure: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Git operations dispatcher (namespaced tool)
   */
  private async handleGit(args: { 
    action: 'status' | 'context' | 'hotspots' | 'coupling' | 'blame' | 'analysis'; 
    staged?: boolean; 
    files?: string[]; 
    path?: string;
    limit?: number;
    minCoupling?: number;
  }) {
    const { action, ...restArgs } = args;

    switch (action) {
      case 'status':
        return await this.handleGitStatus();
      case 'context':
        return await this.handleGitContext(restArgs);
      case 'hotspots':
        return await this.handleGitHotspots(restArgs.limit);
      case 'coupling':
        return await this.handleGitCoupling(restArgs.minCoupling);
      case 'blame':
        if (!restArgs.path) {
          return {
            content: [{
              type: 'text',
              text: ` Missing required parameter 'path' for git blame action.`,
            }],
          };
        }
        return await this.handleGitBlame(restArgs.path);
      case 'analysis':
        return await this.handleGitAnalysis();
      default:
        return {
          content: [{
            type: 'text',
            text: ` Unknown git action: ${action}. Use 'status', 'context', 'hotspots', 'coupling', 'blame', or 'analysis'.`,
          }],
        };
    }
  }

  /**
   * Git status with impact analysis
   */
  private async handleGitStatus() {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    if (!workspace) {
      return {
        content: [{
          type: 'text',
          text: ' No workspace set. Run `set_project` first.',
        }],
      };
    }

    try {
      // Use optimized git status engine
      const engine = new GitStatusEngine(workspace);
      const result = await engine.getStatus({
        analyzeImpact: true,
        enrichContext: true
      });

      let response = ` **Git Status**\n\n`;
      response += ` Branch: ${result.branch}\n`;
      
      if (result.ahead > 0) response += ` Ahead: ${result.ahead} commit(s)\n`;
      if (result.behind > 0) response += ` Behind: ${result.behind} commit(s)\n`;
      
      response += `\n`;

      if (result.clean) {
        response += ` Working tree clean`;
      } else {
        // Staged files with context
        if (result.changes.staged.length > 0) {
          response += ` **Staged** (${result.changes.staged.length}):\n`;
          result.changes.staged.forEach(change => {
            const impactEmoji = change.impact === 'high' ? '' : 
                               change.impact === 'medium' ? '' : '';
            const complexityEmoji = change.complexity === 'low' ? '' : 
                                   change.complexity === 'medium' ? '' : 
                                   change.complexity === 'high' ? '' : 
                                   change.complexity === 'very-high' ? '' : '';
            
            response += `   ${impactEmoji} ${change.path}`;
            if (change.category) response += ` [${change.category}]`;
            if (complexityEmoji) response += ` ${complexityEmoji}`;
            response += `\n`;
          });
        }

        // Modified files
        if (result.changes.modified.length > 0) {
          response += `\n **Modified** (${result.changes.modified.length}):\n`;
          result.changes.modified.slice(0, 10).forEach(change => {
            const impactEmoji = change.impact === 'high' ? '' : 
                               change.impact === 'medium' ? '' : '';
            response += `   ${impactEmoji} ${change.path}`;
            if (change.category) response += ` [${change.category}]`;
            response += `\n`;
          });
          if (result.changes.modified.length > 10) {
            response += `  ... and ${result.changes.modified.length - 10} more\n`;
          }
        }

        // Untracked files
        if (result.changes.untracked.length > 0) {
          response += `\n **Untracked** (${result.changes.untracked.length}):\n`;
          result.changes.untracked.slice(0, 5).forEach(change => {
            response += `   ${change.path}`;
            if (change.category) response += ` [${change.category}]`;
            response += `\n`;
          });
          if (result.changes.untracked.length > 5) {
            response += `  ... and ${result.changes.untracked.length - 5} more\n`;
          }
        }

        // Deleted files
        if (result.changes.deleted.length > 0) {
          response += `\n  **Deleted** (${result.changes.deleted.length}):\n`;
          result.changes.deleted.forEach(change => {
            response += `   ${change.path}\n`;
          });
        }
      }

      // Summary
      if (result.summary.totalChanges > 0) {
        response += `\n **Summary:**\n`;
        response += ` ${result.summary.totalChanges} total change(s)`;
        if (result.summary.highImpact > 0) {
          response += ` (${result.summary.highImpact} high-impact)`;
        }
        response += `\n`;

        if (Object.keys(result.summary.categories).length > 0) {
          const categories = Object.entries(result.summary.categories)
            .map(([cat, count]) => `${count} ${cat}`)
            .join(', ');
          response += ` Categories: ${categories}\n`;
        }

        if (result.summary.complexity.high > 0) {
          response += ` ${result.summary.complexity.high} complex file(s) changed\n`;
        }
      }

      // Commit readiness
      if (result.changes.staged.length > 0) {
        response += `\n **Commit Readiness:** ${result.commitReadiness.ready ? 'Ready' : 'Review needed'}\n`;
        
        if (result.commitReadiness.warnings.length > 0) {
          response += `\n  **Warnings:**\n`;
          result.commitReadiness.warnings.forEach(w => response += `   ${w}\n`);
        }

        if (result.commitReadiness.suggestions.length > 0) {
          response += `\n **Suggestions:**\n`;
          result.commitReadiness.suggestions.forEach(s => response += `   ${s}\n`);
        }
      }

      return {
        content: [{ type: 'text', text: response }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: ` Git status failed: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Git context with smart commit message generation
   */
  private async handleGitContext(args?: { staged?: boolean; files?: string[] }) {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    if (!workspace) {
      return {
        content: [{
          type: 'text',
          text: ' No workspace set. Run `set_project` first.',
        }],
      };
    }

    try {
      // Use optimized git context engine
      const engine = new GitContextEngine(workspace);
      const context = await engine.getContext({
        generateCommitMessage: true,
        analyzeChanges: true
      });

      let response = ` **Git Context**\n\n`;
      
      // Branch info
      response += ` **Current Branch**: ${context.branch}\n`;
      if (context.ahead > 0) response += ` Ahead: ${context.ahead} commit(s)\n`;
      if (context.behind > 0) response += ` Behind: ${context.behind} commit(s)\n`;
      response += `\n`;

      // Last commit
      if (context.lastCommit) {
        response += ` **Last Commit**:\n`;
        response += `   Hash: ${context.lastCommit.hash}\n`;
        response += `   Author: ${context.lastCommit.author}\n`;
        response += `   Date: ${context.lastCommit.date.toLocaleDateString()}\n`;
        response += `   Message: ${context.lastCommit.message}\n\n`;
      }

      // Changes summary
      const totalChanges = context.stagedFiles.length + context.uncommittedFiles.length;
      if (totalChanges > 0) {
        response += ` **Changes**: ${totalChanges} file(s)\n`;
        if (context.stagedFiles.length > 0) {
          response += `   Staged: ${context.stagedFiles.length}\n`;
        }
        if (context.uncommittedFiles.length > 0) {
          response += `   Uncommitted: ${context.uncommittedFiles.length}\n`;
        }
        response += `\n`;
      }

      // Change analysis
      if (context.changeAnalysis) {
        const analysis = context.changeAnalysis;
        response += ` **Change Analysis**:\n`;
        response += `   Files changed: ${analysis.filesChanged}\n`;
        response += `   Insertions: +${analysis.insertions}\n`;
        response += `   Deletions: -${analysis.deletions}\n`;
        
        if (analysis.primaryCategory) {
          response += `   Primary category: ${analysis.primaryCategory}\n`;
        }
        if (analysis.scope) {
          response += `   Scope: ${analysis.scope}\n`;
        }
        
        if (Object.keys(analysis.categories).length > 0) {
          const categories = Object.entries(analysis.categories)
            .map(([cat, count]) => `${count} ${cat}`)
            .join(', ');
          response += `   Categories: ${categories}\n`;
        }
        response += `\n`;
      }

      // Suggested commit message
      if (context.suggestedCommitMessage) {
        response += ` **Suggested Commit Message**:\n\`\`\`\n${context.suggestedCommitMessage}\n\`\`\`\n\n`;
        response += ` This follows conventional commits format. Edit as needed.`;
      } else if (context.stagedFiles.length === 0) {
        response += ` Stage files to get a suggested commit message.`;
      }

      return {
        content: [{ type: 'text', text: response }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: ` Git context failed: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Git hotspots - files with high change frequency (risk analysis)
   */
  private async handleGitHotspots(limit: number = 10) {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    
    if (!workspace) {
      return {
        content: [{
          type: 'text',
          text: ' No workspace set. Run `set_project` first.',
        }],
      };
    }

    try {
      const git = new GitIntegration(workspace);
      
      if (!git.isGitRepo()) {
        return {
          content: [{
            type: 'text',
            text: ' Not a git repository',
          }],
        };
      }

      const hotspots = git.getHotspots(limit);
      
      if (!hotspots || hotspots.length === 0) {
        return {
          content: [{
            type: 'text',
            text: ' No hotspots found. Repository may be too new or have limited history.',
          }],
        };
      }

      let response = ` **Git Hotspots - Risk Analysis**\n\n`;
      response += `Files with high change frequency (last 6 months):\n\n`;

      for (const spot of hotspots) {
        const riskIcon = spot.risk === 'critical' ? '' : 
                        spot.risk === 'high' ? '' : 
                        spot.risk === 'medium' ? '' : '';
        
        response += `${riskIcon} **${spot.file}** (${spot.risk} risk)\n`;
        response += `   ${spot.changes} changes\n`;
        response += `   Last changed: ${spot.lastChanged}\n\n`;
      }

      response += `\n **Why This Matters:**\n`;
      response += ` High churn = complexity or instability\n`;
      response += ` Critical/high risk files need extra testing\n`;
      response += ` Consider refactoring frequently changed files\n`;

      return {
        content: [{ type: 'text', text: response }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: ` Git hotspots failed: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Git coupling - files that change together (hidden dependencies)
   */
  private async handleGitCoupling(minCoupling: number = 3) {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    
    if (!workspace) {
      return {
        content: [{
          type: 'text',
          text: ' No workspace set. Run `set_project` first.',
        }],
      };
    }

    try {
      const git = new GitIntegration(workspace);
      
      if (!git.isGitRepo()) {
        return {
          content: [{
            type: 'text',
            text: ' Not a git repository',
          }],
        };
      }

      const couplings = git.getFileCoupling(minCoupling);
      
      if (!couplings || couplings.length === 0) {
        return {
          content: [{
            type: 'text',
            text: ` No strong file couplings found (minimum ${minCoupling} co-changes).`,
          }],
        };
      }

      let response = ` **Git Coupling - Hidden Dependencies**\n\n`;
      response += `Files that frequently change together (last 6 months):\n\n`;

      for (const coupling of couplings) {
        const strengthIcon = coupling.coupling === 'strong' ? '' : 
                            coupling.coupling === 'medium' ? '' : '';
        
        response += `${strengthIcon} **${coupling.coupling.toUpperCase()} coupling** (${coupling.timesChanged} together)\n`;
        response += `   ${coupling.fileA}\n`;
        response += `   ${coupling.fileB}\n\n`;
      }

      response += `\n **Why This Matters:**\n`;
      response += ` Strong coupling = hidden dependencies\n`;
      response += ` Files that change together should maybe be merged\n`;
      response += ` Or they need better abstraction/interfaces\n`;
      response += ` Use this to find refactoring opportunities\n`;

      return {
        content: [{ type: 'text', text: response }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: ` Git coupling failed: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Git blame - code ownership analysis
   */
  private async handleGitBlame(filepath: string) {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    
    if (!workspace) {
      return {
        content: [{
          type: 'text',
          text: ' No workspace set. Run `set_project` first.',
        }],
      };
    }

    try {
      const git = new GitIntegration(workspace);
      
      if (!git.isGitRepo()) {
        return {
          content: [{
            type: 'text',
            text: ' Not a git repository',
          }],
        };
      }

      const ownership = git.getBlame(filepath);
      
      if (!ownership || ownership.length === 0) {
        return {
          content: [{
            type: 'text',
            text: ` Could not get blame info for ${filepath}. File may not exist or not be tracked.`,
          }],
        };
      }

      let response = ` **Code Ownership - ${filepath}**\n\n`;

      for (const owner of ownership) {
        const barLength = Math.floor(owner.percentage / 5);
        const bar = ''.repeat(barLength) + ''.repeat(20 - barLength);
        
        response += `**${owner.author}** - ${owner.percentage}%\n`;
        response += `${bar}\n`;
        response += `   ${owner.lines} lines\n`;
        response += `   Last edit: ${owner.lastEdit}\n\n`;
      }

      const primaryOwner = ownership[0];
      response += `\n **Primary Expert:** ${primaryOwner.author} (${primaryOwner.percentage}% ownership)\n`;
      response += `Ask them about this file's architecture and design decisions.\n`;

      return {
        content: [{ type: 'text', text: response }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: ` Git blame failed: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Git analysis - comprehensive overview
   */
  private async handleGitAnalysis() {
    const workspace = this.workspaceDetector.getCurrentWorkspace();
    
    if (!workspace) {
      return {
        content: [{
          type: 'text',
          text: ' No workspace set. Run `set_project` first.',
        }],
      };
    }

    try {
      const git = new GitIntegration(workspace);
      
      if (!git.isGitRepo()) {
        return {
          content: [{
            type: 'text',
            text: ' Not a git repository',
          }],
        };
      }

      const analysis = git.getAnalysis();
      
      if (!analysis) {
        return {
          content: [{
            type: 'text',
            text: ' Could not analyze repository',
          }],
        };
      }

      let response = ` **Git Repository Analysis**\n\n`;

      // Branch health
      response += ` **Branch Health**\n`;
      response += `   Current: ${analysis.branchHealth.current}\n`;
      
      if (analysis.branchHealth.ahead > 0) {
        response += `   Ahead: ${analysis.branchHealth.ahead} commits\n`;
      }
      if (analysis.branchHealth.behind > 0) {
        response += `   Behind: ${analysis.branchHealth.behind} commits`;
        if (analysis.branchHealth.stale) {
          response += `  STALE - merge main!\n`;
        } else {
          response += `\n`;
        }
      }
      response += `\n`;

      // Top contributors
      if (analysis.contributors.length > 0) {
        response += ` **Top Contributors** (last 6 months)\n`;
        for (const contributor of analysis.contributors.slice(0, 5)) {
          response += `   ${contributor.name} - ${contributor.commits} commits (last: ${contributor.lastCommit})\n`;
        }
        response += `\n`;
      }

      // Top hotspots
      if (analysis.hotspots.length > 0) {
        response += ` **Top 5 Hotspots** (high-risk files)\n`;
        for (const spot of analysis.hotspots.slice(0, 5)) {
          const riskIcon = spot.risk === 'critical' ? '' : 
                          spot.risk === 'high' ? '' : 
                          spot.risk === 'medium' ? '' : '';
          response += `  ${riskIcon} ${spot.file} - ${spot.changes} changes\n`;
        }
        response += `\n`;
      }

      // Strongest couplings
      if (analysis.coupling.length > 0) {
        response += ` **Strongest Couplings** (hidden dependencies)\n`;
        for (const coupling of analysis.coupling.slice(0, 5)) {
          response += `   ${coupling.fileA}  ${coupling.fileB} (${coupling.timesChanged} together)\n`;
        }
        response += `\n`;
      }

      // Recommendations
      response += ` **Recommendations:**\n`;
      
      if (analysis.branchHealth.stale) {
        response += `    Merge main branch - you're ${analysis.branchHealth.behind} commits behind\n`;
      }
      
      if (analysis.hotspots.some((h: any) => h.risk === 'critical')) {
        const criticalFiles = analysis.hotspots.filter((h: any) => h.risk === 'critical');
        response += `    Review ${criticalFiles.length} critical-risk file(s) - consider refactoring\n`;
      }
      
      if (analysis.coupling.some((c: any) => c.coupling === 'strong')) {
        const strongCouplings = analysis.coupling.filter((c: any) => c.coupling === 'strong');
        response += `    ${strongCouplings.length} strong coupling(s) detected - refactor to reduce dependencies\n`;
      }

      return {
        content: [{ type: 'text', text: response }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: ` Git analysis failed: ${error.message}`,
        }],
      };
    }
  }

  private async handleNotion(args: { action: 'search' | 'read'; query?: string; pageId?: string }) {
    // Validate action parameter
    if (!args.action) {
      return {
        content: [{
          type: 'text',
          text: ' Missing required parameter: action (must be "search" or "read")',
        }],
        isError: true,
      };
    }

    // Handle search action
    if (args.action === 'search') {
      if (!args.query) {
        return {
          content: [{
            type: 'text',
            text: ' Missing required parameter: query (required for search action)',
          }],
          isError: true,
        };
      }
      return await this.notionHandlers.handleNotionSearch({ query: args.query });
    }

    // Handle read action
    if (args.action === 'read') {
      if (!args.pageId) {
        return {
          content: [{
            type: 'text',
            text: ' Missing required parameter: pageId (required for read action)',
          }],
          isError: true,
        };
      }
      return await this.notionHandlers.handleNotionReadPage({ pageId: args.pageId });
    }

    // Unknown action
    return {
      content: [{
        type: 'text',
        text: ` Unknown action: "${args.action}". Use "search" or "read".`,
      }],
      isError: true,
    };
  }

  // ========== HELPERS ==========

  private async getCurrentProject() {
    if (!this.currentProjectKey) return null;
    return this.storage.getProject(this.currentProjectKey);
  }

  private async resolveProjectScope(projectKeyOverride?: string) {
    if (projectKeyOverride && projectKeyOverride.trim()) {
      return this.storage.getProject(projectKeyOverride);
    }
    return this.getCurrentProject();
  }

  private resolveHookWorkerPath(): string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.join(currentDir, 'hook-event.js'),
      path.resolve(currentDir, '../dist/hook-event.js'),
    ];
    for (const candidate of candidates) {
      if (fsSync.existsSync(candidate)) {
        return candidate;
      }
    }
    return candidates[0];
  }

  private parseKeyValue(content: string): { key: string; value: string } {
    // Try to parse "Key: Value" or "Key = Value" format
    const match = content.match(/^(.+?)[:=](.+)$/);
    if (match) {
      return {
        key: match[1].trim(),
        value: match[2].trim()
      };
    }
    // Fallback: use content as key
    return {
      key: content,
      value: ''
    };
  }

  async run(): Promise<void> {
    await this.storage.ensureSchemaIsReady();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  close(): void {
    this.storage.close().catch((error) => {
      logger.warn('Failed to close storage cleanly', error);
    });
  }
}
