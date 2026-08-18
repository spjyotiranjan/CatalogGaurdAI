import "server-only";

import { Types, type ClientSession } from "mongoose";

import { normalizeEmail, type UserRole, type UserStatus } from "@/lib/contracts/auth";
import { connectToDatabase } from "@/server/db/mongoose";
import { UserModel } from "@/server/models/user";

export type AuthenticationUser = {
  id: string;
  sellerId: string | null;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
};

export type AuthorizationUser = Omit<AuthenticationUser, "passwordHash">;

export type CreateUserInput = {
  sellerId: string | null;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
};

function toAuthorizationUser(user: {
  _id: Types.ObjectId;
  sellerId: Types.ObjectId | null;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}): AuthorizationUser {
  return {
    id: user._id.toString(),
    sellerId: user.sellerId?.toString() ?? null,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export class UserRepository {
  async findForAuthenticationByEmail(email: string): Promise<AuthenticationUser | null> {
    await connectToDatabase();
    const user = await UserModel.findOne({ email: normalizeEmail(email) })
      .select("+passwordHash sellerId fullName email role status")
      .lean()
      .exec();

    if (!user) {
      return null;
    }

    return {
      ...toAuthorizationUser(user as Parameters<typeof toAuthorizationUser>[0]),
      passwordHash: user.passwordHash,
    };
  }

  async findForAuthenticationById(userId: string): Promise<AuthenticationUser | null> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    const user = await UserModel.findById(new Types.ObjectId(userId))
      .select("+passwordHash sellerId fullName email role status")
      .lean()
      .exec();

    if (!user) {
      return null;
    }

    return {
      ...toAuthorizationUser(user as Parameters<typeof toAuthorizationUser>[0]),
      passwordHash: user.passwordHash,
    };
  }

  async findActiveById(userId: string): Promise<AuthorizationUser | null> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    const user = await UserModel.findOne({
      _id: new Types.ObjectId(userId),
      status: "ACTIVE",
    })
      .select("sellerId fullName email role status")
      .lean()
      .exec();

    return user
      ? toAuthorizationUser(user as Parameters<typeof toAuthorizationUser>[0])
      : null;
  }

  async create(input: CreateUserInput, session?: ClientSession): Promise<AuthorizationUser> {
    await connectToDatabase();
    const [created] = await UserModel.create(
      [
        {
          ...input,
          email: normalizeEmail(input.email),
          sellerId: input.sellerId ? new Types.ObjectId(input.sellerId) : null,
        },
      ],
      { session },
    );

    return toAuthorizationUser(created.toObject() as Parameters<typeof toAuthorizationUser>[0]);
  }

  async recordSuccessfulLogin(userId: string, session?: ClientSession): Promise<void> {
    await connectToDatabase();
    await UserModel.updateOne(
      { _id: new Types.ObjectId(userId), status: "ACTIVE" },
      { $set: { lastLoginAt: new Date() } },
      { session, runValidators: true },
    ).exec();
  }

  async replacePasswordHash(
    userId: string,
    passwordHash: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await connectToDatabase();
    const result = await UserModel.updateOne(
      { _id: new Types.ObjectId(userId), status: "ACTIVE" },
      { $set: { passwordHash } },
      { session, runValidators: true },
    ).exec();
    return result.modifiedCount === 1;
  }
}

export const userRepository = new UserRepository();
