/**
 * Domain type for Teacher Profile
 */
export interface TeacherProfile {
  id: string;
  accountId: string | null;
  teacherCode: string;
  fullName: string;
  email: string;
  role: "teacher";
  department: {
    id: string;
    name: string;
    faculty: {
      id: string;
      name: string;
    };
  };
  academicRank: string;
  academicDegree: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}
