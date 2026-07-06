
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

export class DepartmentRepoPrisma implements DepartmentRepo {
  constructor(private readonly prisma: PrismaClient) {}

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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('DUPLICATE_CODE');
        }
        if (error.code === 'P2003') {
          throw new Error('FACULTY_NOT_FOUND');
        }
      }
      throw error;
    }
  }

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

  async findByCode(code: string): Promise<Department | null> {
    const department = await this.prisma.department.findUnique({
      where: { code },
    });

    if (!department) {
      return null;
    }

    return this.mapToDepartment(department);
  }

  async findAll(filters: DepartmentFilters): Promise<PaginatedResult<DepartmentWithContext>> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

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

    const [items, total] = await Promise.all([
      this.prisma.department.findMany({
        where: whereClause,
        include: {
          faculty: true,
        },
        orderBy: { updatedAt: 'desc' },
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('DUPLICATE_CODE');
        }
        if (error.code === 'P2003') {
          throw new Error('FACULTY_NOT_FOUND');
        }
        if (error.code === 'P2025') {
          throw new Error('DEPARTMENT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.department.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('DEPARTMENT_NOT_FOUND');
        }
        if (error.code === 'P2003') {
          throw new Error('HAS_LINKED_ENTITIES');
        }
      }
      throw error;
    }
  }

  async hasLinkedTeachers(id: string): Promise<boolean> {
    const count = await this.prisma.teacher.count({
      where: { departmentId: id },
    });
    return count > 0;
  }

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
