import type express from 'express';

export type HttpErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function sendHttpError(args: {
  res: express.Response;
  status: number;
  code?: string;
  message: string;
  details?: unknown;
}): express.Response<HttpErrorBody> {
  const code = args.code || defaultErrorCode(args.status);
  const payload: HttpErrorBody = {
    error: {
      code,
      message: args.message,
      ...(args.details !== undefined ? { details: args.details } : {}),
    },
  };
  return args.res.status(args.status).json(payload);
}

function defaultErrorCode(status: number): string {
  if (status === 400) {
    return 'bad_request';
  }
  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 403) {
    return 'forbidden';
  }
  if (status === 404) {
    return 'not_found';
  }
  if (status === 409) {
    return 'conflict';
  }
  if (status === 410) {
    return 'gone';
  }
  if (status === 422) {
    return 'unprocessable_entity';
  }
  if (status === 429) {
    return 'rate_limited';
  }
  return 'internal_error';
}
