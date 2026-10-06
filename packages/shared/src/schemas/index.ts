import { z } from 'zod';
import { HomeType, MemberRole, ExpenseCategory, SplitType } from '../constants/enums.js';
import { validateExpenseSplits, validateSettlementAmount } from '../financial/invariants.js';

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

// Home Schemas
export const CreateHomeSchema = z.object({
  name: z.string().min(2, 'Home name must be at least 2 characters').max(50).trim(),
  type: z.nativeEnum(HomeType),
  currency: z.string().length(3).default('INR'),
  description: z.string().max(250).optional(),
});

export const InviteMemberSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  role: z.nativeEnum(MemberRole).default(MemberRole.MEMBER),
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

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateHomeInput = z.infer<typeof CreateHomeSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export type SplitItemInput = z.infer<typeof SplitItemSchema>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type CreateSettlementInput = z.infer<typeof CreateSettlementSchema>;
