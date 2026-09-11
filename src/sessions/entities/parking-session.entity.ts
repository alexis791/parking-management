import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ParkingLot } from '../../lots/entities/parking-lot.entity';
import { Vehicle } from './vehicle.entity';

export type SessionStatus = 'active' | 'paid' | 'closed';

// Estados que ocupan un cajón. Debe coincidir con el WHERE del
// índice uq_sessions_vehicle_inside en db/schema.sql.
export const OPEN_STATUSES: SessionStatus[] = ['active', 'paid'];

@Entity({ name: 'parking_sessions' })
export class ParkingSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ticket_code', type: 'varchar', length: 20, unique: true })
  ticketCode: string;

  @Column({ name: 'lot_id' })
  lotId: number;

  @Column({ name: 'vehicle_id' })
  vehicleId: number;

  @ManyToOne(() => ParkingLot, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lot_id' })
  lot: ParkingLot;

  @ManyToOne(() => Vehicle, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'entry_time', type: 'timestamptz' })
  entryTime: Date;

  @Column({ name: 'entry_estimated', type: 'boolean', default: false })
  entryEstimated: boolean;

  @Column({ name: 'exit_time', type: 'timestamptz', nullable: true })
  exitTime: Date | null;

  @Column({ type: 'varchar', length: 10, default: 'active' })
  status: SessionStatus;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
