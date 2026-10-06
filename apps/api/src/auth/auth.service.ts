import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  UpdateProfileInput,
  AuditAction,
} from '@homeexpense/shared';

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
  private readonly maxFailedAttempts = 5;
  private readonly lockoutDurationMinutes = 15;
  private readonly refreshTokenLifetimeDays = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateSecureRandomToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async register(input: RegisterInput, ip?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ConflictException('A user with this email address already exists.');
    }

    const passwordHash = await bcrypt.hash(input.password, this.saltRounds);
    const verificationToken = this.generateSecureRandomToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        avatarUrl: input.avatarUrl,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Create session and refresh token
    const refreshTokenRaw = this.generateSecureRandomToken();
    const refreshTokenHash = this.hashToken(refreshTokenRaw);
    const sessionExpiresAt = new Date(Date.now() + this.refreshTokenLifetimeDays * 24 * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        ipAddress: ip,
        userAgent,
        isValid: true,
        expiresAt: sessionExpiresAt,
      },
    });

    const accessToken = this.generateToken(user.id, user.email, session.id);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entityType: 'User',
        entityId: user.id,
        ipAddress: ip,
        userAgent,
        payload: { email: user.email },
      },
    });

    return {
      user,
      accessToken,
      refreshToken: refreshTokenRaw,
      verificationToken, // Provided for instant onboarding verification in dev/tests
    };
  }

  async login(input: LoginInput, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.isDeactivated) {
      throw new UnauthorizedException('This account has been deactivated. Please contact support.');
    }

    // Check brute-force lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / (60 * 1000));
      throw new UnauthorizedException(
        `Account is temporarily locked due to consecutive failed logins. Please retry in ${waitMinutes} minute(s).`
      );
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);

    if (!isMatch) {
      const newFailedCount = user.failedLoginAttempts + 1;
      const willLockout = newFailedCount >= this.maxFailedAttempts;
      const lockoutDate = willLockout
        ? new Date(Date.now() + this.lockoutDurationMinutes * 60 * 1000)
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedCount,
          lockoutUntil: lockoutDate,
        },
      });

      // Audit log failed login
      await this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.FAILED_LOGIN,
          entityType: 'User',
          entityId: user.id,
          ipAddress: ip,
          userAgent,
          payload: { attempts: newFailedCount, lockedOut: willLockout },
        },
      });

      throw new UnauthorizedException('Invalid email or password.');
    }

    // Reset failed attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    // Generate Session & Refresh Token
    const refreshTokenRaw = this.generateSecureRandomToken();
    const refreshTokenHash = this.hashToken(refreshTokenRaw);
    const sessionExpiresAt = new Date(Date.now() + this.refreshTokenLifetimeDays * 24 * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        ipAddress: ip,
        userAgent,
        isValid: true,
        expiresAt: sessionExpiresAt,
      },
    });

    const accessToken = this.generateToken(user.id, user.email, session.id);

    // Audit log successful login
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: AuditAction.LOGIN,
        entityType: 'Session',
        entityId: session.id,
        ipAddress: ip,
        userAgent,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: refreshTokenRaw,
    };
  }

  async refreshToken(refreshTokenRaw: string, ip?: string, userAgent?: string) {
    const refreshTokenHash = this.hashToken(refreshTokenRaw);

    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash },
      include: { user: true },
    });

    if (!session || !session.isValid) {
      throw new UnauthorizedException('Invalid or revoked session refresh token.');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { isValid: false },
      });
      throw new UnauthorizedException('Refresh token has expired. Please sign in again.');
    }

    if (session.user.isDeactivated) {
      throw new UnauthorizedException('Account has been deactivated.');
    }

    // Rotate refresh token for replay protection
    await this.prisma.session.update({
      where: { id: session.id },
      data: { isValid: false },
    });

    const newRefreshTokenRaw = this.generateSecureRandomToken();
    const newRefreshTokenHash = this.hashToken(newRefreshTokenRaw);
    const sessionExpiresAt = new Date(Date.now() + this.refreshTokenLifetimeDays * 24 * 60 * 60 * 1000);

    const newSession = await this.prisma.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: newRefreshTokenHash,
        ipAddress: ip,
        userAgent,
        isValid: true,
        expiresAt: sessionExpiresAt,
      },
    });

    const accessToken = this.generateToken(session.user.id, session.user.email, newSession.id);

    return {
      accessToken,
      refreshToken: newRefreshTokenRaw,
    };
  }

  async logout(userId: string, refreshTokenRaw?: string, ip?: string, userAgent?: string) {
    if (refreshTokenRaw) {
      const refreshTokenHash = this.hashToken(refreshTokenRaw);
      await this.prisma.session.updateMany({
        where: { userId, refreshTokenHash },
        data: { isValid: false },
      });
    } else {
      // Invalidate all active sessions for this user
      await this.prisma.session.updateMany({
        where: { userId, isValid: true },
        data: { isValid: false },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AuditAction.LOGOUT,
        entityType: 'User',
        entityId: userId,
        ipAddress: ip,
        userAgent,
      },
    });

    return { success: true, message: 'Logged out successfully.' };
  }

  async requestEmailVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.emailVerified) {
      return { message: 'Email is already verified.' };
    }

    const verificationToken = this.generateSecureRandomToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    return {
      message: 'Verification token generated successfully.',
      verificationToken,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired email verification token.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: AuditAction.EMAIL_VERIFY,
        entityType: 'User',
        entityId: user.id,
        payload: { email: user.email },
      },
    });

    return { success: true, message: 'Email verified successfully.' };
  }

  async requestPasswordReset(email: string, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Defense against enumeration: always respond with friendly message
    if (!user || user.isDeactivated) {
      return {
        message: 'If an active account exists with this email, a reset token has been dispatched.',
      };
    }

    const resetToken = this.generateSecureRandomToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: AuditAction.PASSWORD_RESET,
        entityType: 'User',
        entityId: user.id,
        ipAddress: ip,
        userAgent,
        payload: { stage: 'REQUESTED' },
      },
    });

    return {
      message: 'If an active account exists with this email, a reset token has been dispatched.',
      resetToken, // Returned for dev/test verification
    };
  }

  async resetPassword(token: string, newPassword: string, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);

    // Update password, clear reset tokens, and revoke ALL active sessions
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, isValid: true },
        data: { isValid: false },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.PASSWORD_RESET,
          entityType: 'User',
          entityId: user.id,
          ipAddress: ip,
          userAgent,
          payload: { stage: 'COMPLETED' },
        },
      }),
    ]);

    return { success: true, message: 'Password reset successful. All prior sessions have been revoked.' };
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    ip?: string,
    userAgent?: string
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isMatch = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Current password does not match.');
    }

    if (input.currentPassword === input.newPassword) {
      throw new BadRequestException('New password cannot be identical to the current password.');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, this.saltRounds);

    // Invalidate prior sessions and establish a fresh session
    const refreshTokenRaw = this.generateSecureRandomToken();
    const refreshTokenHash = this.hashToken(refreshTokenRaw);
    const sessionExpiresAt = new Date(Date.now() + this.refreshTokenLifetimeDays * 24 * 60 * 60 * 1000);

    const [_, newSession] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.session.create({
        data: {
          userId,
          refreshTokenHash,
          ipAddress: ip,
          userAgent,
          isValid: true,
          expiresAt: sessionExpiresAt,
        },
      }),
      this.prisma.session.updateMany({
        where: {
          userId,
          refreshTokenHash: { not: refreshTokenHash },
          isValid: true,
        },
        data: { isValid: false },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.PASSWORD_CHANGE,
          entityType: 'User',
          entityId: userId,
          ipAddress: ip,
          userAgent,
        },
      }),
    ]);

    const accessToken = this.generateToken(user.id, user.email, newSession.id);

    return {
      success: true,
      message: 'Password changed successfully. Prior sessions revoked.',
      accessToken,
      refreshToken: refreshTokenRaw,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
        updatedAt: true,
      },
    });

    return { user };
  }

  async deactivateAccount(userId: string, ip?: string, userAgent?: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          isDeactivated: true,
          deactivatedAt: new Date(),
        },
      }),
      this.prisma.homeMember.updateMany({
        where: { userId },
        data: { isActive: false },
      }),
      this.prisma.session.updateMany({
        where: { userId, isValid: true },
        data: { isValid: false },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.ACCOUNT_DEACTIVATE,
          entityType: 'User',
          entityId: userId,
          ipAddress: ip,
          userAgent,
        },
      }),
    ]);

    return { success: true, message: 'Account deactivated and all memberships suspended.' };
  }

  private generateToken(userId: string, email: string, sessionId?: string): string {
    return this.jwtService.sign(
      {
        sub: userId,
        email,
        sessionId,
      },
      { expiresIn: '1h' }
    );
  }
}
