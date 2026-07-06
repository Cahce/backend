
export type Faculty = {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateFacultyData = {
  name: string;
  code: string;
};

export type UpdateFacultyData = {
  name?: string;
  code?: string;
};

export type FacultyFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
};
