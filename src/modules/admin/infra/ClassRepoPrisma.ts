
import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { ClassRepo } from '../domain/Class/Ports.js';
import type {
  Class,
  ClassWithContext,
  CreateClassData,
  UpdateClassData,
  ClassFilters,
} from '../domain/Class/Types.js';
import type { PaginatedResult } from '../domain/shared/Pagination.js';
import { Prisma } from '../../../generated/prisma/index.js';

export class ClassRepoPrisma implements ClassRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateClassData): Promise<Class> {
    try {
      const classEntity = await this.prisma.class.create({
        data: {
          name: data.name,
          code: data.code,
          majorId: data.majorId,
        },
      });

      return this.mapToClass(classEntity);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('DUPLICATE_CODE');
        }
        if (error.code === 'P2003') {
          throw new Error('MAJOR_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<ClassWithContext | null> {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      include: {
        major: {
          include: {
            faculty: true,
          },
        },
      },
    });

    if (!classEntity) {
      return null;
    }

    return this.mapToClassWithContext(classEntity);
  }

  async findByCode(code: string): Promise<Class | null> {
    const classEntity = await this.prisma.class.findUnique({
      where: { code },
    });

    if (!classEntity) {
      return null;
    }

    return this.mapToClass(classEntity);
  }

  async findAll(filters: ClassFilters): Promise<PaginatedResult<ClassWithContext>> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const whereClause: Prisma.ClassWhereInput = {};

    if (filters.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.majorId) {
      whereClause.majorId = filters.majorId;
    }

    if (filters.facultyId) {
      whereClause.major = {
        facultyId: filters.facultyId,
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.class.findMany({
        where: whereClause,
        include: {
          major: {
            include: {
              faculty: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.class.count({ where: whereClause }),
    ]);

    return {
      items: items.map((item) => this.mapToClassWithContext(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async update(id: string, data: UpdateClassData): Promise<Class> {
    try {
      const classEntity = await this.prisma.class.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.code !== undefined && { code: data.code }),
          ...(data.majorId !== undefined && { majorId: data.majorId }),
        },
      });

      return this.mapToClass(classEntity);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('DUPLICATE_CODE');
        }
        if (error.code === 'P2003') {
          throw new Error('MAJOR_NOT_FOUND');
        }
        if (error.code === 'P2025') {
          throw new Error('CLASS_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.class.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('CLASS_NOT_FOUND');
        }
        if (error.code === 'P2003') {
          throw new Error('HAS_LINKED_ENTITIES');
        }
      }
      throw error;
    }
  }

  async hasLinkedStudents(id: string): Promise<boolean> {
    const count = await this.prisma.student.count({
      where: { classId: id },
    });
    return count > 0;
  }

  private mapToClass(prismaClass: {
    id: string;
    name: string;
    code: string;
    majorId: string;
    createdAt: Date;
    updatedAt: Date;
  }): Class {
    return {
      id: prismaClass.id,
      name: prismaClass.name,
      code: prismaClass.code,
      majorId: prismaClass.majorId,
      createdAt: prismaClass.createdAt,
      updatedAt: prismaClass.updatedAt,
    };
  }

  private mapToClassWithContext(prismaClass: {
    id: string;
    name: string;
    code: string;
    majorId: string;
    createdAt: Date;
    updatedAt: Date;
    major: {
      id: string;
      name: string;
      code: string;
      facultyId: string;
      createdAt: Date;
      updatedAt: Date;
      faculty: {
        id: string;
        name: string;
        code: string;
        createdAt: Date;
        updatedAt: Date;
      };
    };
  }): ClassWithContext {
    return {
      id: prismaClass.id,
      name: prismaClass.name,
      code: prismaClass.code,
      majorId: prismaClass.majorId,
      createdAt: prismaClass.createdAt,
      updatedAt: prismaClass.updatedAt,
      major: {
        id: prismaClass.major.id,
        name: prismaClass.major.name,
        code: prismaClass.major.code,
        facultyId: prismaClass.major.facultyId,
        createdAt: prismaClass.major.createdAt,
        updatedAt: prismaClass.major.updatedAt,
      },
      faculty: {
        id: prismaClass.major.faculty.id,
        name: prismaClass.major.faculty.name,
        code: prismaClass.major.faculty.code,
        createdAt: prismaClass.major.faculty.createdAt,
        updatedAt: prismaClass.major.faculty.updatedAt,
      },
    };
  }
}
