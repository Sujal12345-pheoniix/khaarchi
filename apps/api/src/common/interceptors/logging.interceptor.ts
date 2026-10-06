import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const startTime = Date.now();
    const { method, originalUrl, ip } = req;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;

          const logObject = {
            level: 'INFO',
            timestamp: new Date().toISOString(),
            method,
            path: originalUrl,
            statusCode,
            durationMs: duration,
            clientIp: ip,
          };

          this.logger.log(JSON.stringify(logObject));
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          const logObject = {
            level: 'ERROR',
            timestamp: new Date().toISOString(),
            method,
            path: originalUrl,
            statusCode,
            durationMs: duration,
            clientIp: ip,
            error: error.message,
          };

          this.logger.error(JSON.stringify(logObject));
        },
      })
    );
  }
}
