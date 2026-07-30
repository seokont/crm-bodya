import { io, type Socket } from 'socket.io-client';
import { getToken } from './auth-session';
import type { TeamChatMessage } from '@/types/team-chat';

export type TeamChatSocketResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

interface ServerToClientEvents {
  'team-chat:ready': (payload: { userId: number }) => void;
  'team-chat:error': (payload: { message: string }) => void;
  'team-chat:message-created': (message: TeamChatMessage) => void;
  'team-chat:message-updated': (message: TeamChatMessage) => void;
  'team-chat:message-deleted': (payload: { id: number }) => void;
}

interface ClientToServerEvents {
  'team-chat:send': (
    payload: { content: string },
    callback: (result: TeamChatSocketResult<TeamChatMessage>) => void,
  ) => void;
  'team-chat:update': (
    payload: { id: number; content: string },
    callback: (result: TeamChatSocketResult<TeamChatMessage>) => void,
  ) => void;
  'team-chat:delete': (
    payload: { id: number },
    callback: (result: TeamChatSocketResult<{ id: number }>) => void,
  ) => void;
}

export type TeamChatSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

export function createTeamChatSocket(): TeamChatSocket {
  const configuredUrl = import.meta.env.VITE_SOCKET_URL?.replace(/\/$/, '');
  const baseUrl = configuredUrl || window.location.origin;

  return io(`${baseUrl}/team-chat`, {
    path: '/socket.io',
    autoConnect: false,
    transports: ['websocket', 'polling'],
    auth: (callback) => {
      callback({ token: getToken() });
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}
