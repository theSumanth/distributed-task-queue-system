export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  public constructor(code: string, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  public constructor(message: string, details?: unknown) {
    super('BAD_REQUEST', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  public constructor(message: string, details?: unknown) {
    super('NOT_FOUND', message, 404, details);
  }
}

export class ConflictError extends AppError {
  public constructor(message: string, details: unknown) {
    super('CONFLICT', message, 409, details);
  }
}

export class InternalError extends AppError {
  public constructor(message: string, details: unknown) {
    super('INTERNAL_ERROR', message, 500, details);
  }
}
