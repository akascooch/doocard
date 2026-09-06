import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

/**
 * Applies the same HTTP CORS origin allow-list to Socket.IO.
 * Does not add origins beyond what main.ts already permits.
 */
export class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.corsOrigins,
        credentials: true,
      },
    });
  }
}
