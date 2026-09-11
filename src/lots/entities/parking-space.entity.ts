import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ParkingLot } from './parking-lot.entity';

@Entity({ name: 'parking_spaces' })
export class ParkingSpace {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'lot_id' })
  lotId: number;

  @ManyToOne(() => ParkingLot, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lot_id' })
  lot: ParkingLot;

  @Column({ type: 'varchar', length: 10 })
  level: string;

  @Column({ type: 'varchar', length: 10 })
  section: string;

  @Column({ name: 'space_number', type: 'varchar', length: 10 })
  spaceNumber: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
