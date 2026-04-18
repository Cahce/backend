/**
 * Prisma implementation of Class repository
 * 
 * Infrastructure layer implementation of ClassRepo port.
 * Handles all Class data access operations using Prisma.
 */

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

/**
 * Prisma-based Class repository implementation
 */
export class ClassRepoPrisma implements ClassRepo {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new Class
   */
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
      // Handle Prisma unique constraint violation
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - code already exists
          throw new Error('DUPLICATE_CODE');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation - majorId does not exist
          throw new Error('MAJOR_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Find Class by ID with enriched context (nested Major and Faculty)
   */
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

  /**
   * Find Class by code
   * Used for duplicate code checking during create/update
   */
  async findByCode(code: string): Promise<Class | null> {
    const classEntity = await this.prisma.class.findUnique({
      where: { code },
    });

    if (!classEntity) {
      return null;
    }

    return this.mapToClass(classEntity);
  }

  /**
   * Find all Classes with optional filters and enriched context
   * Results are ordered by updatedAt descending (newest first)
   */
  async findAll(filters: ClassFilters): Promise<PaginatedResult<ClassWithContext>> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    // Build where clause for search, majorId filter, and facultyId filter (via Major)
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

    // Execute query with pagination, nested includes, and default ordering
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
        orderBy: { updatedAt: 'desc' }, // Default ordering: newest first
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

  /**
   * Update an existing Class
   */
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
      // Handle Prisma unique constraint violation
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - code already exists
          throw new Error('DUPLICATE_CODE');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation - majorId does not exist
          throw new Error('MAJOR_NOT_FOUND');
        }
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('CLASS_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Delete a Class
   * Should only be called after checking deletion policies
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.class.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('CLASS_NOT_FOUND');
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
   * Check if Class has any linked Students
   * Used by deletion policy to prevent orphaned data
   */
  async hasLinkedStudents(id: string): Promise<boolean> {
    const count = await this.prisma.student.count({
      where: { classId: id },
    });
    return count > 0;
  }

  /**
   * Map Prisma Class model to domain Class type
   */
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

  /**
   * Map Prisma Class with nested Major and Faculty includes to domain ClassWithContext type
   */
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
