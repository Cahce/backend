
import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { StudentProfileRepo } from '../domain/StudentManagement/Ports.js';
import type {
  Gender,
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

export function buildStudentWhereClause(filters: StudentFilters): Prisma.StudentWhereInput {
  const where: Prisma.StudentWhereInput = {};

  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { studentCode: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.classId) {
    where.classId = filters.classId;
  }

  const classWhere: Prisma.ClassWhereInput = {};
  if (filters.majorId) {
    classWhere.majorId = filters.majorId;
  }
  if (filters.facultyId) {
    classWhere.major = { facultyId: filters.facultyId };
  }
  if (Object.keys(classWhere).length > 0) {
    where.class = classWhere;
  }

  if (filters.hasAccount !== undefined) {
    where.accountId = filters.hasAccount ? { not: null } : null;
  }

  return where;
}

export class StudentProfileRepoPrisma implements StudentProfileRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateStudentData): Promise<StudentProfile> {
    try {
      const student = await this.prisma.student.create({
        data: {
          studentCode: data.studentCode,
          fullName: data.fullName,
          classId: data.classId,
          phone: data.phone ?? null,
          gender: data.gender ?? null,
          dateOfBirth: data.dateOfBirth ?? null,
          address: data.address ?? null,
          accountId: data.accountId ?? null,
        },
      });

      return this.mapToStudentProfile(student);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('DUPLICATE_STUDENT_CODE');
        }
        if (error.code === 'P2003') {
          throw new Error('CLASS_NOT_FOUND');
        }
      }
      throw error;
    }
  }

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

  async findByStudentCode(code: string): Promise<StudentProfile | null> {
    const student = await this.prisma.student.findUnique({
      where: { studentCode: code },
    });

    if (!student) {
      return null;
    }

    return this.mapToStudentProfile(student);
  }

  async findByAccountId(accountId: string): Promise<StudentProfile | null> {
    const student = await this.prisma.student.findUnique({
      where: { accountId },
    });

    if (!student) {
      return null;
    }

    return this.mapToStudentProfile(student);
  }

  async findAll(filters: StudentFilters): Promise<PaginatedResult<StudentProfileWithContext>> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const whereClause = buildStudentWhereClause(filters);

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
        orderBy: { updatedAt: 'desc' },
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

  async update(id: string, data: UpdateStudentData): Promise<StudentProfile> {
    try {
      const student = await this.prisma.student.update({
        where: { id },
        data: {
          ...(data.studentCode !== undefined && { studentCode: data.studentCode }),
          ...(data.fullName !== undefined && { fullName: data.fullName }),
          ...(data.classId !== undefined && { classId: data.classId }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.gender !== undefined && { gender: data.gender }),
          ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth }),
          ...(data.address !== undefined && { address: data.address }),
        },
      });

      return this.mapToStudentProfile(student);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('DUPLICATE_STUDENT_CODE');
        }
        if (error.code === 'P2003') {
          throw new Error('CLASS_NOT_FOUND');
        }
        if (error.code === 'P2025') {
          throw new Error('STUDENT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.student.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('STUDENT_NOT_FOUND');
        }
        if (error.code === 'P2003') {
          throw new Error('HAS_LINKED_ENTITIES');
        }
      }
      throw error;
    }
  }

  async linkToAccount(studentId: string, accountId: string): Promise<void> {
    try {
      await this.prisma.student.update({
        where: { id: studentId },
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
          throw new Error('STUDENT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async unlinkFromAccount(studentId: string): Promise<void> {
    try {
      await this.prisma.student.update({
        where: { id: studentId },
        data: { accountId: null },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('STUDENT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async bulkUpsert(_students: StudentImportRow[], _mode: ImportMode): Promise<ImportResult> {
    return {
      totalRows: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  }

  private mapToStudentProfile(prismaStudent: {
    id: string;
    accountId: string | null;
    studentCode: string;
    fullName: string;
    classId: string;
    phone: string | null;
    gender: Gender | null;
    dateOfBirth: Date | null;
    address: string | null;
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
      gender: prismaStudent.gender,
      dateOfBirth: prismaStudent.dateOfBirth,
      address: prismaStudent.address,
      createdAt: prismaStudent.createdAt,
      updatedAt: prismaStudent.updatedAt,
    };
  }

  private mapToStudentProfileWithContext(prismaStudent: {
    id: string;
    accountId: string | null;
    studentCode: string;
    fullName: string;
    classId: string;
    phone: string | null;
    gender: Gender | null;
    dateOfBirth: Date | null;
    address: string | null;
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
      gender: prismaStudent.gender,
      dateOfBirth: prismaStudent.dateOfBirth,
      address: prismaStudent.address,
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
