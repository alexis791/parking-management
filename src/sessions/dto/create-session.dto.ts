import { Transform } from 'class-transformer';
import {
  IsInt,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSessionDto {
  @IsInt()
  @IsPositive()
  lotId: number;

  // El @Transform corre antes que los validadores, así que se
  // valida la placa YA normalizada: 'vkr-8321' -> 'VKR8321'.
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.toUpperCase().replace(/[\s-]/g, '')
      : value,
  )
  @IsString()
  @MinLength(5)
  @MaxLength(15)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'plate must contain only letters and digits',
  })
  plate: string;
}
