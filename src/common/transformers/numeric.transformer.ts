import { ValueTransformer } from 'typeorm';

/**
 * El driver de Postgres entrega NUMERIC como string para no perder
 * precisión al pasar por el double de JavaScript.
 *
 * Sin esto, pricePerHour valdría "25.00" y calculateAmount() recibiría
 * un string donde declara number. Es el mismo problema que el ::int
 * de COUNT() en la consulta de disponibilidad.
 *
 * Ojo: parseFloat devuelve un double, así que la exactitud decimal
 * solo está garantizada dentro de Postgres. En JS se hacen los
 * cálculos y el resultado se redondea a 2 decimales al guardar.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : parseFloat(value)),
};
