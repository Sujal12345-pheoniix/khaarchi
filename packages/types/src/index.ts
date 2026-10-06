export enum HomeType {
  BACHELOR = 'BACHELOR',
  FAMILY = 'FAMILY',
}

export enum MemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum ExpenseCategory {
  GROCERIES = 'GROCERIES',
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  DINING_OUT = 'DINING_OUT',
  ENTERTAINMENT = 'ENTERTAINMENT',
  TRAVEL = 'TRAVEL',
  HEALTHCARE = 'HEALTHCARE',
  HOUSEHOLD_SUPPLIES = 'HOUSEHOLD_SUPPLIES',
  MAINTENANCE = 'MAINTENANCE',
  OTHER = 'OTHER',
}

export enum SplitType {
  EQUAL = 'EQUAL',
  EXACT = 'EXACT',
  PERCENTAGE = 'PERCENTAGE',
  SHARES = 'SHARES',
}

export enum FinancialStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SETTLE = 'SETTLE',
  INVITE = 'INVITE',
  INVITE_ACCEPT = 'INVITE_ACCEPT',
  INVITE_REJECT = 'INVITE_REJECT',
  INVITE_REVOKE = 'INVITE_REVOKE',
  ROLE_CHANGE = 'ROLE_CHANGE',
  MEMBER_DEACTIVATE = 'MEMBER_DEACTIVATE',
  LOGIN = 'LOGIN',
  FAILED_LOGIN = 'FAILED_LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ACCOUNT_DEACTIVATE = 'ACCOUNT_DEACTIVATE',
  EMAIL_VERIFY = 'EMAIL_VERIFY',
  ARCHIVE = 'ARCHIVE',
  RESTORE = 'RESTORE',
}

export enum ReceiptStatus {
  PENDING_SCAN = 'PENDING_SCAN',
  OCR_EXTRACTED = 'OCR_EXTRACTED',
  USER_VERIFIED = 'USER_VERIFIED',
  REJECTED = 'REJECTED',
}

export enum BillStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

export enum RecurringInterval {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface HomeSummary {
  id: string;
  name: string;
  type: HomeType;
  currency: string;
  description?: string | null;
  currentUserRole: MemberRole;
  currentMemberId: string;
  memberCount: number;
}
