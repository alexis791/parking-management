import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { ParkingSession } from './entities/parking-session.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Rate } from './entities/rate.entity';
import { ParkingLot } from '../lots/entities/parking-lot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParkingSession, Vehicle, Rate, ParkingLot]),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
