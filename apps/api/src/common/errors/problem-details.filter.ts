import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';
import type { ProblemDetails } from '@rule-studio/shared-types';

// Problem details plus any extra fields, such as `errors` from the validation pipe.
type Problem = ProblemDetails & Record<string, unknown>;

// Turns every error into RFC 9457 problem details (spec 002), so the API has
// one error shape. @Catch() with no arguments catches everything, not only
// HttpExceptions.
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const problem = this.toProblem(exception, request.path);

    // Log the real error (with its stack) for server-side failures only.
    // The client never sees it; you need it when debugging.
    if (problem.status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }

  private toProblem(exception: unknown, instance: string): Problem {
    // Anything that isn't an HttpException is a bug or an outage:
    // a generic 500 that reveals nothing about what went wrong.
    if (!(exception instanceof HttpException)) {
      return {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred.',
        instance,
      };
    }

    // An intentional HTTP error (NotFoundException, BadRequestException, ...).
    const status = exception.getStatus();
    const body = exception.getResponse();

    // getResponse() is either a string or an object. Treat a string as "no extra fields".
    const fields =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};

    // Nest's own fields (statusCode, error, message) are not part of problem details,
    // and `detail` is handled below. Whatever else is there, like `errors` from the
    // validation pipe, is kept as an extra field.
    const { message, detail } = fields;
    const extra = { ...fields };
    delete extra['statusCode'];
    delete extra['error'];
    delete extra['message'];
    delete extra['detail'];

    // The human-readable explanation, in order of preference.
    let text: string | undefined;
    if (typeof detail === 'string') text = detail;
    else if (typeof message === 'string') text = message;
    else if (typeof body === 'string') text = body;

    return {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Error',
      status,
      ...(text ? { detail: text } : {}),
      instance,
      ...extra,
    };
  }
}
