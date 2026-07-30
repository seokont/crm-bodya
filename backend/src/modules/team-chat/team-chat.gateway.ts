import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTokenPayload, AuthUser } from '../auth/auth-user.interface';
import {
  TeamChatService,
  TeamMessageResult,
} from './team-chat.service';

type SocketResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

interface ServerToClientEvents {
  'team-chat:ready': (payload: { userId: number }) => void;
  'team-chat:error': (payload: { message: string }) => void;
  'team-chat:message-created': (message: TeamMessageResult) => void;
  'team-chat:message-updated': (message: TeamMessageResult) => void;
  'team-chat:message-deleted': (payload: { id: number }) => void;
}

interface ClientToServerEvents {
  'team-chat:send': (
    payload: { content: string },
    callback: (result: SocketResult<TeamMessageResult>) => void,
  ) => void;
  'team-chat:update': (
    payload: { id: number; content: string },
    callback: (result: SocketResult<TeamMessageResult>) => void,
  ) => void;
  'team-chat:delete': (
    payload: { id: number },
    callback: (result: SocketResult<{ id: number }>) => void,
  ) => void;
}

interface ChatSocketData {
  user?: AuthUser;
}

type ChatSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  ChatSocketData
>;

@WebSocketGateway({
  namespace: '/team-chat',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class TeamChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    ChatSocketData
  >;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly teamChatService: TeamChatService,
  ) {}

  async handleConnection(client: ChatSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('Потрібна авторизація');

      const payload =
        await this.jwtService.verifyAsync<AuthTokenPayload>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      });
      if (!user?.isActive) throw new Error('Обліковий запис неактивний');

      client.data.user = user;
      await client.join('team');
      client.emit('team-chat:ready', { userId: user.id });
    } catch (error) {
      client.emit('team-chat:error', {
        message:
          error instanceof Error ? error.message : 'Не вдалося підключити чат',
      });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('team-chat:send')
  sendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { content?: string },
  ): Promise<SocketResult<TeamMessageResult>> {
    return this.execute(client, async (user) => {
      const message = await this.teamChatService.create(
        { content: payload?.content || '' },
        user,
      );
      this.broadcastCreated(message);
      return message;
    });
  }

  @SubscribeMessage('team-chat:update')
  updateMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { id?: number; content?: string },
  ): Promise<SocketResult<TeamMessageResult>> {
    return this.execute(client, async (user) => {
      if (!Number.isInteger(payload?.id)) {
        throw new Error('Некоректний ID повідомлення');
      }
      const message = await this.teamChatService.update(
        payload.id as number,
        { content: payload?.content || '' },
        user,
      );
      this.broadcastUpdated(message);
      return message;
    });
  }

  @SubscribeMessage('team-chat:delete')
  deleteMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { id?: number },
  ): Promise<SocketResult<{ id: number }>> {
    return this.execute(client, async (user) => {
      if (!Number.isInteger(payload?.id)) {
        throw new Error('Некоректний ID повідомлення');
      }
      const id = payload.id as number;
      await this.teamChatService.remove(id, user);
      this.broadcastDeleted(id);
      return { id };
    });
  }

  broadcastCreated(message: TeamMessageResult) {
    this.server.to('team').emit('team-chat:message-created', message);
  }

  broadcastUpdated(message: TeamMessageResult) {
    this.server.to('team').emit('team-chat:message-updated', message);
  }

  broadcastDeleted(id: number) {
    this.server.to('team').emit('team-chat:message-deleted', { id });
  }

  private extractToken(client: ChatSocket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken) return authToken;

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization !== 'string') return undefined;
    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  private async execute<T>(
    client: ChatSocket,
    action: (user: AuthUser) => Promise<T>,
  ): Promise<SocketResult<T>> {
    const user = client.data.user;
    if (!user) return { ok: false, error: 'Потрібна авторизація' };

    try {
      return { ok: true, data: await action(user) };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  private errorMessage(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (
        response &&
        typeof response === 'object' &&
        'message' in response
      ) {
        const message = (response as { message: string | string[] }).message;
        return Array.isArray(message) ? message.join('. ') : message;
      }
    }
    return error instanceof Error
      ? error.message
      : 'Не вдалося виконати дію в чаті';
  }
}
