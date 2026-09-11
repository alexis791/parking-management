import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { calculateAmount } from '../common/calculate-amount';
import { ParkingLot } from '../lots/entities/parking-lot.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { FindSessionsDto } from './dto/find-sessions.dto';
import {
  OPEN_STATUSES,
  ParkingSession,
} from './entities/parking-session.entity';
import { Rate } from './entities/rate.entity';
import { Vehicle } from './entities/vehicle.entity';

const UNIQUE_VIOLATION = '23505';
const MS_PER_MINUTE = 60_000;

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(ParkingLot)
    private readonly lotsRepository: Repository<ParkingLot>,
    @InjectRepository(ParkingSession)
    private readonly sessionsRepository: Repository<ParkingSession>,
    @InjectRepository(Rate)
    private readonly ratesRepository: Repository<Rate>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createSessionDto: CreateSessionDto) {
    const { lotId, plate } = createSessionDto;

    const lot = await this.lotsRepository.findOneBy({
      id: lotId,
      isActive: true,
    });

    if (!lot) {
      throw new NotFoundException(`No active parking lot with id ${lotId}`);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const vehicle = await this.findOrCreateVehicle(manager, plate);
        const ticketCode = await this.nextTicketCode(manager);

        const session = manager.create(ParkingSession, {
          ticketCode,
          lotId: lot.id,
          vehicleId: vehicle.id,
        });

        const { id } = await manager.save(session);
        const created = await manager.findOneByOrFail(ParkingSession, { id });

        return {
          ticketCode: created.ticketCode,
          lotName: lot.name,
          entryTime: created.entryTime,
        };
      });
    } catch (error) {
      throw this.translateDbError(error, plate);
    }
  }

  // Sin monto a propósito: calcularlo por fila exigiría leer la tarifa
  // de cada lot y correr calculateAmount() en cada una. Para el monto
  // está findByTicketCode.
  async findAll({ status, lotId }: FindSessionsDto) {
    const sessions = await this.sessionsRepository.find({
      where: {
        ...(status && { status }),
        ...(lotId && { lotId }),
      },
      relations: { lot: true, vehicle: true },
      order: { entryTime: 'DESC' },
    });

    return sessions.map((session) => ({
      ticketCode: session.ticketCode,
      plate: session.vehicle.plate,
      lotName: session.lot.name,
      status: session.status,
      entryTime: session.entryTime,
      exitTime: session.exitTime,
    }));
  }

  async findByTicketCode(ticketCode: string) {
    const session = await this.findOneOrFail(ticketCode);
    const rate = await this.currentRate(session.lotId);

    // Una sesión cerrada ya no corre: el reloj se detuvo al salir.
    const until = session.exitTime ?? new Date();
    const minutesElapsed = this.minutesBetween(session.entryTime, until);

    return {
      ticketCode: session.ticketCode,
      plate: session.vehicle.plate,
      lotName: session.lot.name,
      status: session.status,
      entryTime: session.entryTime,
      exitTime: session.exitTime,
      minutesElapsed,
      hoursCharged: Math.ceil(minutesElapsed / 60),
      amountDue: calculateAmount(minutesElapsed, rate),
    };
  }

  async exit(ticketCode: string) {
    const session = await this.findOneOrFail(ticketCode);

    if (session.status === 'closed') {
      throw new ConflictException(`Session ${ticketCode} is already closed`);
    }

    // Una sesión 'paid' ya liquidó su estancia. El MVP no lee payments,
    // así que no hay contra qué calcular una diferencia: se cobra 0.
    // Cuando payments entre al alcance esto pasa a ser
    // max(0, amountDue - pagado).
    const alreadyPaid = session.status === 'paid';

    // La tarifa se lee ANTES del UPDATE: si el lot no tiene tarifa
    // vigente, preferimos fallar con la sesión todavía abierta a
    // cerrarla sin poder decir cuánto se cobra.
    const rate = alreadyPaid ? null : await this.currentRate(session.lotId);

    // El WHERE repite el estado a propósito: si dos peticiones de
    // salida llegan a la vez, solo una afecta filas. La otra ve
    // affected = 0 y cae en el 409 de abajo.
    const { affected } = await this.sessionsRepository
      .createQueryBuilder()
      .update(ParkingSession)
      .set({ status: 'closed', exitTime: () => 'now()' })
      .where('ticket_code = :ticketCode AND status IN (:...openStatuses)', {
        ticketCode,
        openStatuses: OPEN_STATUSES,
      })
      .execute();

    if (!affected) {
      throw new ConflictException(
        `Session ${ticketCode} was already closed by another request`,
      );
    }

    const closed = await this.sessionsRepository.findOneByOrFail({
      id: session.id,
    });

    const exitTime = closed.exitTime;
    const minutesElapsed = this.minutesBetween(session.entryTime, exitTime);

    return {
      ticketCode: session.ticketCode,
      plate: session.vehicle.plate,
      lotName: session.lot.name,
      status: 'closed',
      entryTime: session.entryTime,
      exitTime,
      minutesElapsed,
      hoursCharged: Math.ceil(minutesElapsed / 60),
      amountCharged: rate ? calculateAmount(minutesElapsed, rate) : 0,
      previouslyPaid: alreadyPaid,
    };
  }

  private async findOneOrFail(ticketCode: string): Promise<ParkingSession> {
    const session = await this.sessionsRepository.findOne({
      where: { ticketCode },
      relations: { lot: true, vehicle: true },
    });

    if (!session) {
      throw new NotFoundException(`No session with ticket code ${ticketCode}`);
    }

    return session;
  }

  // La tarifa vigente es la única con valid_to NULL. Sin ese filtro
  // también vendrían las históricas.
  private async currentRate(lotId: number): Promise<Rate> {
    const rate = await this.ratesRepository.findOneBy({
      lotId,
      validTo: IsNull(),
    });

    if (!rate) {
      throw new NotFoundException(`No active rate for parking lot ${lotId}`);
    }

    return rate;
  }

  private minutesBetween(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / MS_PER_MINUTE);
  }

  private async findOrCreateVehicle(
    manager: EntityManager,
    plate: string,
  ): Promise<Vehicle> {
    const existing = await manager.findOneBy(Vehicle, { plate });
    if (existing) return existing;

    return manager.save(manager.create(Vehicle, { plate }));
  }

  // La secuencia vive fuera de cualquier SERIAL. nextval() es atómico
  // y no se revierte con un ROLLBACK, así que dos peticiones
  // simultáneas nunca reciben el mismo número.
  private async nextTicketCode(manager: EntityManager): Promise<string> {
    const [{ nextval }] = await manager.query(
      `SELECT nextval('ticket_code_seq') AS nextval`,
    );

    const year = new Date().getFullYear();
    return `T-${year}-${String(nextval).padStart(4, '0')}`;
  }

  private translateDbError(error: unknown, plate: string): Error {
    if (error instanceof QueryFailedError) {
      const { code, constraint } = error.driverError ?? {};

      if (code === UNIQUE_VIOLATION) {
        if (constraint === 'uq_sessions_vehicle_inside') {
          return new ConflictException(
            `Vehicle ${plate} already has an open session`,
          );
        }

        if (constraint === 'vehicles_plate_key') {
          return new ConflictException(
            `Vehicle ${plate} was registered concurrently, retry the request`,
          );
        }
      }
    }

    if (error instanceof NotFoundException) return error;

    return new InternalServerErrorException('Could not create the session');
  }
}
