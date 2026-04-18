/**
 * Prisma implementation of Teacher Profile repository
 * 
 * Infrastructure layer implementation of TeacherProfileRepo port.
 * Handles all Teacher Profile data access operations using Prisma.
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { TeacherProfileRepo } from '../domain/TeacherManagement/Ports.js';
import type {
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

/**
 * Prisma-based Teacher Profile repository implementation
 */
export class TeacherProfileRepoPrisma implements TeacherProfileRepo {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new Teacher Profile
   */
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
          accountId: data.accountId ?? null,
        },
      });

      return this.mapToTeacherProfile(teacher);
    } catch (error) {
      // Handle Prisma unique constraint violation
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - teacherCode or accountId already exists
          throw new Error('DUPLICATE_TEACHER_CODE');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation - departmentId or accountId does not exist
          throw new Error('DEPARTMENT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Find Teacher Profile by ID with enriched context
   */
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

  /**
   * Find Teacher Profile by teacher code
   * Used for duplicate code checking during create/update
   */
  async findByTeacherCode(code: string): Promise<TeacherProfile | null> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { teacherCode: code },
    });

    if (!teacher) {
      return null;
    }

    return this.mapToTeacherProfile(teacher);
  }

  /**
   * Find Teacher Profile by account ID
   */
  async findByAccountId(accountId: string): Promise<TeacherProfile | null> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { accountId },
    });

    if (!teacher) {
      return null;
    }

    return this.mapToTeacherProfile(teacher);
  }

  /**
   * Find all Teacher Profiles with optional filters and enriched context
   * Results are ordered by updatedAt descending (newest first)
   */
  async findAll(filters: TeacherFilters): Promise<PaginatedResult<TeacherProfileWithContext>> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    // Build where clause for search and filters
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

    // Execute query with pagination, includes, and default ordering
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
        orderBy: { updatedAt: 'desc' }, // Default ordering: newest first
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

  /**
   * Update an existing Teacher Profile
   */
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
        },
      });

      return this.mapToTeacherProfile(teacher);
    } catch (error) {
      // Handle Prisma unique constraint violation
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - teacherCode already exists
          throw new Error('DUPLICATE_TEACHER_CODE');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation - departmentId does not exist
          throw new Error('DEPARTMENT_NOT_FOUND');
        }
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('TEACHER_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Delete a Teacher Profile
   * Should only be called after checking deletion policies
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.teacher.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('TEACHER_NOT_FOUND');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation
          throw new Error('HAS_LINKED_ENTITIES');
        }
      }
      throw error;
    }
  }

  /**
   * Check if Teacher has any active advisor assignments
   * Used by deletion policy to prevent orphaned data
   */
  async hasAdvisorAssignments(id: string): Promise<boolean> {
    const count = await this.prisma.projectAdvisor.count({
      where: { teacherId: id },
    });
    return count > 0;
  }

  /**
   * Link Teacher Profile to Account
   */
  async linkToAccount(teacherId: string, accountId: string): Promise<void> {
    try {
      await this.prisma.teacher.update({
        where: { id: teacherId },
        data: { accountId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - accountId already linked
          throw new Error('ACCOUNT_ALREADY_LINKED');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation - accountId does not exist
          throw new Error('ACCOUNT_NOT_FOUND');
        }
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('TEACHER_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Unlink Teacher Profile from Account
   */
  async unlinkFromAccount(teacherId: string): Promise<void> {
    try {
      await this.prisma.teacher.update({
        where: { id: teacherId },
        data: { accountId: null },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('TEACHER_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Bulk import teachers from Excel
   * Creates or updates teachers based on mode
   * 
   * NOTE: This is a placeholder implementation
   * Full Excel import functionality will be implemented after CRUD is stable
   */
  async bulkUpsert(_teachers: TeacherImportRow[], _mode: ImportMode): Promise<ImportResult> {
    // Placeholder implementation
    return {
      totalRows: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  }

  /**
   * Map Prisma Teacher model to domain TeacherProfile type
   */
  private mapToTeacherProfile(prismaTeacher: {
    id: string;
    accountId: string | null;
    teacherCode: string;
    fullName: string;
    departmentId: string;
    academicRank: string;
    academicDegree: string;
    phone: string | null;
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
      createdAt: prismaTeacher.createdAt,
      updatedAt: prismaTeacher.updatedAt,
    };
  }

  /**
   * Map Prisma Teacher with includes to domain TeacherProfileWithContext type
   */
  private mapToTeacherProfileWithContext(prismaTeacher: {
    id: string;
    accountId: string | null;
    teacherCode: string;
    fullName: string;
    departmentId: string;
    academicRank: string;
    academicDegree: string;
    phone: string | null;
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
