// Domain Ports (interfaces)
import type { FacultyRepo } from "./domain/Faculty/Ports.js";
import type { DepartmentRepo } from "./domain/Department/Ports.js";
import type { MajorRepo } from "./domain/Major/Ports.js";
import type { ClassRepo } from "./domain/Class/Ports.js";
import type { TeacherProfileRepo } from "./domain/TeacherManagement/Ports.js";
import type { StudentProfileRepo } from "./domain/StudentManagement/Ports.js";
import type { AdminAccountRepo } from "./domain/AccountManagement/Ports.js";
import type { EmailPolicy } from "./domain/AccountManagement/Policies.js";
import type { PasswordHasher } from "./domain/shared/PasswordHasher.js";

// Repositories (concrete implementations)
import { FacultyRepoPrisma } from "./infra/FacultyRepoPrisma.js";
import { DepartmentRepoPrisma } from "./infra/DepartmentRepoPrisma.js";
import { MajorRepoPrisma } from "./infra/MajorRepoPrisma.js";
import { ClassRepoPrisma } from "./infra/ClassRepoPrisma.js";
import { TeacherProfileRepoPrisma } from "./infra/TeacherProfileRepoPrisma.js";
import { StudentProfileRepoPrisma } from "./infra/StudentProfileRepoPrisma.js";
import { AdminAccountRepoPrisma } from "./infra/AdminAccountRepoPrisma.js";
import { BcryptPasswordHasher } from "./infra/BcryptPasswordHasher.js";
import { EnvEmailPolicy } from "./domain/AccountManagement/Policies.js";

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

// Teacher Management Use Cases
import { CreateTeacherProfileUseCase } from "./application/TeacherManagement/CreateTeacherProfileUseCase.js";
import { ListTeacherProfilesUseCase } from "./application/TeacherManagement/ListTeacherProfilesUseCase.js";
import { GetTeacherProfileDetailsUseCase } from "./application/TeacherManagement/GetTeacherProfileDetailsUseCase.js";
import { UpdateTeacherProfileUseCase } from "./application/TeacherManagement/UpdateTeacherProfileUseCase.js";
import { DeleteTeacherProfileUseCase } from "./application/TeacherManagement/DeleteTeacherProfileUseCase.js";
import { LinkAccountToTeacherUseCase } from "./application/TeacherManagement/LinkAccountToTeacherUseCase.js";
import { UnlinkAccountFromTeacherUseCase } from "./application/TeacherManagement/UnlinkAccountFromTeacherUseCase.js";

// Student Management Use Cases
import { CreateStudentProfileUseCase } from "./application/StudentManagement/CreateStudentProfileUseCase.js";
import { ListStudentProfilesUseCase } from "./application/StudentManagement/ListStudentProfilesUseCase.js";
import { GetStudentProfileDetailsUseCase } from "./application/StudentManagement/GetStudentProfileDetailsUseCase.js";
import { UpdateStudentProfileUseCase } from "./application/StudentManagement/UpdateStudentProfileUseCase.js";
import { DeleteStudentProfileUseCase } from "./application/StudentManagement/DeleteStudentProfileUseCase.js";
import { LinkAccountToStudentUseCase } from "./application/StudentManagement/LinkAccountToStudentUseCase.js";
import { UnlinkAccountFromStudentUseCase } from "./application/StudentManagement/UnlinkAccountFromStudentUseCase.js";

// Account Management Use Cases
import { CreateAccountUseCase } from "./application/AccountManagement/CreateAccountUseCase.js";
import { ListAccountsUseCase } from "./application/AccountManagement/ListAccountsUseCase.js";
import { GetAccountUseCase } from "./application/AccountManagement/GetAccountUseCase.js";
import { UpdateAccountUseCase } from "./application/AccountManagement/UpdateAccountUseCase.js";
import { DeleteAccountUseCase } from "./application/AccountManagement/DeleteAccountUseCase.js";
import { ResetAccountPasswordUseCase } from "./application/AccountManagement/ResetAccountPasswordUseCase.js";

// Import Use Cases
import { ImportFaculties } from "./application/import/ImportFaculties.js";
import { ImportDepartments } from "./application/import/ImportDepartments.js";
import { ImportMajors } from "./application/import/ImportMajors.js";
import { ImportClasses } from "./application/import/ImportClasses.js";
import { ImportTeachers } from "./application/import/ImportTeachers.js";
import { ImportStudents } from "./application/import/ImportStudents.js";
import { ImportAccounts } from "./application/import/ImportAccounts.js";

/**
 * Admin Module Container
 *
 * Centralized dependency wiring for the admin module.
 * Instantiates repositories and use cases with proper dependencies.
 *
 * Routes should consume use cases from this container instead of creating
 * repositories/use cases inline, to keep dependency-inversion intact.
 */
export class AdminContainer {
    // Repositories & policies (typed as interfaces for DIP compliance)
    public readonly facultyRepo: FacultyRepo;
    public readonly departmentRepo: DepartmentRepo;
    public readonly majorRepo: MajorRepo;
    public readonly classRepo: ClassRepo;
    public readonly teacherProfileRepo: TeacherProfileRepo;
    public readonly studentProfileRepo: StudentProfileRepo;
    public readonly accountRepo: AdminAccountRepo;
    public readonly emailPolicy: EmailPolicy;
    public readonly passwordHasher: PasswordHasher;

    // Faculty Use Cases
    public readonly createFacultyUseCase: CreateFacultyUseCase;
    public readonly listFacultiesUseCase: ListFacultiesUseCase;
    public readonly getFacultyByIdUseCase: GetFacultyByIdUseCase;
    public readonly updateFacultyUseCase: UpdateFacultyUseCase;
    public readonly deleteFacultyUseCase: DeleteFacultyUseCase;
    public readonly importFaculties: ImportFaculties;

    // Department Use Cases
    public readonly createDepartmentUseCase: CreateDepartmentUseCase;
    public readonly listDepartmentsUseCase: ListDepartmentsUseCase;
    public readonly getDepartmentByIdUseCase: GetDepartmentByIdUseCase;
    public readonly updateDepartmentUseCase: UpdateDepartmentUseCase;
    public readonly deleteDepartmentUseCase: DeleteDepartmentUseCase;
    public readonly importDepartments: ImportDepartments;

    // Major Use Cases
    public readonly createMajorUseCase: CreateMajorUseCase;
    public readonly listMajorsUseCase: ListMajorsUseCase;
    public readonly getMajorByIdUseCase: GetMajorByIdUseCase;
    public readonly updateMajorUseCase: UpdateMajorUseCase;
    public readonly deleteMajorUseCase: DeleteMajorUseCase;
    public readonly importMajors: ImportMajors;

    // Class Use Cases
    public readonly createClassUseCase: CreateClassUseCase;
    public readonly listClassesUseCase: ListClassesUseCase;
    public readonly getClassByIdUseCase: GetClassByIdUseCase;
    public readonly updateClassUseCase: UpdateClassUseCase;
    public readonly deleteClassUseCase: DeleteClassUseCase;
    public readonly importClasses: ImportClasses;

    // Teacher Management Use Cases
    public readonly createTeacherProfileUseCase: CreateTeacherProfileUseCase;
    public readonly listTeacherProfilesUseCase: ListTeacherProfilesUseCase;
    public readonly getTeacherProfileDetailsUseCase: GetTeacherProfileDetailsUseCase;
    public readonly updateTeacherProfileUseCase: UpdateTeacherProfileUseCase;
    public readonly deleteTeacherProfileUseCase: DeleteTeacherProfileUseCase;
    public readonly linkAccountToTeacherUseCase: LinkAccountToTeacherUseCase;
    public readonly unlinkAccountFromTeacherUseCase: UnlinkAccountFromTeacherUseCase;
    public readonly importTeachers: ImportTeachers;

    // Student Management Use Cases
    public readonly createStudentProfileUseCase: CreateStudentProfileUseCase;
    public readonly listStudentProfilesUseCase: ListStudentProfilesUseCase;
    public readonly getStudentProfileDetailsUseCase: GetStudentProfileDetailsUseCase;
    public readonly updateStudentProfileUseCase: UpdateStudentProfileUseCase;
    public readonly deleteStudentProfileUseCase: DeleteStudentProfileUseCase;
    public readonly linkAccountToStudentUseCase: LinkAccountToStudentUseCase;
    public readonly unlinkAccountFromStudentUseCase: UnlinkAccountFromStudentUseCase;
    public readonly importStudents: ImportStudents;

    // Account Management Use Cases
    public readonly createAccountUseCase: CreateAccountUseCase;
    public readonly listAccountsUseCase: ListAccountsUseCase;
    public readonly getAccountUseCase: GetAccountUseCase;
    public readonly updateAccountUseCase: UpdateAccountUseCase;
    public readonly deleteAccountUseCase: DeleteAccountUseCase;
    public readonly resetAccountPasswordUseCase: ResetAccountPasswordUseCase;
    public readonly importAccounts: ImportAccounts;

    constructor(prisma: PrismaClient) {
        // Initialize repositories & shared policies
        this.facultyRepo = new FacultyRepoPrisma(prisma);
        this.departmentRepo = new DepartmentRepoPrisma(prisma);
        this.majorRepo = new MajorRepoPrisma(prisma);
        this.classRepo = new ClassRepoPrisma(prisma);
        this.teacherProfileRepo = new TeacherProfileRepoPrisma(prisma);
        this.studentProfileRepo = new StudentProfileRepoPrisma(prisma);
        this.accountRepo = new AdminAccountRepoPrisma(prisma);
        this.emailPolicy = new EnvEmailPolicy();
        this.passwordHasher = new BcryptPasswordHasher();

        // Wire Faculty use cases
        this.createFacultyUseCase = new CreateFacultyUseCase(this.facultyRepo);
        this.listFacultiesUseCase = new ListFacultiesUseCase(this.facultyRepo);
        this.getFacultyByIdUseCase = new GetFacultyByIdUseCase(this.facultyRepo);
        this.updateFacultyUseCase = new UpdateFacultyUseCase(this.facultyRepo);
        this.deleteFacultyUseCase = new DeleteFacultyUseCase(this.facultyRepo);
        this.importFaculties = new ImportFaculties(this.facultyRepo);

        // Wire Department use cases
        this.createDepartmentUseCase = new CreateDepartmentUseCase(this.departmentRepo, this.facultyRepo);
        this.listDepartmentsUseCase = new ListDepartmentsUseCase(this.departmentRepo);
        this.getDepartmentByIdUseCase = new GetDepartmentByIdUseCase(this.departmentRepo);
        this.updateDepartmentUseCase = new UpdateDepartmentUseCase(this.departmentRepo, this.facultyRepo);
        this.deleteDepartmentUseCase = new DeleteDepartmentUseCase(this.departmentRepo);
        this.importDepartments = new ImportDepartments(this.facultyRepo, this.departmentRepo);

        // Wire Major use cases
        this.createMajorUseCase = new CreateMajorUseCase(this.majorRepo, this.facultyRepo);
        this.listMajorsUseCase = new ListMajorsUseCase(this.majorRepo);
        this.getMajorByIdUseCase = new GetMajorByIdUseCase(this.majorRepo);
        this.updateMajorUseCase = new UpdateMajorUseCase(this.majorRepo, this.facultyRepo);
        this.deleteMajorUseCase = new DeleteMajorUseCase(this.majorRepo);
        this.importMajors = new ImportMajors(this.facultyRepo, this.majorRepo);

        // Wire Class use cases
        this.createClassUseCase = new CreateClassUseCase(this.classRepo, this.majorRepo);
        this.listClassesUseCase = new ListClassesUseCase(this.classRepo);
        this.getClassByIdUseCase = new GetClassByIdUseCase(this.classRepo);
        this.updateClassUseCase = new UpdateClassUseCase(this.classRepo, this.majorRepo);
        this.deleteClassUseCase = new DeleteClassUseCase(this.classRepo);
        this.importClasses = new ImportClasses(this.majorRepo, this.classRepo);

        // Wire Teacher Management use cases
        this.createTeacherProfileUseCase = new CreateTeacherProfileUseCase(
            this.teacherProfileRepo, this.departmentRepo, this.accountRepo, this.passwordHasher
        );
        this.listTeacherProfilesUseCase = new ListTeacherProfilesUseCase(this.teacherProfileRepo);
        this.getTeacherProfileDetailsUseCase = new GetTeacherProfileDetailsUseCase(this.teacherProfileRepo);
        this.updateTeacherProfileUseCase = new UpdateTeacherProfileUseCase(this.teacherProfileRepo, this.departmentRepo);
        this.deleteTeacherProfileUseCase = new DeleteTeacherProfileUseCase(this.teacherProfileRepo);
        this.linkAccountToTeacherUseCase = new LinkAccountToTeacherUseCase(this.teacherProfileRepo, this.accountRepo);
        this.unlinkAccountFromTeacherUseCase = new UnlinkAccountFromTeacherUseCase(this.teacherProfileRepo);
        this.importTeachers = new ImportTeachers(
            this.departmentRepo, this.teacherProfileRepo, this.accountRepo, this.passwordHasher,
        );

        // Wire Student Management use cases
        this.createStudentProfileUseCase = new CreateStudentProfileUseCase(
            this.studentProfileRepo, this.classRepo, this.accountRepo, this.passwordHasher
        );
        this.listStudentProfilesUseCase = new ListStudentProfilesUseCase(this.studentProfileRepo);
        this.getStudentProfileDetailsUseCase = new GetStudentProfileDetailsUseCase(this.studentProfileRepo);
        this.updateStudentProfileUseCase = new UpdateStudentProfileUseCase(this.studentProfileRepo, this.classRepo);
        this.deleteStudentProfileUseCase = new DeleteStudentProfileUseCase(this.studentProfileRepo);
        this.linkAccountToStudentUseCase = new LinkAccountToStudentUseCase(this.studentProfileRepo, this.accountRepo);
        this.unlinkAccountFromStudentUseCase = new UnlinkAccountFromStudentUseCase(this.studentProfileRepo);
        this.importStudents = new ImportStudents(
            this.classRepo, this.accountRepo, this.studentProfileRepo, this.passwordHasher,
        );

        // Wire Account Management use cases
        this.createAccountUseCase = new CreateAccountUseCase(this.accountRepo, this.emailPolicy, this.passwordHasher);
        this.listAccountsUseCase = new ListAccountsUseCase(this.accountRepo);
        this.getAccountUseCase = new GetAccountUseCase(this.accountRepo);
        this.updateAccountUseCase = new UpdateAccountUseCase(this.accountRepo, this.emailPolicy);
        this.deleteAccountUseCase = new DeleteAccountUseCase(this.accountRepo);
        this.resetAccountPasswordUseCase = new ResetAccountPasswordUseCase(this.accountRepo, this.passwordHasher);
        this.importAccounts = new ImportAccounts(
            this.accountRepo, this.teacherProfileRepo, this.studentProfileRepo, this.passwordHasher,
        );
    }
}
