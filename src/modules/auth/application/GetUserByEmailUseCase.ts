
import { AuthErrors } from '../domain/AuthErrors.js';
import type { IUserProfileQuery, UserWithProfile } from '../domain/UserProfile.js';
import type { UserRole } from '../../../shared/auth/Types.js';

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
