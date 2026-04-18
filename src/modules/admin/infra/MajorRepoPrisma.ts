/**
 * Prisma implementation of Major repository
 * 
 * Infrastructure layer implementation of MajorRepo port.
 * Handles all Major data access operations using Prisma.
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { MajorRepo } from '../domain/Major/Ports.js';
import type {
  Major,
  MajorWithContext,
  CreateMajorData,
  UpdateMajorData,
  MajorFilters,
} from '../domain/Major/Types.js';
import type { PaginatedResult } from '../domain/shared/Pagination.js';
import { Prisma } from '../../../generated/prisma/index.js';

/**
 * Prisma-based Major repository implementation
 */
export class MajorRepoPrisma implements MajorRepo {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new Major
   */
  async create(data: CreateMajorData): Promise<Major> {
    try {
      const major = await this.prisma.major.create({
        data: {
          name: data.name,
          code: data.code,
          facultyId: data.facultyId,
        },
      });

      return this.mapToMajor(major);
    } catch (error) {
      // Handle Prisma unique constraint violation
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - code already exists
          throw new Error('DUPLICATE_CODE');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation - facultyId does not exist
          throw new Error('FACULTY_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Find Major by ID with enriched context
   */
  async findById(id: string): Promise<MajorWithContext | null> {
    const major = await this.prisma.major.findUnique({
      where: { id },
      include: {
        faculty: true,
      },
    });

    if (!major) {
      return null;
    }

    return this.mapToMajorWithContext(major);
  }

  /**
   * Find Major by code
   * Used for duplicate code checking during create/update
   */
  async findByCode(code: string): Promise<Major | null> {
    const major = await this.prisma.major.findUnique({
      where: { code },
    });

    if (!major) {
      return null;
    }

    return this.mapToMajor(major);
  }

  /**
   * Find all Majors with optional filters and enriched context
   * Results are ordered by updatedAt descending (newest first)
   */
  async findAll(filters: MajorFilters): Promise<PaginatedResult<MajorWithContext>> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    // Build where clause for search and facultyId filter
    const whereClause: Prisma.MajorWhereInput = {};

    if (filters.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.facultyId) {
      whereClause.facultyId = filters.facultyId;
    }

    // Execute query with pagination, Faculty include, and default ordering
    const [items, total] = await Promise.all([
      this.prisma.major.findMany({
        where: whereClause,
        include: {
          faculty: true,
        },
        orderBy: { updatedAt: 'desc' }, // Default ordering: newest first
        skip,
        take: pageSize,
      }),
      this.prisma.major.count({ where: whereClause }),
    ]);

    return {
      items: items.map((item) => this.mapToMajorWithContext(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update an existing Major
   */
  async update(id: string, data: UpdateMajorData): Promise<Major> {
    try {
      const major = await this.prisma.major.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.code !== undefined && { code: data.code }),
          ...(data.facultyId !== undefined && { facultyId: data.facultyId }),
        },
      });

      return this.mapToMajor(major);
    } catch (error) {
      // Handle Prisma unique constraint violation
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - code already exists
          throw new Error('DUPLICATE_CODE');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation - facultyId does not exist
          throw new Error('FACULTY_NOT_FOUND');
        }
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('MAJOR_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Delete a Major
   * Should only be called after checking deletion policies
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.major.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('MAJOR_NOT_FOUND');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation
          throw new Error('HAS_CHILD_ENTITIES');
        }
      }
      throw error;
    }
  }

  /**
   * Check if Major has any child Classes
   * Used by deletion policy to prevent orphaned data
   */
  async hasChildClasses(id: string): Promise<boolean> {
    const count = await this.prisma.class.count({
      where: { majorId: id },
    });

    return count > 0;
  }

  /**
   * Map Prisma Major model to domain Major type
   */
  private mapToMajor(prismaMajor: {
    id: string;
    name: string;
    code: string;
    facultyId: string;
    createdAt: Date;
    updatedAt: Date;
  }): Major {
    return {
      id: prismaMajor.id,
      name: prismaMajor.name,
      code: prismaMajor.code,
      facultyId: prismaMajor.facultyId,
      createdAt: prismaMajor.createdAt,
      updatedAt: prismaMajor.updatedAt,
    };
  }

  /**
   * Map Prisma Major with Faculty include to domain MajorWithContext type
   */
  private mapToMajorWithContext(prismaMajor: {
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
  }): MajorWithContext {
    return {
      id: prismaMajor.id,
      name: prismaMajor.name,
      code: prismaMajor.code,
      facultyId: prismaMajor.facultyId,
      createdAt: prismaMajor.createdAt,
      updatedAt: prismaMajor.updatedAt,
      faculty: {
        id: prismaMajor.faculty.id,
        name: prismaMajor.faculty.name,
        code: prismaMajor.faculty.code,
        createdAt: prismaMajor.faculty.createdAt,
        updatedAt: prismaMajor.faculty.updatedAt,
      },
    };
  }
}
