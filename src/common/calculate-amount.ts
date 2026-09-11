export interface AmountRate {
  pricePerHour: number;
  minCharge: number;
  dailyMax: number | null;
  graceMinutes: number;
}

/**
 * Algoritmo:
 *   1. si minutos <= graceMinutes-> 0
 *   2. horas  = techo(minutos / 60)
 *   3. monto  = horas * pricePerHour
 *   4. monto  = maximo(monto, minCharge)
 *   5. si dailyMax no es null:
 *          dias  = techo(minutos / 1440)
 *          monto = minimo(monto, dias * dailyMax)
 *   6. devolver monto
 */
export function calculateAmount(minutes: number, rate: AmountRate): number {
  if (minutes <= rate.graceMinutes) return 0;

  const hours = Math.ceil(minutes / 60);
  let amount = hours * rate.pricePerHour;

  amount = Math.max(amount, rate.minCharge);

  if (rate.dailyMax !== null) {
    const days = Math.ceil(minutes / 1440);
    amount = Math.min(amount, days * rate.dailyMax);
  }

  // El dinero sale a 2 decimales: los productos de arriba pasan por
  // double y pueden dejar residuos binarios (25.10 * 3 = 75.29999...).
  return Math.round(amount * 100) / 100;
}
