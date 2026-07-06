
import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { TeacherProfileRepo } from '../domain/TeacherManagement/Ports.js';
import type {
  Gender,
  TeacherProfile,
  TeacherProfileWithContext,
  CreateTeacherData,
  UpdateTeacherData,
  TeacherFilters,
  TeacherImportRow,
  ImportMode,
  ImportResult
} from '../domain/TeacherManagement/Types.js';
import type { PaginatedResult } from '../application/Types.js';
import { Prisma } from '../../../generated/prisma/index.js';

export class TeacherProfileRepoPrisma implements TeacherProfileRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async listAllTeacherCodes(): Promise<string[]> {
    const rows = await this.prisma.teacher.findMany({
      select: { teacherCode: true },
    });
    return rows.map((r) => r.teacherCode);
  }

  async create(data: CreateTeacherData): Promise<TeacherProfile> {
    try {
      const teacher = await this.prisma.teacher.create({
        data: {
          teacherCode: data.teacherCode,
          fullName: data.fullName,
          departmentId: data.departmentId,
          academicRank: data.academicRank,
          academicDegree: data.academicDegree,
          phone: data.phone ?? null,
          gender: data.gender ?? null,
          dateOfBirth: data.dateOfBirth ?? null,
          address: data.address ?? null,
          accountId: data.accountId ?? null,
        },
      });

      return this.mapToTeacherProfile(teacher);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('DUPLICATE_TEACHER_CODE');
        }
        if (error.code === 'P2003') {
          throw new Error('DEPARTMENT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<TeacherProfileWithContext | null> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        department: {
          include: {
            faculty: true,
          },
        },
        account: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!teacher) {
      return null;
    }

    return this.mapToTeacherProfileWithContext(teacher);
  }

  async findByTeacherCode(code: string): Promise<TeacherProfile | null> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { teacherCode: code },
    });

    if (!teacher) {
      return null;
    }

    return this.mapToTeacherProfile(teacher);
  }

  async findByAccountId(accountId: string): Promise<TeacherProfile | null> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { accountId },
    });

    if (!teacher) {
      return null;
    }

    return this.mapToTeacherProfile(teacher);
  }

  async findAll(filters: TeacherFilters): Promise<PaginatedResult<TeacherProfileWithContext>> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const whereClause: Prisma.TeacherWhereInput = {};

    if (filters.search) {
      whereClause.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { teacherCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.departmentId) {
      whereClause.departmentId = filters.departmentId;
    }

    if (filters.facultyId) {
      whereClause.department = {
        facultyId: filters.facultyId,
      };
    }

    if (filters.hasAccount !== undefined) {
      whereClause.accountId = filters.hasAccount ? { not: null } : null;
    }

    const [items, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where: whereClause,
        include: {
          department: {
            include: {
              faculty: true,
            },
          },
          account: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.teacher.count({ where: whereClause }),
    ]);

    return {
      items: items.map((item) => this.mapToTeacherProfileWithContext(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async update(id: string, data: UpdateTeacherData): Promise<TeacherProfile> {
    try {
      const teacher = await this.prisma.teacher.update({
        where: { id },
        data: {
          ...(data.teacherCode !== undefined && { teacherCode: data.teacherCode }),
          ...(data.fullName !== undefined && { fullName: data.fullName }),
          ...(data.departmentId !== undefined && { departmentId: data.departmentId }),
          ...(data.academicRank !== undefined && { academicRank: data.academicRank }),
          ...(data.academicDegree !== undefined && { academicDegree: data.academicDegree }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.gender !== undefined && { gender: data.gender }),
          ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth }),
          ...(data.address !== undefined && { address: data.address }),
        },
      });

      return this.mapToTeacherProfile(teacher);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('DUPLICATE_TEACHER_CODE');
        }
        if (error.code === 'P2003') {
          throw new Error('DEPARTMENT_NOT_FOUND');
        }
        if (error.code === 'P2025') {
          throw new Error('TEACHER_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.teacher.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('TEACHER_NOT_FOUND');
        }
        if (error.code === 'P2003') {
          throw new Error('HAS_LINKED_ENTITIES');
        }
      }
      throw error;
    }
  }

  async hasAdvisorAssignments(id: string): Promise<boolean> {
    const count = await this.prisma.projectAdvisor.count({
      where: { teacherId: id },
    });
    return count > 0;
  }

  async linkToAccount(teacherId: string, accountId: string): Promise<void> {
    try {
      await this.prisma.teacher.update({
        where: { id: teacherId },
        data: { accountId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('ACCOUNT_ALREADY_LINKED');
        }
        if (error.code === 'P2003') {
          throw new Error('ACCOUNT_NOT_FOUND');
        }
        if (error.code === 'P2025') {
          throw new Error('TEACHER_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async unlinkFromAccount(teacherId: string): Promise<void> {
    try {
      await this.prisma.teacher.update({
        where: { id: teacherId },
        data: { accountId: null },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('TEACHER_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async bulkUpsert(_teachers: TeacherImportRow[], _mode: ImportMode): Promise<ImportResult> {
    return {
      totalRows: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  }

  private mapToTeacherProfile(prismaTeacher: {
    id: string;
    accountId: string | null;
    teacherCode: string;
    fullName: string;
    departmentId: string;
    academicRank: string;
    academicDegree: string;
    phone: string | null;
    gender: Gender | null;
    dateOfBirth: Date | null;
    address: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): TeacherProfile {
    return {
      id: prismaTeacher.id,
      accountId: prismaTeacher.accountId,
      teacherCode: prismaTeacher.teacherCode,
      fullName: prismaTeacher.fullName,
      departmentId: prismaTeacher.departmentId,
      academicRank: prismaTeacher.academicRank,
      academicDegree: prismaTeacher.academicDegree,
      phone: prismaTeacher.phone,
      gender: prismaTeacher.gender,
      dateOfBirth: prismaTeacher.dateOfBirth,
      address: prismaTeacher.address,
      createdAt: prismaTeacher.createdAt,
      updatedAt: prismaTeacher.updatedAt,
    };
  }

  private mapToTeacherProfileWithContext(prismaTeacher: {
    id: string;
    accountId: string | null;
    teacherCode: string;
    fullName: string;
    departmentId: string;
    academicRank: string;
    academicDegree: string;
    phone: string | null;
    gender: Gender | null;
    dateOfBirth: Date | null;
    address: string | null;
    createdAt: Date;
    updatedAt: Date;
    department: {
      id: string;
      name: string;
      code: string;
      facultyId: string;
      faculty: {
        id: string;
        name: string;
        code: string;
      };
    };
    account: {
      id: string;
      email: string;
      role: string;
      isActive: boolean;
    } | null;
  }): TeacherProfileWithContext {
    return {
      id: prismaTeacher.id,
      accountId: prismaTeacher.accountId,
      teacherCode: prismaTeacher.teacherCode,
      fullName: prismaTeacher.fullName,
      departmentId: prismaTeacher.departmentId,
      academicRank: prismaTeacher.academicRank,
      academicDegree: prismaTeacher.academicDegree,
      phone: prismaTeacher.phone,
      gender: prismaTeacher.gender,
      dateOfBirth: prismaTeacher.dateOfBirth,
      address: prismaTeacher.address,
      createdAt: prismaTeacher.createdAt,
      updatedAt: prismaTeacher.updatedAt,
      department: {
        id: prismaTeacher.department.id,
        name: prismaTeacher.department.name,
        code: prismaTeacher.department.code,
        facultyId: prismaTeacher.department.facultyId,
      },
      faculty: {
        id: prismaTeacher.department.faculty.id,
        name: prismaTeacher.department.faculty.name,
        code: prismaTeacher.department.faculty.code,
      },
      account: prismaTeacher.account ? {
        id: prismaTeacher.account.id,
        email: prismaTeacher.account.email,
        role: prismaTeacher.account.role,
        isActive: prismaTeacher.account.isActive,
      } : undefined,
    };
  }
}
