import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'vehicles' })
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 15, unique: true })
  plate: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  color: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
