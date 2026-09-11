import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ParkingLot } from './entities/parking-lot.entity';
import { ParkingSpace } from './entities/parking-space.entity';
import {
  OPEN_STATUSES,
  ParkingSession,
} from '../sessions/entities/parking-session.entity';

@Injectable()
export class LotsService {
  constructor(
    @InjectRepository(ParkingLot)
    private readonly lotsRepository: Repository<ParkingLot>,
    @InjectRepository(ParkingSpace)
    private readonly spacesRepository: Repository<ParkingSpace>,
    @InjectRepository(ParkingSession)
    private readonly sessionsRepository: Repository<ParkingSession>,
  ) {}

  async findAll() {
    const lots = await this.lotsRepository.find({ order: { id: 'ASC' } });

    return lots.map((lot) => ({
      id: lot.id,
      name: lot.name,
      address: lot.address,
      isActive: lot.isActive,
    }));
  }

  async getAvailability(lotId: number) {
    const lot = await this.lotsRepository.findOneBy({
      id: lotId,
      isActive: true,
    });

    if (!lot) {
      throw new NotFoundException(`No active parking lot with id ${lotId}`);
    }

    const [capacity, occupied] = await Promise.all([
      this.spacesRepository.countBy({ lotId, isActive: true }),
      this.sessionsRepository.countBy({
        lotId,
        status: In(OPEN_STATUSES),
      }),
    ]);

    return {
      lotName: lot.name,
      capacity,
      occupied,
      available: capacity - occupied,
    };
  }
}
