/**
 * Prisma implementation of {@link AdminProjectRepo}.
 *
 * Read-only queries for the admin project oversight feature. Joins the project
 * owner to its student/teacher profile (and academic unit) so the admin UI can
 * show who owns each project. Mirrors the filter/pagination style of
 * `admin/infra/StudentProfileRepoPrisma.findAll` (single findMany + count run
 * in parallel).
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import { Prisma } from '../../../generated/prisma/index.js';
import type {
  AdminProjectRepo,
  AdminProjectFilters,
  AdminProjectListResult,
  AdminProjectDetailRow,
  AdminProjectRow,
  AdminProjectOwnerView,
  AdminProjectStats,
  AdminProjectCategory,
  ProjectOwnerRole,
} from '../domain/Project/AdminProjectPorts.js';
import { ADMIN_PROJECT_CATEGORIES } from '../domain/Project/AdminProjectPorts.js';

// Owner join shared by list + detail queries.
const ownerInclude = {
  owner: {
    include: {
      student: {
        include: {
          class: { include: { major: { include: { faculty: true } } } },
        },
      },
      teacher: { include: { department: { include: { faculty: true } } } },
    },
  },
} satisfies Prisma.ProjectInclude;

const adminListInclude = {
  ...ownerInclude,
  _count: { select: { files: true, compileArtifacts: true } },
} satisfies Prisma.ProjectInclude;

const adminDetailInclude = {
  ...ownerInclude,
  settings: true,
  files: {
    select: { path: true, kind: true, sizeBytes: true, updatedAt: true },
    orderBy: { path: 'asc' },
  },
  compileArtifacts: { orderBy: { createdAt: 'desc' }, take: 1 },
  _count: { select: { files: true, compileArtifacts: true } },
} satisfies Prisma.ProjectInclude;

type AdminListPayload = Prisma.ProjectGetPayload<{ include: typeof adminListInclude }>;
type AdminDetailPayload = Prisma.ProjectGetPayload<{ include: typeof adminDetailInclude }>;
type OwnerPayload = AdminListPayload['owner'];

export class AdminProjectRepoPrisma implements AdminProjectRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async listForAdmin(filters: AdminProjectFilters): Promise<AdminProjectListResult> {
    const where = this.buildWhere(filters);
    const orderBy = {
      [filters.sort]: filters.order,
    } as Prisma.ProjectOrderByWithRelationInput;

    const [rows, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: adminListInclude,
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items: rows.map((r) => this.mapRow(r)), total };
  }

  async getDetailForAdmin(projectId: string): Promise<AdminProjectDetailRow | null> {
    const p = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: adminDetailInclude,
    });
    if (!p) return null;

    const detail = p as AdminDetailPayload;
    const base = this.mapRow(detail);
    const totalSizeBytes = detail.files.reduce(
      (sum, f) => sum + (f.sizeBytes ?? 0),
      0,
    );
    const latest = detail.compileArtifacts[0] ?? null;

    return {
      ...base,
      mainPath: detail.settings?.mainPath ?? null,
      totalSizeBytes,
      latestArtifact: latest
        ? { id: latest.id, createdAt: latest.createdAt, sizeBytes: latest.sizeBytes ?? null }
        : null,
      files: detail.files.map((f) => ({
        path: f.path,
        kind: String(f.kind),
        sizeBytes: f.sizeBytes ?? null,
        updatedAt: f.updatedAt,
      })),
    };
  }

  async stats(ownerRole?: ProjectOwnerRole): Promise<AdminProjectStats> {
    // Exclude template "source projects" from every oversight count.
    const notSource: Prisma.ProjectWhereInput = { templateSources: { none: {} } };
    const roleWhere: Prisma.ProjectWhereInput = ownerRole
      ? { AND: [notSource, { owner: { is: { role: ownerRole } } }] }
      : notSource;

    const [total, student, teacher, groups] = await Promise.all([
      this.prisma.project.count({ where: roleWhere }),
      this.prisma.project.count({
        where: { AND: [notSource, { owner: { is: { role: 'student' } } }] },
      }),
      this.prisma.project.count({
        where: { AND: [notSource, { owner: { is: { role: 'teacher' } } }] },
      }),
      this.prisma.project.groupBy({
        by: ['category'],
        where: roleWhere,
        _count: { _all: true },
      }),
    ]);

    const byCategory = Object.fromEntries(
      ADMIN_PROJECT_CATEGORIES.map((c) => [c, 0]),
    ) as Record<AdminProjectCategory, number>;
    for (const g of groups) {
      byCategory[g.category as AdminProjectCategory] = g._count._all;
    }

    return { total, byRole: { student, teacher }, byCategory };
  }

  /**
   * Build the Prisma `where` from filters. Uses an `AND` array so that owner
   * sub-filters (facultyId, search) compose instead of overwriting each other.
   */
  private buildWhere(f: AdminProjectFilters): Prisma.ProjectWhereInput {
    const and: Prisma.ProjectWhereInput[] = [];

    // Exclude template "source projects" (admin-owned authoring copies) — they
    // aren't real student/teacher work and shouldn't appear in oversight.
    and.push({ templateSources: { none: {} } });

    if (f.ownerRole) {
      and.push({ owner: { is: { role: f.ownerRole } } });
    }
    if (f.category) {
      and.push({ category: f.category as Prisma.ProjectWhereInput['category'] });
    }
    if (f.createdFrom || f.createdTo) {
      and.push({
        createdAt: {
          ...(f.createdFrom && { gte: f.createdFrom }),
          ...(f.createdTo && { lte: f.createdTo }),
        },
      });
    }
    if (f.updatedFrom || f.updatedTo) {
      and.push({
        updatedAt: {
          ...(f.updatedFrom && { gte: f.updatedFrom }),
          ...(f.updatedTo && { lte: f.updatedTo }),
        },
      });
    }
    if (f.facultyId) {
      and.push({
        owner: {
          is: {
            OR: [
              { student: { is: { class: { is: { major: { is: { facultyId: f.facultyId } } } } } } },
              { teacher: { is: { department: { is: { facultyId: f.facultyId } } } } },
            ],
          },
        },
      });
    }
    if (f.majorId) {
      and.push({
        owner: { is: { student: { is: { class: { is: { majorId: f.majorId } } } } } },
      });
    }
    if (f.classId) {
      and.push({ owner: { is: { student: { is: { classId: f.classId } } } } });
    }
    if (f.departmentId) {
      and.push({ owner: { is: { teacher: { is: { departmentId: f.departmentId } } } } });
    }
    if (f.search) {
      const contains = { contains: f.search, mode: 'insensitive' as const };
      and.push({
        OR: [
          { title: contains },
          { owner: { is: { email: contains } } },
          {
            owner: {
              is: {
                student: {
                  is: { OR: [{ fullName: contains }, { studentCode: contains }] },
                },
              },
            },
          },
          {
            owner: {
              is: {
                teacher: {
                  is: { OR: [{ fullName: contains }, { teacherCode: contains }] },
                },
              },
            },
          },
        ],
      });
    }

    return and.length > 0 ? { AND: and } : {};
  }

  private mapRow(p: AdminListPayload): AdminProjectRow {
    return {
      id: p.id,
      title: p.title,
      category: p.category as AdminProjectCategory,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      lastEditedAt: p.lastEditedAt,
      fileCount: p._count.files,
      hasPdf: p._count.compileArtifacts > 0,
      owner: this.mapOwner(p.owner),
    };
  }

  private mapOwner(owner: OwnerPayload): AdminProjectOwnerView | null {
    if (!owner) return null;

    let displayName: string | null = null;
    let code: string | null = null;
    let faculty: AdminProjectOwnerView['faculty'] = null;
    let unit: string | null = null;

    if (owner.role === 'student' && owner.student) {
      displayName = owner.student.fullName;
      code = owner.student.studentCode;
      const cls = owner.student.class;
      const major = cls?.major;
      const fac = major?.faculty;
      if (fac) faculty = { id: fac.id, name: fac.name, code: fac.code };
      if (cls) unit = `Lớp ${cls.name}${major ? ` · ${major.name}` : ''}`;
    } else if (owner.role === 'teacher' && owner.teacher) {
      displayName = owner.teacher.fullName;
      code = owner.teacher.teacherCode;
      const dept = owner.teacher.department;
      const fac = dept?.faculty;
      if (fac) faculty = { id: fac.id, name: fac.name, code: fac.code };
      if (dept) unit = dept.name;
    }

    return {
      userId: owner.id,
      email: owner.email,
      role: owner.role,
      isActive: owner.isActive,
      displayName,
      code,
      faculty,
      unit,
    };
  }
}
