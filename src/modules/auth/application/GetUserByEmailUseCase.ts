/**
 * Get User By Email Use Case
 *
 * Retrieves user information by email including student/teacher profile data.
 * Depends only on the IUserProfileQuery domain port — no Prisma in application.
 */

import { AuthErrors } from '../domain/AuthErrors.js';
import type { IUserProfileQuery, UserWithProfile } from '../domain/UserProfile.js';
import type { UserRole } from '../../../shared/auth/Types.js';

/**
 * Command for getting user by email
 */
export interface GetUserByEmailCommand {
  email: string;
  requesterId: string;
  requesterRole: UserRole;
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
 * Retrieves complete user information including profile data in a single query.
 * Authorization: Admin can view all users, teachers/students can only view their own.
 */
export class GetUserByEmailUseCase {
  constructor(private readonly userProfileQuery: IUserProfileQuery) {}

  async execute(command: GetUserByEmailCommand): Promise<GetUserByEmailResponse> {
    try {
      const user = await this.userProfileQuery.findByEmailWithProfile(command.email);

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

      return {
        success: true,
        data: user,
      };
    } catch {
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
