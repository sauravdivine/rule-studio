import { Injectable } from '@nestjs/common';
import { permissionsFor } from '@rule-studio/permissions';
import type { User as UserDto } from '@rule-studio/shared-types';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // The shape the API returns (contracts/openapi.yaml `User`): never the password hash.
  toDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      permissions: permissionsFor(user.role),
    };
  }
}

// Emails are stored lower-case and trimmed, so sign-in ignores case and stray spaces.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
