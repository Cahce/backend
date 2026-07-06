
import type { Faculty } from '../Faculty/Types.js';

export type Department = {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DepartmentWithContext = Department & {
  faculty?: Faculty;
};

export type CreateDepartmentData = {
  name: string;
  code: string;
  facultyId: string;
};

export type UpdateDepartmentData = {
  name?: string;
  code?: string;
  facultyId?: string;
};

export type DepartmentFilters = {
  search?: string;
  facultyId?: string;
  page?: number;
  pageSize?: number;
};
