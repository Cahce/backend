/**
 * Get User By Email Use Case
 * 
 * Retrieves user information by email including student/teacher profile data.
 */

import type { IUserRepository } from '../domain/Ports.js';
import { AuthErrors } from '../domain/AuthErrors.js';
import type { PrismaClient } from '../../../generated/prisma/index.js';

/**
 * Command for getting user by email
 */
export interface GetUserByEmailCommand {
  email: string;
  requesterId: string;
  requesterRole: 'admin' | 'teacher' | 'student';
}

/**
 * User information with profile data
 */
export interface UserWithProfile {
  id: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Student profile (if role is student)
  studentProfile?: {
    id: string;
    studentCode: string;
    fullName: string;
    phone: string | null;
    class: {
      id: string;
      name: string;
      code: string;
      major: {
        id: string;
        name: string;
        code: string;
        faculty: {
          id: string;
          name: string;
          code: string;
        };
      };
    };
  };
  
  // Teacher profile (if role is teacher)
  teacherProfile?: {
    id: string;
    teacherCode: string;
    fullName: string;
    phone: string | null;
    academicRank: string;
    academicDegree: string;
    department: {
      id: string;
      name: string;
      code: string;
      faculty: {
        id: string;
        name: string;
        code: string;
      };
    };
  };
}

export interface GetUserByEmailSuccess {
  success: true;
  data: UserWithProfile;
}

export interface GetUserByEmailFailure {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type GetUserByEmailResponse = GetUserByEmailSuccess | GetUserByEmailFailure;

/**
 * Get User By Email Use Case
 * 
 * Retrieves complete user information including profile data.
 * Authorization: Admin can view all users, teachers/students can only view their own.
 */
export class GetUserByEmailUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(command: GetUserByEmailCommand): Promise<GetUserByEmailResponse> {
    try {
      // Find user by email
      const user = await this.userRepo.findByEmail(command.email);

      if (!user) {
        return {
          success: false,
          error: {
            code: AuthErrors.USER_NOT_FOUND.code,
            message: AuthErrors.USER_NOT_FOUND.message,
          },
        };
      }

      // Authorization: Admin can view all, others can only view themselves
      if (command.requesterRole !== 'admin' && command.requesterId !== user.id) {
        return {
          success: false,
          error: {
            code: AuthErrors.UNAUTHORIZED.code,
            message: 'Không có quyền xem thông tin người dùng này',
          },
        };
      }

      // Fetch complete user data with profile
      const completeUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          student: {
            select: {
              id: true,
              studentCode: true,
              fullName: true,
              phone: true,
              class: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  major: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      faculty: {
                        select: {
                          id: true,
                          name: true,
                          code: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          teacher: {
            select: {
              id: true,
              teacherCode: true,
              fullName: true,
              phone: true,
              academicRank: true,
              academicDegree: true,
              department: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  faculty: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!completeUser) {
        return {
          success: false,
          error: {
            code: AuthErrors.USER_NOT_FOUND.code,
            message: AuthErrors.USER_NOT_FOUND.message,
          },
        };
      }

      // Build response with profile data
      const response: UserWithProfile = {
        id: completeUser.id,
        email: completeUser.email,
        role: completeUser.role,
        isActive: completeUser.isActive,
        createdAt: completeUser.createdAt,
        updatedAt: completeUser.updatedAt,
      };

      // Add student profile if exists
      if (completeUser.student) {
        response.studentProfile = {
          id: completeUser.student.id,
          studentCode: completeUser.student.studentCode,
          fullName: completeUser.student.fullName,
          phone: completeUser.student.phone,
          class: completeUser.student.class,
        };
      }

      // Add teacher profile if exists
      if (completeUser.teacher) {
        response.teacherProfile = {
          id: completeUser.teacher.id,
          teacherCode: completeUser.teacher.teacherCode,
          fullName: completeUser.teacher.fullName,
          phone: completeUser.teacher.phone,
          academicRank: completeUser.teacher.academicRank,
          academicDegree: completeUser.teacher.academicDegree,
          department: completeUser.teacher.department,
        };
      }

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Lỗi khi lấy thông tin người dùng',
        },
      };
    }
  }
}
