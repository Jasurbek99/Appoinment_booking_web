// Domain errors. The error middleware (src/middleware/error.js) translates
// each to an HTTP status + JSON body. Services throw; routes don't catch.

export class AppError extends Error {
  constructor(message, { status = 500, code = 'internal', details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(details) {
    super('validation', { status: 400, code: 'validation', details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'unauthorized') {
    super(message, { status: 401, code: 'unauthorized' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'forbidden', code = 'forbidden') {
    super(message, { status: 403, code });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'not_found') {
    super(message, { status: 404, code: 'not_found' });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'conflict', code = 'conflict', details) {
    super(message, { status: 409, code, details });
  }
}

export class DuplicateError extends ConflictError {
  constructor(existing) {
    super('duplicate', 'duplicate');
    this.existing = existing;
  }
}
