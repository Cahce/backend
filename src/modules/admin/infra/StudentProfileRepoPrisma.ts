/**
 * Prisma implementation of Student Profile repository
 * 
 * Infrastructure layer implementation of StudentProfileRepo port.
 * Handles all Student Profile data access operations using Prisma.
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { StudentProfileRepo } from '../domain/StudentManagement/Ports.js';
import type {
  StudentProfile,
  StudentProfileWithContext,
  CreateStudentData,
  UpdateStudentData,
  StudentFilters,
  StudentImportRow,
  ImportMode,
  ImportResult
} from '../domain/StudentManagement/Types.js';
import type { PaginatedResult } from '../application/Types.js';
import { Prisma } from '../../../generated/prisma/index.js';

/**
 * Prisma-based Student Profile repository implementation
 */
export class StudentProfileRepoPrisma implements StudentProfileRepo {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new Student Profile
   */
  async create(data: CreateStudentData): Promise<StudentProfile> {
    try {
      const student = await this.prisma.student.create({
        data: {
          studentCode: data.studentCode,
          fullName: data.fullName,
          classId: data.classId,
          phone: data.phone ?? null,
          accountId: data.accountId ?? null,
        },
      });

      return this.mapToStudentProfile(student);
    } catch (error) {
      // Handle Prisma unique constraint violation
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - studentCode or accountId already exists
          throw new Error('DUPLICATE_STUDENT_CODE');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation - classId or accountId does not exist
          throw new Error('CLASS_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Find Student Profile by ID with enriched context
   */
  async findById(id: string): Promise<StudentProfileWithContext | null> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            major: {
              include: {
                faculty: true,
              },
            },
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

    if (!student) {
      return null;
    }

    return this.mapToStudentProfileWithContext(student);
  }

  /**
   * Find Student Profile by student code
   * Used for duplicate code checking during create/update
   */
  async findByStudentCode(code: string): Promise<StudentProfile | null> {
    const student = await this.prisma.student.findUnique({
      where: { studentCode: code },
    });

    if (!student) {
      return null;
    }

    return this.mapToStudentProfile(student);
  }

  /**
   * Find Student Profile by account ID
   */
  async findByAccountId(accountId: string): Promise<StudentProfile | null> {
    const student = await this.prisma.student.findUnique({
      where: { accountId },
    });

    if (!student) {
      return null;
    }

    return this.mapToStudentProfile(student);
  }

  /**
   * Find all Student Profiles with optional filters and enriched context
   * Results are ordered by updatedAt descending (newest first)
   */
  async findAll(filters: StudentFilters): Promise<PaginatedResult<StudentProfileWithContext>> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    // Build where clause for search and filters
    const whereClause: Prisma.StudentWhereInput = {};

    if (filters.search) {
      whereClause.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { studentCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.classId) {
      whereClause.classId = filters.classId;
    }

    if (filters.majorId) {
      whereClause.class = {
        majorId: filters.majorId,
      };
    }

    if (filters.facultyId) {
      whereClause.class = {
        major: {
          facultyId: filters.facultyId,
        },
      };
    }

    if (filters.hasAccount !== undefined) {
      whereClause.accountId = filters.hasAccount ? { not: null } : null;
    }

    // Execute query with pagination, includes, and default ordering
    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where: whereClause,
        include: {
          class: {
            include: {
              major: {
                include: {
                  faculty: true,
                },
              },
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
      this.prisma.student.count({ where: whereClause }),
    ]);

    return {
      items: items.map((item) => this.mapToStudentProfileWithContext(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update an existing Student Profile
   */
  async update(id: string, data: UpdateStudentData): Promise<StudentProfile> {
    try {
      const student = await this.prisma.student.update({
        where: { id },
        data: {
          ...(data.studentCode !== undefined && { studentCode: data.studentCode }),
          ...(data.fullName !== undefined && { fullName: data.fullName }),
          ...(data.classId !== undefined && { classId: data.classId }),
          ...(data.phone !== undefined && { phone: data.phone }),
        },
      });

      return this.mapToStudentProfile(student);
    } catch (error) {
      // Handle Prisma unique constraint violation
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - studentCode already exists
          throw new Error('DUPLICATE_STUDENT_CODE');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation - classId does not exist
          throw new Error('CLASS_NOT_FOUND');
        }
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('STUDENT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Delete a Student Profile
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.student.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('STUDENT_NOT_FOUND');
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
   * Link Student Profile to Account
   */
  async linkToAccount(studentId: string, accountId: string): Promise<void> {
    try {
      await this.prisma.student.update({
        where: { id: studentId },
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
          throw new Error('STUDENT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Unlink Student Profile from Account
   */
  async unlinkFromAccount(studentId: string): Promise<void> {
    try {
      await this.prisma.student.update({
        where: { id: studentId },
        data: { accountId: null },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('STUDENT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Bulk import students from Excel
   * Creates or updates students based on mode
   * 
   * NOTE: This is a placeholder implementation
   * Full Excel import functionality will be implemented after CRUD is stable
   */
  async bulkUpsert(_students: StudentImportRow[], _mode: ImportMode): Promise<ImportResult> {
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
   * Map Prisma Student model to domain StudentProfile type
   */
  private mapToStudentProfile(prismaStudent: {
    id: string;
    accountId: string | null;
    studentCode: string;
    fullName: string;
    classId: string;
    phone: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): StudentProfile {
    return {
      id: prismaStudent.id,
      accountId: prismaStudent.accountId,
      studentCode: prismaStudent.studentCode,
      fullName: prismaStudent.fullName,
      classId: prismaStudent.classId,
      phone: prismaStudent.phone,
      createdAt: prismaStudent.createdAt,
      updatedAt: prismaStudent.updatedAt,
    };
  }

  /**
   * Map Prisma Student with includes to domain StudentProfileWithContext type
   */
  private mapToStudentProfileWithContext(prismaStudent: {
    id: string;
    accountId: string | null;
    studentCode: string;
    fullName: string;
    classId: string;
    phone: string | null;
    createdAt: Date;
    updatedAt: Date;
    class: {
      id: string;
      name: string;
      code: string;
      majorId: string;
      major: {
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
    };
    account: {
      id: string;
      email: string;
      role: string;
      isActive: boolean;
    } | null;
  }): StudentProfileWithContext {
    return {
      id: prismaStudent.id,
      accountId: prismaStudent.accountId,
      studentCode: prismaStudent.studentCode,
      fullName: prismaStudent.fullName,
      classId: prismaStudent.classId,
      phone: prismaStudent.phone,
      createdAt: prismaStudent.createdAt,
      updatedAt: prismaStudent.updatedAt,
      class: {
        id: prismaStudent.class.id,
        name: prismaStudent.class.name,
        code: prismaStudent.class.code,
        majorId: prismaStudent.class.majorId,
      },
      major: {
        id: prismaStudent.class.major.id,
        name: prismaStudent.class.major.name,
        code: prismaStudent.class.major.code,
        facultyId: prismaStudent.class.major.facultyId,
      },
      faculty: {
        id: prismaStudent.class.major.faculty.id,
        name: prismaStudent.class.major.faculty.name,
        code: prismaStudent.class.major.faculty.code,
      },
      account: prismaStudent.account ? {
        id: prismaStudent.account.id,
        email: prismaStudent.account.email,
        role: prismaStudent.account.role,
        isActive: prismaStudent.account.isActive,
      } : undefined,
    };
  }
}
