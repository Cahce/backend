/**
 * Prisma implementation of AdminAccountRepo.
 *
 * Infrastructure layer implementation of the AdminAccountRepo port.
 * Application/domain code must depend only on the port, never on PrismaClient.
 */

import type { PrismaClient, UserRole as PrismaUserRole } from '../../../generated/prisma/index.js';
import type { AdminAccountRepo } from '../domain/AccountManagement/Ports.js';
import type {
  Account,
  AccountLink,
  AccountWithLink,
  AccountWithProfile,
  CreateAccountInput,
  ListAccountsQuery,
  UpdateAccountInput,
  UserRole,
} from '../domain/AccountManagement/Types.js';
import type { PaginatedResult } from '../domain/shared/Pagination.js';

type PrismaUser = {
  id: string;
  email: string;
  role: PrismaUserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaUserWithLink = PrismaUser & {
  teacher?: { id: string; fullName: string; teacherCode: string } | null;
  student?: { id: string; fullName: string; studentCode: string } | null;
};

type PrismaUserWithProfile = PrismaUser & {
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
};

const LINK_INCLUDE = {
  teacher: {
    select: { id: true, fullName: true, teacherCode: true },
  },
  student: {
    select: { id: true, fullName: true, studentCode: true },
  },
} as const;

const PROFILE_INCLUDE = {
  teacher: {
    select: { id: true, teacherCode: true, fullName: true, departmentId: true },
  },
  student: {
    select: { id: true, studentCode: true, fullName: true, classId: true },
  },
} as const;

export class AdminAccountRepoPrisma implements AdminAccountRepo {
  constructor(private readonly prisma: PrismaClient) {}

  // --- Profile-aware lookups -----------------------------------------------

  async findByIdWithProfile(id: string): Promise<AccountWithProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: PROFILE_INCLUDE,
    });
    if (!user) return null;
    return this.mapToAccountWithProfile(user);
  }

  async findByEmailWithProfile(email: string): Promise<AccountWithProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: PROFILE_INCLUDE,
    });
    if (!user) return null;
    return this.mapToAccountWithProfile(user);
  }

  // --- Account CRUD --------------------------------------------------------

  async findById(id: string): Promise<AccountWithLink | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: LINK_INCLUDE,
    });
    if (!user) return null;
    return this.mapToAccountWithLink(user);
  }

  async findByEmail(email: string): Promise<Account | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    return this.mapToAccount(user);
  }

  async list(query: ListAccountsQuery): Promise<PaginatedResult<AccountWithLink>> {
    const { search, role, isActive, hasLink } = query;
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);

    const where: Record<string, unknown> = {};
    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }
    if (role) {
      where.role = role;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (hasLink !== undefined) {
      if (hasLink) {
        where.OR = [{ teacher: { isNot: null } }, { student: { isNot: null } }];
      } else {
        where.AND = [{ teacher: null }, { student: null }];
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: LINK_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => this.mapToAccountWithLink(u)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async create(data: CreateAccountInput): Promise<Account> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role as PrismaUserRole,
        isActive: data.isActive,
      },
    });
    return this.mapToAccount(user);
  }

  async update(id: string, data: UpdateAccountInput): Promise<Account> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email: data.email,
        role: data.role as PrismaUserRole | undefined,
        isActive: data.isActive,
        passwordHash: data.passwordHash,
        passwordChangedAt: data.passwordChangedAt,
      },
    });
    return this.mapToAccount(user);
  }

  async resetPassword(id: string, passwordHash: string): Promise<Account> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
      },
    });
    return this.mapToAccount(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async hasLinkedTeacher(accountId: string): Promise<boolean> {
    const count = await this.prisma.teacher.count({ where: { accountId } });
    return count > 0;
  }

  async hasLinkedStudent(accountId: string): Promise<boolean> {
    const count = await this.prisma.student.count({ where: { accountId } });
    return count > 0;
  }

  async linkToTeacher(accountId: string, teacherId: string): Promise<void> {
    await this.prisma.teacher.update({
      where: { id: teacherId },
      data: { accountId },
    });
  }

  async linkToStudent(accountId: string, studentId: string): Promise<void> {
    await this.prisma.student.update({
      where: { id: studentId },
      data: { accountId },
    });
  }

  // --- Mapping helpers -----------------------------------------------------

  private mapToAccount(user: PrismaUser): Account {
    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      passwordChangedAt: user.passwordChangedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private mapToAccountWithLink(user: PrismaUserWithLink): AccountWithLink {
    let link: AccountLink | null = null;
    if (user.teacher) {
      link = {
        type: 'teacher',
        id: user.teacher.id,
        fullName: user.teacher.fullName,
        code: user.teacher.teacherCode,
      };
    } else if (user.student) {
      link = {
        type: 'student',
        id: user.student.id,
        fullName: user.student.fullName,
        code: user.student.studentCode,
      };
    }
    return { ...this.mapToAccount(user), link };
  }

  private mapToAccountWithProfile(user: PrismaUserWithProfile): AccountWithProfile {
    return {
      ...this.mapToAccount(user),
      teacherProfile: user.teacher
        ? {
            id: user.teacher.id,
            teacherCode: user.teacher.teacherCode,
            fullName: user.teacher.fullName,
            departmentId: user.teacher.departmentId,
          }
        : undefined,
      studentProfile: user.student
        ? {
            id: user.student.id,
            studentCode: user.student.studentCode,
            fullName: user.student.fullName,
            classId: user.student.classId,
          }
        : undefined,
    };
  }
}
