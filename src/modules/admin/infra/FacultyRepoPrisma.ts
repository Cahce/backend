/**
 * Prisma implementation of Faculty repository
 * 
 * Infrastructure layer implementation of FacultyRepo port.
 * Handles all Faculty data access operations using Prisma.
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { FacultyRepo } from '../domain/Faculty/Ports.js';
import type {
  Faculty,
  CreateFacultyData,
  UpdateFacultyData,
  FacultyFilters,
} from '../domain/Faculty/Types.js';
import type { PaginatedResult } from '../domain/shared/Pagination.js';
import { Prisma } from '../../../generated/prisma/index.js';

/**
 * Prisma-based Faculty repository implementation
 */
export class FacultyRepoPrisma implements FacultyRepo {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new Faculty
   */
  async create(data: CreateFacultyData): Promise<Faculty> {
    try {
      const faculty = await this.prisma.faculty.create({
        data: {
          name: data.name,
          code: data.code,
        },
      });

      return this.mapToFaculty(faculty);
    } catch (error) {
      // Handle Prisma unique constraint violation
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - code already exists
          throw new Error('DUPLICATE_CODE');
        }
      }
      throw error;
    }
  }

  /**
   * Find Faculty by ID
   */
  async findById(id: string): Promise<Faculty | null> {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id },
    });

    if (!faculty) {
      return null;
    }

    return this.mapToFaculty(faculty);
  }

  /**
   * Find Faculty by code
   * Used for duplicate code checking during create/update
   */
  async findByCode(code: string): Promise<Faculty | null> {
    const faculty = await this.prisma.faculty.findUnique({
      where: { code },
    });

    if (!faculty) {
      return null;
    }

    return this.mapToFaculty(faculty);
  }

  /**
   * Find all Faculties with optional filters
   * Results are ordered by updatedAt descending (newest first)
   */
  async findAll(filters: FacultyFilters): Promise<PaginatedResult<Faculty>> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    // Build where clause for search
    const whereClause: Prisma.FacultyWhereInput = {};

    if (filters.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Execute query with pagination and default ordering
    const [items, total] = await Promise.all([
      this.prisma.faculty.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' }, // Default ordering: newest first
        skip,
        take: pageSize,
      }),
      this.prisma.faculty.count({ where: whereClause }),
    ]);

    return {
      items: items.map((item) => this.mapToFaculty(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update an existing Faculty
   */
  async update(id: string, data: UpdateFacultyData): Promise<Faculty> {
    try {
      const faculty = await this.prisma.faculty.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.code !== undefined && { code: data.code }),
        },
      });

      return this.mapToFaculty(faculty);
    } catch (error) {
      // Handle Prisma unique constraint violation
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - code already exists
          throw new Error('DUPLICATE_CODE');
        }
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('FACULTY_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Delete a Faculty
   * Should only be called after checking deletion policies
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.faculty.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('FACULTY_NOT_FOUND');
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
   * Check if Faculty has any child Departments
   * Used by deletion policy to prevent orphaned data
   */
  async hasChildDepartments(id: string): Promise<boolean> {
    const count = await this.prisma.department.count({
      where: { facultyId: id },
    });

    return count > 0;
  }

  /**
   * Check if Faculty has any child Majors
   * Used by deletion policy to prevent orphaned data
   */
  async hasChildMajors(id: string): Promise<boolean> {
    const count = await this.prisma.major.count({
      where: { facultyId: id },
    });

    return count > 0;
  }

  /**
   * Map Prisma Faculty model to domain Faculty type
   */
  private mapToFaculty(prismaFaculty: {
    id: string;
    name: string;
    code: string;
    createdAt: Date;
    updatedAt: Date;
  }): Faculty {
    return {
      id: prismaFaculty.id,
      name: prismaFaculty.name,
      code: prismaFaculty.code,
      createdAt: prismaFaculty.createdAt,
      updatedAt: prismaFaculty.updatedAt,
    };
  }
}
