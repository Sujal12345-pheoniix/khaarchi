import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RateLimiterGuard } from './guards/rate-limiter.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  UpdateProfileSchema,
  VerifyEmailSchema,
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdateProfileInput,
  VerifyEmailInput,
} from '@homeexpense/shared';

@ApiTags('Auth & Identity')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(RateLimiterGuard)
  @ApiOperation({ summary: 'Register a new user account with secure password hashing and session creation' })
  async register(@Body() body: RegisterInput, @Req() req: any) {
    const parseResult = RegisterSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.authService.register(parseResult.data, ip, userAgent);
  }

  @Post('login')
  @UseGuards(RateLimiterGuard)
  @ApiOperation({ summary: 'Authenticate user with abuse lockout protection and session generation' })
  async login(@Body() body: LoginInput, @Req() req: any) {
    const parseResult = LoginSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.authService.login(parseResult.data, ip, userAgent);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate session refresh token and generate a new JWT access token' })
  async refresh(@Body() body: RefreshTokenInput, @Req() req: any) {
    const parseResult = RefreshTokenSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.authService.refreshToken(parseResult.data.refreshToken, ip, userAgent);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidate active sessions for current user' })
  async logout(
    @CurrentUser() user: any,
    @Body() body: { refreshToken?: string },
    @Req() req: any
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.authService.logout(user.id, body?.refreshToken, ip, userAgent);
  }

  @Post('verify-email/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request an email verification token' })
  async requestEmailVerification(@CurrentUser() user: any) {
    return this.authService.requestEmailVerification(user.id);
  }

  @Post('verify-email/confirm')
  @ApiOperation({ summary: 'Confirm email verification via token' })
  async verifyEmail(@Body() body: VerifyEmailInput) {
    const parseResult = VerifyEmailSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    return this.authService.verifyEmail(parseResult.data.token);
  }

  @Post('forgot-password')
  @UseGuards(RateLimiterGuard)
  @ApiOperation({ summary: 'Request password reset token (enumeration protected)' })
  async forgotPassword(@Body() body: RequestPasswordResetInput, @Req() req: any) {
    const parseResult = RequestPasswordResetSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.authService.requestPasswordReset(parseResult.data.email, ip, userAgent);
  }

  @Post('reset-password')
  @UseGuards(RateLimiterGuard)
  @ApiOperation({ summary: 'Reset password via token and revoke all active sessions' })
  async resetPassword(@Body() body: ResetPasswordInput, @Req() req: any) {
    const parseResult = ResetPasswordSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.authService.resetPassword(parseResult.data.token, parseResult.data.newPassword, ip, userAgent);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user and invalidate all other sessions' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() body: ChangePasswordInput,
    @Req() req: any
  ) {
    const parseResult = ChangePasswordSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.authService.changePassword(user.id, parseResult.data, ip, userAgent);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getProfile(@CurrentUser() user: any) {
    return { user };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update profile information for authenticated user' })
  async updateProfile(@CurrentUser() user: any, @Body() body: UpdateProfileInput) {
    const parseResult = UpdateProfileSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    return this.authService.updateProfile(user.id, parseResult.data);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate user account, terminate sessions, and revoke memberships' })
  async deactivateAccount(@CurrentUser() user: any, @Req() req: any) {
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.authService.deactivateAccount(user.id, ip, userAgent);
  }
}
