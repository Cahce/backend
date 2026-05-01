import type { PrismaClient } from "../../../generated/prisma/index.js";
import type { TeacherProfile } from "../domain/TeacherProfile.js";
import type { TeacherProfilePort } from "../domain/TeacherProfilePort.js";

/**
 * Prisma implementation of TeacherProfilePort
 */
export class TeacherRepository implements TeacherProfilePort {
  constructor(private readonly prisma: PrismaClient) {}

  async findByAccountId(accountId: string): Promise<TeacherProfile | null> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { accountId },
      include: {
        account: true,
        department: {
          include: {
            faculty: true,
          },
        },
      },
    });

    if (!teacher || !teacher.account) {
      return null;
    }

    return {
      id: teacher.id,
      accountId: teacher.accountId,
      teacherCode: teacher.teacherCode,
      fullName: teacher.fullName,
      email: teacher.account.email,
      role: "teacher",
      department: {
        id: teacher.department.id,
        name: teacher.department.name,
        faculty: {
          id: teacher.department.faculty.id,
          name: teacher.department.faculty.name,
        },
      },
      academicRank: teacher.academicRank,
      academicDegree: teacher.academicDegree,
      phone: teacher.phone,
      createdAt: teacher.createdAt.toISOString(),
      updatedAt: teacher.updatedAt.toISOString(),
    };
  }
}
