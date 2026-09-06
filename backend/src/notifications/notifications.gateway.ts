import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';
import { resolveCorsOriginsFromEnv } from '../common/utils/cors-origins';

function socketCorsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  const allowed = resolveCorsOriginsFromEnv(process.env);
  if (!origin) {
    callback(null, true);
    return;
  }
  callback(null, allowed.includes(origin));
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: socketCorsOrigin,
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<number, string[]> = new Map(); // userId -> socketIds[]
  private roleSockets: Map<string, string[]> = new Map(); // role -> socketIds[]

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.query.token;
      
      if (!token) {
        console.log('❌ No token provided, disconnecting client');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub || payload.id;
      const role = payload.role;

      // Store client socket ID for user
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      this.userSockets.get(userId)!.push(client.id);

      // Store client socket ID for role
      if (!this.roleSockets.has(role)) {
        this.roleSockets.set(role, []);
      }
      this.roleSockets.get(role)!.push(client.id);

      // Join user-specific and role-specific rooms
      client.join(`user_${userId}`);
      client.join(`role_${role}`);

      // Store user data in socket
      client.data.userId = userId;
      client.data.role = role;

      console.log(`✅ Client connected: user_${userId}, role_${role}`);
    } catch (error) {
      console.error('❌ Connection error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const role = client.data.role;

    // Remove socket from user map
    if (userId && this.userSockets.has(userId)) {
      const sockets = this.userSockets.get(userId)!;
      const index = sockets.indexOf(client.id);
      if (index > -1) {
        sockets.splice(index, 1);
      }
      if (sockets.length === 0) {
        this.userSockets.delete(userId);
      }
    }

    // Remove socket from role map
    if (role && this.roleSockets.has(role)) {
      const sockets = this.roleSockets.get(role)!;
      const index = sockets.indexOf(client.id);
      if (index > -1) {
        sockets.splice(index, 1);
      }
      if (sockets.length === 0) {
        this.roleSockets.delete(role);
      }
    }

    console.log(`❌ Client disconnected: user_${userId}, role_${role}`);
  }

  /**
   * Send notification to a specific user
   */
  sendToUser(userId: number, notification: any) {
    this.server.to(`user_${userId}`).emit('notification', notification);
    console.log(`📤 Sent notification to user_${userId}:`, notification.title);
  }

  /**
   * Send notification to all users with a specific role
   */
  sendToRole(role: string, notification: any) {
    this.server.to(`role_${role}`).emit('notification', notification);
    console.log(`📤 Sent notification to role_${role}:`, notification.title);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(notification: any) {
    this.server.emit('notification', notification);
    console.log(`📢 Broadcast notification:`, notification.title);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    return { event: 'pong', data: { timestamp: Date.now() } };
  }
}

