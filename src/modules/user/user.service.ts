import CustomError from '../../../errors';
import { getAllUsers, getUserById, updateUser } from '../../db/queries/users';
import { type NewUser, type User } from '../../db/schema';
import { type GetUsersQuerySchema } from './user.schema';

// Use the schema type directly instead of creating a separate type
export type GetAllUsersParams = GetUsersQuerySchema;

export type GetAllUsersResult = {
  users: Omit<User, 'passwordHash'>[];
  totalUsers: number;
  totalPages: number;
  currentPage: number;
};

export const getUserByIdService = async (
  id: number,
  options?: { includePassword?: boolean }
): Promise<Omit<User, 'passwordHash'> | User | null> => {
  const user = await getUserById(id);

  if (!user) {
    return null;
  }

  if (options?.includePassword) {
    return user;
  }

  // Remove password hash from response
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const updateUserService = async (
  id: number,
  updateData: Partial<Pick<NewUser, 'name' | 'email'>>
): Promise<Omit<User, 'passwordHash'>> => {
  // Filter out undefined values for exactOptionalPropertyTypes
  const safeUpdateData = Object.fromEntries(
    Object.entries(updateData).filter(([, value]) => value !== undefined)
  ) as Partial<Pick<NewUser, 'name' | 'email'>>;

  const updatedUser = await updateUser(id, safeUpdateData);

  if (!updatedUser) {
    throw new CustomError.NotFoundError(`No user with id: ${id}`);
  }

  // Remove password hash from response
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};

export const getAllUsersService = async (queryParams: Partial<GetAllUsersParams> = {}): Promise<GetAllUsersResult> => {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search = '' } = queryParams;

  const result = await getAllUsers({
    page,
    limit,
    sortBy,
    order: sortOrder,
    search,
  });

  // Remove password hash from all users
  const usersWithoutPassword = result.users.map(user => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });

  return {
    users: usersWithoutPassword,
    totalUsers: result.totalUsers,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
  };
};
