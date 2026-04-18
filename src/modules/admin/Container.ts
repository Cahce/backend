// Domain Ports (interfaces)
import type { FacultyRepo } from "./domain/Faculty/Ports.js";
import type { DepartmentRepo } from "./domain/Department/Ports.js";
import type { MajorRepo } from "./domain/Major/Ports.js";
import type { ClassRepo } from "./domain/Class/Ports.js";

// Repositories (concrete implementations)
import { FacultyRepoPrisma } from "./infra/FacultyRepoPrisma.js";
import { DepartmentRepoPrisma } from "./infra/DepartmentRepoPrisma.js";
import { MajorRepoPrisma } from "./infra/MajorRepoPrisma.js";
import { ClassRepoPrisma } from "./infra/ClassRepoPrisma.js";

// Prisma Client type
import type { PrismaClient } from "../../generated/prisma/index.js";

// Faculty Use Cases
import { CreateFacultyUseCase } from "./application/Faculty/CreateFacultyUseCase.js";
import { ListFacultiesUseCase } from "./application/Faculty/ListFacultiesUseCase.js";
import { GetFacultyByIdUseCase } from "./application/Faculty/GetFacultyByIdUseCase.js";
import { UpdateFacultyUseCase } from "./application/Faculty/UpdateFacultyUseCase.js";
import { DeleteFacultyUseCase } from "./application/Faculty/DeleteFacultyUseCase.js";

// Department Use Cases
import { CreateDepartmentUseCase } from "./application/Department/CreateDepartmentUseCase.js";
import { ListDepartmentsUseCase } from "./application/Department/ListDepartmentsUseCase.js";
import { GetDepartmentByIdUseCase } from "./application/Department/GetDepartmentByIdUseCase.js";
import { UpdateDepartmentUseCase } from "./application/Department/UpdateDepartmentUseCase.js";
import { DeleteDepartmentUseCase } from "./application/Department/DeleteDepartmentUseCase.js";

// Major Use Cases
import { CreateMajorUseCase } from "./application/Major/CreateMajorUseCase.js";
import { ListMajorsUseCase } from "./application/Major/ListMajorsUseCase.js";
import { GetMajorByIdUseCase } from "./application/Major/GetMajorByIdUseCase.js";
import { UpdateMajorUseCase } from "./application/Major/UpdateMajorUseCase.js";
import { DeleteMajorUseCase } from "./application/Major/DeleteMajorUseCase.js";

// Class Use Cases
import { CreateClassUseCase } from "./application/Class/CreateClassUseCase.js";
import { ListClassesUseCase } from "./application/Class/ListClassesUseCase.js";
import { GetClassByIdUseCase } from "./application/Class/GetClassByIdUseCase.js";
import { UpdateClassUseCase } from "./application/Class/UpdateClassUseCase.js";
import { DeleteClassUseCase } from "./application/Class/DeleteClassUseCase.js";

/**
 * Admin Module Container
 * 
 * Centralized dependency wiring for the admin module.
 * Instantiates repositories and use cases with proper dependencies.
 */
export class AdminContainer {
    // Repositories (typed as interfaces for DIP compliance)
    private facultyRepo: FacultyRepo;
    private departmentRepo: DepartmentRepo;
    private majorRepo: MajorRepo;
    private classRepo: ClassRepo;

    // Faculty Use Cases
    public createFacultyUseCase: CreateFacultyUseCase;
    public listFacultiesUseCase: ListFacultiesUseCase;
    public getFacultyByIdUseCase: GetFacultyByIdUseCase;
    public updateFacultyUseCase: UpdateFacultyUseCase;
    public deleteFacultyUseCase: DeleteFacultyUseCase;

    // Department Use Cases
    public createDepartmentUseCase: CreateDepartmentUseCase;
    public listDepartmentsUseCase: ListDepartmentsUseCase;
    public getDepartmentByIdUseCase: GetDepartmentByIdUseCase;
    public updateDepartmentUseCase: UpdateDepartmentUseCase;
    public deleteDepartmentUseCase: DeleteDepartmentUseCase;

    // Major Use Cases
    public createMajorUseCase: CreateMajorUseCase;
    public listMajorsUseCase: ListMajorsUseCase;
    public getMajorByIdUseCase: GetMajorByIdUseCase;
    public updateMajorUseCase: UpdateMajorUseCase;
    public deleteMajorUseCase: DeleteMajorUseCase;

    // Class Use Cases
    public createClassUseCase: CreateClassUseCase;
    public listClassesUseCase: ListClassesUseCase;
    public getClassByIdUseCase: GetClassByIdUseCase;
    public updateClassUseCase: UpdateClassUseCase;
    public deleteClassUseCase: DeleteClassUseCase;

    constructor(prisma: PrismaClient) {
        // Initialize repositories
        this.facultyRepo = new FacultyRepoPrisma(prisma);
        this.departmentRepo = new DepartmentRepoPrisma(prisma);
        this.majorRepo = new MajorRepoPrisma(prisma);
        this.classRepo = new ClassRepoPrisma(prisma);

        // Wire Faculty use cases
        this.createFacultyUseCase = new CreateFacultyUseCase(this.facultyRepo);
        this.listFacultiesUseCase = new ListFacultiesUseCase(this.facultyRepo);
        this.getFacultyByIdUseCase = new GetFacultyByIdUseCase(this.facultyRepo);
        this.updateFacultyUseCase = new UpdateFacultyUseCase(this.facultyRepo);
        this.deleteFacultyUseCase = new DeleteFacultyUseCase(this.facultyRepo);

        // Wire Department use cases
        this.createDepartmentUseCase = new CreateDepartmentUseCase(this.departmentRepo, this.facultyRepo);
        this.listDepartmentsUseCase = new ListDepartmentsUseCase(this.departmentRepo);
        this.getDepartmentByIdUseCase = new GetDepartmentByIdUseCase(this.departmentRepo);
        this.updateDepartmentUseCase = new UpdateDepartmentUseCase(this.departmentRepo, this.facultyRepo);
        this.deleteDepartmentUseCase = new DeleteDepartmentUseCase(this.departmentRepo);

        // Wire Major use cases
        this.createMajorUseCase = new CreateMajorUseCase(this.majorRepo, this.facultyRepo);
        this.listMajorsUseCase = new ListMajorsUseCase(this.majorRepo);
        this.getMajorByIdUseCase = new GetMajorByIdUseCase(this.majorRepo);
        this.updateMajorUseCase = new UpdateMajorUseCase(this.majorRepo, this.facultyRepo);
        this.deleteMajorUseCase = new DeleteMajorUseCase(this.majorRepo);

        // Wire Class use cases
        this.createClassUseCase = new CreateClassUseCase(this.classRepo, this.majorRepo);
        this.listClassesUseCase = new ListClassesUseCase(this.classRepo);
        this.getClassByIdUseCase = new GetClassByIdUseCase(this.classRepo);
        this.updateClassUseCase = new UpdateClassUseCase(this.classRepo, this.majorRepo);
        this.deleteClassUseCase = new DeleteClassUseCase(this.classRepo);
    }
}
