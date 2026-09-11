import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { FindSessionsDto } from './dto/find-sessions.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Body() createSessionDto: CreateSessionDto) {
    return this.sessionsService.create(createSessionDto);
  }

  @Get()
  findAll(@Query() findSessionsDto: FindSessionsDto) {
    return this.sessionsService.findAll(findSessionsDto);
  }

  @Get(':ticketCode')
  findByTicketCode(@Param('ticketCode') ticketCode: string) {
    return this.sessionsService.findByTicketCode(ticketCode);
  }

  @Post(':ticketCode/exit')
  @HttpCode(HttpStatus.OK)
  exit(@Param('ticketCode') ticketCode: string) {
    return this.sessionsService.exit(ticketCode);
  }
}
