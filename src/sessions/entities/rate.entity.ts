import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../../common/transformers/numeric.transformer';
import { ParkingLot } from '../../lots/entities/parking-lot.entity';

@Entity({ name: 'rates' })
export class Rate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'lot_id' })
  lotId: number;

  @ManyToOne(() => ParkingLot, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lot_id' })
  lot: ParkingLot;

  @Column({
    name: 'price_per_hour',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  pricePerHour: number;

  @Column({
    name: 'min_charge',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  minCharge: number;

  @Column({
    name: 'daily_max',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  dailyMax: number | null;

  @Column({ name: 'grace_minutes', type: 'int', default: 0 })
  graceMinutes: number;

  @Column({ name: 'valid_from', type: 'timestamptz' })
  validFrom: Date;

  @Column({ name: 'valid_to', type: 'timestamptz', nullable: true })
  validTo: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
