
export type UserRole = 'admin' | 'teacher' | 'student';

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

export type AccountLink = {
  type: 'teacher' | 'student';
  id: string;
  fullName: string;
  code: string;
};

export type AccountWithLink = Account & {
  link: AccountLink | null;
};

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

export type ListAccountsQuery = {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  hasLink?: boolean;
  page?: number;
  pageSize?: number;
};

export type CreateAccountInput = {
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
};

export type UpdateAccountInput = {
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  passwordHash?: string;
  passwordChangedAt?: Date;
};
