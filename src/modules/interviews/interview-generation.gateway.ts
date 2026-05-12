import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';

const INTERVIEW_GENERATION_EVENT = 'interview-generation:updated';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class InterviewGenerationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(InterviewGenerationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<{ sub: string }>(token);
      const user = await this.authService.validateUserById(payload.sub);

      client.data.userId = user.id;
      await client.join(this.getUserRoom(user.id));
      this.logger.debug(`Socket connected for user ${user.id}`);
    } catch (error) {
      this.logger.warn(
        `Rejected socket connection: ${
          error instanceof Error ? error.message : 'invalid auth'
        }`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    if (client.data.userId) {
      this.logger.debug(`Socket disconnected for user ${client.data.userId}`);
    }
  }

  emitGenerationJobUpdated(userId: string, job: unknown) {
    this.server
      .to(this.getUserRoom(userId))
      .emit(INTERVIEW_GENERATION_EVENT, job);
  }

  private getUserRoom(userId: string) {
    return `user:${userId}`;
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) return null;

    return cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('token='))
      ?.split('=')
      .slice(1)
      .join('=');
  }
}

