import { AmountRate, calculateAmount } from './calculate-amount';

describe('calculateAmount', () => {
  //Arrange
  const rate: AmountRate = {
    pricePerHour: 25,
    minCharge: 25,
    dailyMax: 180,
    graceMinutes: 15,
  };

  it('does not charge within the grace period', () => {
    const minutes = 10;

    //Act
    const amount = calculateAmount(minutes, rate);

    //Assert
    expect(amount).toBe(0);
  });

  it('does not charge at the exact grace limit', () => {
    const minutes = 15;

    const amount = calculateAmount(minutes, rate);

    expect(amount).toBe(0);
  });

  it('charges once the grace period is exceeded', () => {
    const minutes = 16;

    const amount = calculateAmount(minutes, rate);

    expect(amount).toBe(25);
  });

  it('charges 1 hour for exactly 60 minutes (y sin el espacio final)', () => {
    const minutes = 60;

    const amount = calculateAmount(minutes, rate);

    expect(amount).toBe(25);
  });

  it('charges 2 hours when minutes passed 1 hour (60 min)', () => {
    const minutes = 61;

    const amount = calculateAmount(minutes, rate);

    expect(amount).toBe(50);
  });

  it('charges the daily limit', () => {
    const minutes = 600; //10 hours

    const amount = calculateAmount(minutes, rate);

    expect(amount).toBe(180);
  });

  it('charges 2 days', () => {
    const minutes = 1800; // 30 hours

    const amount = calculateAmount(minutes, rate);

    expect(amount).toBe(360);
  });

  it('does not cap the amount when dailyMax is null', () => {
    const rateWithoutCap: AmountRate = {
      ...rate,
      dailyMax: null,
    };
    const minutes = 1800; // 30 hours

    const amount = calculateAmount(minutes, rateWithoutCap);

    expect(amount).toBe(750);
  });

  it('rounds the amount to 2 decimals', () => {
    const rateWithFractionHour: AmountRate = {
      ...rate,
      pricePerHour: 25.1,
    };
    const minutes = 150; // 2.5 hours

    const amount = calculateAmount(minutes, rateWithFractionHour);

    expect(amount).toBe(75.3);
  });
});
