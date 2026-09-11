import { Module } from '@nestjs/common';
import { LotsService } from './lots.service';
import { LotsController } from './lots.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParkingLot } from './entities/parking-lot.entity';
import { ParkingSpace } from './entities/parking-space.entity';
import { ParkingSession } from '../sessions/entities/parking-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParkingLot, ParkingSpace, ParkingSession]),
  ],
  controllers: [LotsController],
  providers: [LotsService],
})
export class LotsModule {}
