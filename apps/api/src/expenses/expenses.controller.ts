import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { HomeMemberGuard } from '../homes/guards/home-member.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CreateExpenseSchema, CreateExpenseInput } from '@homeexpense/shared';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HomeMemberGuard)
@Controller('homes/:homeId/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Create an expense with atomic split and ledger reconciliation' })
  async createExpense(
    @Param('homeId') homeId: string,
    @CurrentUser() user: any,
    @Body() body: CreateExpenseInput
  ) {
    const parseResult = CreateExpenseSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.errors.map((e) => e.message).join(', '));
    }
    return this.expensesService.createExpense(homeId, user.id, parseResult.data);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of expenses for this home' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getExpenses(
    @Param('homeId') homeId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20
  ) {
    return this.expensesService.getHomeExpenses(homeId, Number(page), Number(limit));
  }

  @Get(':expenseId')
  @ApiOperation({ summary: 'Get details of a single expense with splits and audit trail' })
  async getExpenseById(
    @Param('homeId') homeId: string,
    @Param('expenseId') expenseId: string
  ) {
    return this.expensesService.getExpenseById(homeId, expenseId);
  }

  @Delete(':expenseId')
  @ApiOperation({ summary: 'Delete an expense and reverse its ledger entries' })
  async deleteExpense(
    @Param('homeId') homeId: string,
    @Param('expenseId') expenseId: string,
    @CurrentUser() user: any
  ) {
    return this.expensesService.deleteExpense(homeId, user.id, expenseId);
  }
}
