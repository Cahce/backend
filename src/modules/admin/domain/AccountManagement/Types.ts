// Domain types for Account management
// No framework dependencies - pure TypeScript

/**
 * UserRole as a pure domain union type.
 * Mirrors the Prisma UserRole enum but lives in the domain layer so domain
 * code never imports from the generated Prisma client.
 */
export type UserRole = 'admin' | 'teacher' | 'student';

/**
 * Account is the canonical domain representation of a system user.
 */
export type Account = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Short summary of the profile linked to an account, used by list/detail views.
 */
export type AccountLink = {
  type: 'teacher' | 'student';
  id: string;
  fullName: string;
  code: string;
};

/**
 * Account enriched with a single link summary (teacher or student).
 * Used by account list/detail endpoints.
 */
export type AccountWithLink = Account & {
  link: AccountLink | null;
};

/**
 * Account enriched with full teacher/student profile minimal info.
 * Used by account linking flows (Teacher/Student management).
 */
export type AccountWithProfile = Account & {
  teacherProfile?: {
    id: string;
    teacherCode: string;
    fullName: string;
    departmentId: string;
  };
  studentProfile?: {
    id: string;
    studentCode: string;
    fullName: string;
    classId: string;
  };
};

/**
 * Query parameters for listing accounts.
 */
export type ListAccountsQuery = {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  hasLink?: boolean;
  page?: number;
  pageSize?: number;
};

/**
 * Command to create an account.
 */
export type CreateAccountInput = {
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
};

/**
 * Command to update an account.
 */
export type UpdateAccountInput = {
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  passwordHash?: string;
  passwordChangedAt?: Date;
};
