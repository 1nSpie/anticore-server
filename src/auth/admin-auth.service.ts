// src/admin/admin-auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

interface JwtPayload {
  sub: string;
  role: 'admin';
  iat: number;
  exp: number;
}

@Injectable()
export class AdminAuthService {
  private readonly adminLogin = process.env.ADMIN_LOGIN 
  private readonly adminPassword = process.env.ADMIN_PASSWORD 
  private readonly jwtSecret = process.env.JWT_SECRET 

  validateCredentials(login: string, password: string): boolean {
    return login === this.adminLogin && password === this.adminPassword;
  }

  createToken(): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: 'admin',
      role: 'admin',
    };

    return jwt.sign(payload, this.jwtSecret!, {
      expiresIn: '12h',
    });
  }

  verifyToken(token: string): { isValid: boolean; payload?: JwtPayload; error?: string } {
    try {
      const payload = jwt.verify(token, this.jwtSecret!) as JwtPayload;
      return { isValid: true, payload };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { isValid: false, error: 'Token expired' };
      }
      return { isValid: false, error: 'Invalid token' };
    }
  }
}