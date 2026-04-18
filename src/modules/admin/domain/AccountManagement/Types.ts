// Domain types for Account management
// No framework dependencies - pure TypeScript

export type Account = {
  id: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
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
