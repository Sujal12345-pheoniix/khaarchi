import { z } from 'zod';
import { HomeType, MemberRole, ExpenseCategory, SplitType, RecurringInterval } from '@homeexpense/types';
import { validateExpenseSplits } from '@homeexpense/financial-core';

// Auth Schemas
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long').trim(),
  avatarUrl: z.string().url().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const RequestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').trim().optional(),
  avatarUrl: z.string().url('Invalid URL').nullable().optional(),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.nativeEnum(MemberRole),
});

// Home Schemas
export const CreateHomeSchema = z.object({
  name: z.string().min(2, 'Home name must be at least 2 characters').max(50).trim(),
  type: z.nativeEnum(HomeType),
  currency: z.string().length(3).default('INR'),
  description: z.string().max(250).optional(),
});

export const UpdateHomeSchema = z.object({
  name: z.string().min(2, 'Home name must be at least 2 characters').max(50).trim().optional(),
  type: z.nativeEnum(HomeType).optional(),
  currency: z.string().length(3).optional(),
  description: z.string().max(250).nullable().optional(),
});

export const InviteMemberSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  role: z.nativeEnum(MemberRole).default(MemberRole.MEMBER),
});

export const AcceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

export const JoinHomeByCodeSchema = z.object({
  code: z
    .string()
    .min(4, 'Code must be at least 4 characters')
    .max(16, 'Code must be at most 16 characters')
    .trim(),
});

export type JoinHomeByCodeInput = z.infer<typeof JoinHomeByCodeSchema>;

export const UpdateMemberSchema = z.object({
  nickname: z.string().max(50).nullable().optional(),
  spendingLimit: z.number().positive().nullable().optional(),
  role: z.nativeEnum(MemberRole).optional(),
});

// Split Item Schema
export const SplitItemSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  amount: z.number().positive('Split amount must be greater than zero'),
  percentage: z.number().min(0).max(100).optional(),
  shares: z.number().int().positive().optional(),
});

// Expense Creation Schema with Invariant Refinement
export const CreateExpenseSchema = z
  .object({
    description: z.string().min(2, 'Description must be at least 2 characters').max(200).trim(),
    amount: z.number().positive('Expense amount must be greater than zero'),
    category: z.nativeEnum(ExpenseCategory),
    date: z.string().datetime().or(z.date()),
    payerMemberId: z.string().uuid('Invalid payer member ID'),
    splitType: z.nativeEnum(SplitType),
    splits: z.array(SplitItemSchema).min(1, 'At least one participant split is required'),
    receiptUrl: z.string().url().optional().nullable(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      const result = validateExpenseSplits({
        totalAmount: data.amount,
        splits: data.splits,
      });
      return result.valid;
    },
    (data) => {
      const result = validateExpenseSplits({
        totalAmount: data.amount,
        splits: data.splits,
      });
      return {
        message: result.error || 'Splits must sum exactly to the expense amount',
        path: ['splits'],
      };
    }
  );

// Settlement Creation Schema
export const CreateSettlementSchema = z.object({
  fromMemberId: z.string().uuid('Debtor member ID is required'),
  toMemberId: z.string().uuid('Creditor member ID is required'),
  amount: z.number().positive('Settlement amount must be positive'),
  notes: z.string().max(200).optional(),
  proofUrl: z.string().url().optional().nullable(),
});

// Bill Creation Schema
export const CreateBillSchema = z.object({
  title: z.string().min(2).max(150),
  amount: z.number().positive(),
  dueDate: z.string().datetime().or(z.date()),
  billDocumentUrl: z.string().url().optional().nullable(),
});

// Budget Creation Schema
export const CreateBudgetSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  totalBudget: z.number().positive(),
  categories: z.array(
    z.object({
      category: z.nativeEnum(ExpenseCategory),
      allocatedAmount: z.number().positive(),
    })
  ),
});

// Recurring Expense Schema
export const CreateRecurringExpenseSchema = z.object({
  description: z.string().min(2).max(200),
  amount: z.number().positive(),
  category: z.nativeEnum(ExpenseCategory),
  interval: z.nativeEnum(RecurringInterval).default(RecurringInterval.MONTHLY),
  nextRunAt: z.string().datetime().or(z.date()),
  splitType: z.nativeEnum(SplitType).default(SplitType.EQUAL),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
export type CreateHomeInput = z.infer<typeof CreateHomeSchema>;
export type UpdateHomeInput = z.infer<typeof UpdateHomeSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;
export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>;
export type SplitItemInput = z.infer<typeof SplitItemSchema>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type CreateSettlementInput = z.infer<typeof CreateSettlementSchema>;
export type CreateBillInput = z.infer<typeof CreateBillSchema>;
export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;
export type CreateRecurringExpenseInput = z.infer<typeof CreateRecurringExpenseSchema>;
