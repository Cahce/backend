
import type { Faculty } from '../Faculty/Types.js';

export type Major = {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MajorWithContext = Major & {
  faculty?: Faculty;
};

export type CreateMajorData = {
  name: string;
  code: string;
  facultyId: string;
};

export type UpdateMajorData = {
  name?: string;
  code?: string;
  facultyId?: string;
};

export type MajorFilters = {
  search?: string;
  facultyId?: string;
  page?: number;
  pageSize?: number;
};
