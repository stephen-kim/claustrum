import express from 'express';
import multer from 'multer';
import { ImportSource } from '@prisma/client';
import { z } from 'zod';
import type { MemoryCoreService } from '../../service/index.js';
import type { AuthedRequest } from '../types.js';
import { sendHttpError } from '../error-shape.js';
import { createRateLimitMiddleware } from '../rate-limit.js';

export function registerImportRawRoutes(
  app: express.Express,
  service: MemoryCoreService,
  upload: multer.Multer
): void {
  const rawSearchRateLimit = createRateLimitMiddleware({
    name: 'raw.search',
    max: 60,
    windowMs: 60_000,
    message: 'Raw search rate limit exceeded. Please retry in a moment.',
    keyResolver: (req) => (req as AuthedRequest).auth?.user.id || req.ip || 'anonymous',
  });
  const rawViewRateLimit = createRateLimitMiddleware({
    name: 'raw.view',
    max: 120,
    windowMs: 60_000,
    message: 'Raw message view rate limit exceeded. Please retry in a moment.',
    keyResolver: (req) => (req as AuthedRequest).auth?.user.id || req.ip || 'anonymous',
  });

  app.get('/v1/imports', async (req, res, next) => {
    try {
      const query = z
        .object({
          workspace_key: z.string().min(1),
          limit: z.coerce.number().int().positive().optional(),
        })
        .parse(req.query);
      const imports = await service.listImports({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        limit: query.limit,
      });
      res.json({ imports });
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/imports', upload.single('file'), async (req, res, next) => {
    try {
      const body = z
        .object({
          workspace_key: z.string().min(1),
          source: z.nativeEnum(ImportSource),
          project_key: z.string().min(1).optional(),
        })
        .parse(req.body);
      if (!req.file) {
        return sendHttpError({
          res,
          status: 400,
          code: 'multipart_file_required',
          message: 'multipart file is required (field: file)',
        });
      }

      const result = await service.createImportUpload({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: body.workspace_key,
        source: body.source,
        fileName: req.file.originalname || 'import.dat',
        fileBuffer: req.file.buffer,
        projectKey: body.project_key,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/imports/:id/parse', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const result = await service.parseImport({
        auth: (req as AuthedRequest).auth!,
        importId: params.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/imports/:id/extract', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const result = await service.extractImport({
        auth: (req as AuthedRequest).auth!,
        importId: params.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/imports/:id/staged', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const staged = await service.listStagedMemories({
        auth: (req as AuthedRequest).auth!,
        importId: params.id,
      });
      res.json({ staged_memories: staged });
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/imports/:id/commit', async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          staged_ids: z.array(z.string().uuid()).optional(),
          project_key: z.string().min(1).optional(),
        })
        .parse(req.body);
      const result = await service.commitImport({
        auth: (req as AuthedRequest).auth!,
        importId: params.id,
        stagedIds: body.staged_ids,
        projectKey: body.project_key,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/raw/search', rawSearchRateLimit, async (req, res, next) => {
    try {
      const query = z
        .object({
          workspace_key: z.string().min(1),
          project_key: z.string().min(1).optional(),
          q: z.string().min(1),
          limit: z.coerce.number().int().positive().optional(),
          max_chars: z.coerce.number().int().positive().optional(),
        })
        .parse(req.query);
      const result = await service.rawSearch({
        auth: (req as AuthedRequest).auth!,
        workspaceKey: query.workspace_key,
        projectKey: query.project_key,
        q: query.q,
        limit: query.limit,
        maxChars: query.max_chars,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/raw/messages/:id', rawViewRateLimit, async (req, res, next) => {
    try {
      const params = z.object({ id: z.string().uuid() }).parse(req.params);
      const query = z
        .object({
          max_chars: z.coerce.number().int().positive().optional(),
        })
        .parse(req.query);
      const result = await service.viewRawMessage({
        auth: (req as AuthedRequest).auth!,
        messageId: params.id,
        maxChars: query.max_chars,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}
