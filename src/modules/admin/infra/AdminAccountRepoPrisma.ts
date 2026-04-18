/**
 * Prisma implementation of Admin Account repository
 * 
 * Infrastructure layer implementation of AdminAccountRepo port.
 * Handles account queries with profile information for admin operations.
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { AdminAccountRepo } from '../domain/AccountManagement/Ports.js';
import type { AccountWithProfile } from '../domain/AccountManagement/Types.js';

/**
 * Prisma-based Admin Account repository implementation
 */
export class AdminAccountRepoPrisma implements AdminAccountRepo {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find account by ID with profile information
   * Includes teacher and student profiles if linked
   */
  async findByIdWithProfile(id: string): Promise<AccountWithProfile | null> {
    const account = await this.prisma.user.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            teacherCode: true,
            fullName: true,
            departmentId: true,
          },
        },
        student: {
          select: {
            id: true,
            studentCode: true,
            fullName: true,
            classId: true,
          },
        },
      },
    });

    if (!account) {
      return null;
    }

    return this.mapToAccountWithProfile(account);
  }

  /**
   * Find account by email with profile information
   * Includes teacher and student profiles if linked
   */
  async findByEmailWithProfile(email: string): Promise<AccountWithProfile | null> {
    const account = await this.prisma.user.findUnique({
      where: { email },
      include: {
        teacher: {
          select: {
            id: true,
            teacherCode: true,
            fullName: true,
            departmentId: true,
          },
        },
        student: {
          select: {
            id: true,
            studentCode: true,
            fullName: true,
            classId: true,
          },
        },
      },
    });

    if (!account) {
      return null;
    }

    return this.mapToAccountWithProfile(account);
  }

  /**
   * Map Prisma User with profile includes to domain AccountWithProfile type
   */
  private mapToAccountWithProfile(prismaUser: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    mustChangePassword: boolean;
    createdAt: Date;
    updatedAt: Date;
    teacher: {
      id: string;
      teacherCode: string;
      fullName: string;
      departmentId: string;
    } | null;
    student: {
      id: string;
      studentCode: string;
      fullName: string;
      classId: string;
    } | null;
  }): AccountWithProfile {
    return {
      id: prismaUser.id,
      email: prismaUser.email,
      role: prismaUser.role as 'admin' | 'teacher' | 'student',
      isActive: prismaUser.isActive,
      mustChangePassword: prismaUser.mustChangePassword,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
      teacherProfile: prismaUser.teacher ? {
        id: prismaUser.teacher.id,
        teacherCode: prismaUser.teacher.teacherCode,
        fullName: prismaUser.teacher.fullName,
        departmentId: prismaUser.teacher.departmentId,
      } : undefined,
      studentProfile: prismaUser.student ? {
        id: prismaUser.student.id,
        studentCode: prismaUser.student.studentCode,
        fullName: prismaUser.student.fullName,
        classId: prismaUser.student.classId,
      } : undefined,
    };
  }
}
