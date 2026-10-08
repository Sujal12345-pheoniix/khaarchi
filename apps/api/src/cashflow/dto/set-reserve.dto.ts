import { ApiProperty } from '@nestjs/swagger';

export class SetReserveDto {
  @ApiProperty({
    example: 5000,
    description: 'Protected emergency reserve amount in major currency units',
  })
  protectedReserve!: number;
}
