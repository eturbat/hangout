import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

// The Socket.IO server with the same CORS origins as the HTTP API (CORS_ORIGIN
// in main.ts). The origins can't go in @WebSocketGateway({ cors }) because
// decorators run when the file is imported, before main.ts has loaded .env.
export class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[] | undefined,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, this.origins ? { ...options, cors: { origin: this.origins } } : options);
  }
}
