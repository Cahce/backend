/**
 * Prisma implementation of Department repository
 * 
 * Infrastructure layer implementation of DepartmentRepo port.
 * Handles all Department data access operations using Prisma.
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { DepartmentRepo } from '../domain/Department/Ports.js';
import type {
  Department,
  DepartmentWithContext,
  CreateDepartmentData,
  UpdateDepartmentData,
  DepartmentFilters,
} from '../domain/Department/Types.js';
import type { PaginatedResult } from '../domain/shared/Pagination.js';
import { Prisma } from '../../../generated/prisma/index.js';

/**
 * Prisma-based Department repository implementation
 */
export class DepartmentRepoPrisma implements DepartmentRepo {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new Department
   */
  async create(data: CreateDepartmentData): Promise<Department> {
    try {
      const department = await this.prisma.department.create({
        data: {
          name: data.name,
          code: data.code,
          facultyId: data.facultyId,
        },
      });

      return this.mapToDepartment(department);
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
   * Find Department by ID with enriched context
   */
  async findById(id: string): Promise<DepartmentWithContext | null> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        faculty: true,
      },
    });

    if (!department) {
      return null;
    }

    return this.mapToDepartmentWithContext(department);
  }

  /**
   * Find Department by code
   * Used for duplicate code checking during create/update
   */
  async findByCode(code: string): Promise<Department | null> {
    const department = await this.prisma.department.findUnique({
      where: { code },
    });

    if (!department) {
      return null;
    }

    return this.mapToDepartment(department);
  }

  /**
   * Find all Departments with optional filters and enriched context
   * Results are ordered by updatedAt descending (newest first)
   */
  async findAll(filters: DepartmentFilters): Promise<PaginatedResult<DepartmentWithContext>> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    // Build where clause for search and facultyId filter
    const whereClause: Prisma.DepartmentWhereInput = {};

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
      this.prisma.department.findMany({
        where: whereClause,
        include: {
          faculty: true,
        },
        orderBy: { updatedAt: 'desc' }, // Default ordering: newest first
        skip,
        take: pageSize,
      }),
      this.prisma.department.count({ where: whereClause }),
    ]);

    return {
      items: items.map((item) => this.mapToDepartmentWithContext(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update an existing Department
   */
  async update(id: string, data: UpdateDepartmentData): Promise<Department> {
    try {
      const department = await this.prisma.department.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.code !== undefined && { code: data.code }),
          ...(data.facultyId !== undefined && { facultyId: data.facultyId }),
        },
      });

      return this.mapToDepartment(department);
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
          throw new Error('DEPARTMENT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Delete a Department
   * Should only be called after checking deletion policies
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.department.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('DEPARTMENT_NOT_FOUND');
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
   * Check if Department has any linked Teachers
   * Used by deletion policy to prevent orphaned data
   */
  async hasLinkedTeachers(id: string): Promise<boolean> {
    const count = await this.prisma.teacher.count({
      where: { departmentId: id },
    });
    return count > 0;
  }

  /**
   * Map Prisma Department model to domain Department type
   */
  private mapToDepartment(prismaDepartment: {
    id: string;
    name: string;
    code: string;
    facultyId: string;
    createdAt: Date;
    updatedAt: Date;
  }): Department {
    return {
      id: prismaDepartment.id,
      name: prismaDepartment.name,
      code: prismaDepartment.code,
      facultyId: prismaDepartment.facultyId,
      createdAt: prismaDepartment.createdAt,
      updatedAt: prismaDepartment.updatedAt,
    };
  }

  /**
   * Map Prisma Department with Faculty include to domain DepartmentWithContext type
   */
  private mapToDepartmentWithContext(prismaDepartment: {
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
  }): DepartmentWithContext {
    return {
      id: prismaDepartment.id,
      name: prismaDepartment.name,
      code: prismaDepartment.code,
      facultyId: prismaDepartment.facultyId,
      createdAt: prismaDepartment.createdAt,
      updatedAt: prismaDepartment.updatedAt,
      faculty: {
        id: prismaDepartment.faculty.id,
        name: prismaDepartment.faculty.name,
        code: prismaDepartment.faculty.code,
        createdAt: prismaDepartment.faculty.createdAt,
        updatedAt: prismaDepartment.faculty.updatedAt,
      },
    };
  }
}
