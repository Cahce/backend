import type { AdminAccountRepo } from '../../domain/AccountManagement/Ports.js';
import type { EmailPolicy } from '../../domain/AccountManagement/Policies.js';
import type { PasswordHasher } from '../../domain/shared/PasswordHasher.js';
import type { Account, UserRole } from '../../domain/AccountManagement/Types.js';
import { AccountErrors } from '../../domain/AccountManagement/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export interface CreateAccountCommand {
  email: string;
  password: string;
  role: UserRole;
  isActive?: boolean;
  linkTo?: {
    type: 'teacher' | 'student';
    id: string;
  };
}

export class CreateAccountUseCase {
  constructor(
    private readonly accountRepo: AdminAccountRepo,
    private readonly emailPolicy: EmailPolicy,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async execute(command: CreateAccountCommand): Promise<Result<Account>> {
    const { email, password, role, isActive = true, linkTo } = command;

    const validation = this.emailPolicy.validate(email, role);
    if (!validation.ok) {
      return failure(validation.code, validation.message);
    }

    const existing = await this.accountRepo.findByEmail(email);
    if (existing) {
      return failure(AccountErrors.EMAIL_EXISTS.code, AccountErrors.EMAIL_EXISTS.message);
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const account = await this.accountRepo.create({
      email,
      passwordHash,
      role,
      isActive,
    });

    if (linkTo) {
      if (linkTo.type === 'teacher') {
        await this.accountRepo.linkToTeacher(account.id, linkTo.id);
      } else {
        await this.accountRepo.linkToStudent(account.id, linkTo.id);
      }
    }

    return success(account);
  }
}
