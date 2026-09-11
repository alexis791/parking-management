import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { LotsService } from './lots.service';

@Controller('lots')
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  @Get()
  findAll() {
    return this.lotsService.findAll();
  }

  @Get(':id/availability')
  getAvailability(@Param('id', ParseIntPipe) lotId: number) {
    return this.lotsService.getAvailability(lotId);
  }
}
