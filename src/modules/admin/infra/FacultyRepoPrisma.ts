
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

export class FacultyRepoPrisma implements FacultyRepo {
  constructor(private readonly prisma: PrismaClient) {}

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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('DUPLICATE_CODE');
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Faculty | null> {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id },
    });

    if (!faculty) {
      return null;
    }

    return this.mapToFaculty(faculty);
  }

  async findByCode(code: string): Promise<Faculty | null> {
    const faculty = await this.prisma.faculty.findUnique({
      where: { code },
    });

    if (!faculty) {
      return null;
    }

    return this.mapToFaculty(faculty);
  }

  async findAll(filters: FacultyFilters): Promise<PaginatedResult<Faculty>> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const whereClause: Prisma.FacultyWhereInput = {};

    if (filters.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.faculty.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('DUPLICATE_CODE');
        }
        if (error.code === 'P2025') {
          throw new Error('FACULTY_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.faculty.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('FACULTY_NOT_FOUND');
        }
        if (error.code === 'P2003') {
          throw new Error('HAS_CHILD_ENTITIES');
        }
      }
      throw error;
    }
  }

  async hasChildDepartments(id: string): Promise<boolean> {
    const count = await this.prisma.department.count({
      where: { facultyId: id },
    });

    return count > 0;
  }

  async hasChildMajors(id: string): Promise<boolean> {
    const count = await this.prisma.major.count({
      where: { facultyId: id },
    });

    return count > 0;
  }

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
