import { ApiProperty } from '@nestjs/swagger';
import { ExpenseCategory } from '@homeexpense/shared';

export class BudgetCategoryAllocationDto {
  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.GROCERIES })
  category!: ExpenseCategory;

  @ApiProperty({ example: 20000, description: 'Allocated amount for this category in major units' })
  allocatedAmount!: number;
}

export class SetBudgetDto {
  @ApiProperty({ example: 10, description: 'Month of the budget (1-12)', required: false })
  month?: number;

  @ApiProperty({ example: 2026, description: 'Year of the budget', required: false })
  year?: number;

  @ApiProperty({ example: 50000, description: 'Total monthly budget ceiling' })
  totalBudget!: number;

  @ApiProperty({ type: [BudgetCategoryAllocationDto], description: 'Category envelope allocations', required: false })
  categories?: BudgetCategoryAllocationDto[];
}
