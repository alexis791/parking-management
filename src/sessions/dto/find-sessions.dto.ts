import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';
import { SessionStatus } from '../entities/parking-session.entity';

export class FindSessionsDto {
  @IsOptional()
  @IsIn(['active', 'paid', 'closed'])
  status?: SessionStatus;

  // Los query params llegan como string. Sin el @Type, @IsInt
  // rechazaría '1' por no ser número.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  lotId?: number;
}
