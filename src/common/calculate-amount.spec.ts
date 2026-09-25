import { AmountRate, calculateAmount } from './calculate-amount';

describe('calculateAmount', () => {
  //Arrange
  const rate: AmountRate = {
    pricePerHour: 25,
    minCharge: 25,
    dailyMax: 180,
    graceMinutes: 15,
  };

  it('does not charge into the grace minutes', () => {
    const minutes = 10;

    //Act
    const amount = calculateAmount(minutes, rate);

    //Assert
    expect(amount).toBe(0);
  });

  it('does not charge on the limit grace minutes', () => {
    const minutes = 15;

    const amount = calculateAmount(minutes, rate);

    expect(amount).toBe(0);
  });

  it('does charge on grace time exceed', () => {
    const minutes = 16;

    const amount = calculateAmount(minutes, rate);

    expect(amount).toBe(25);
  });

  it('charges 1 hour for 60 minutes ', () => {
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

  it('Charges with out dailyMax limit', () => {
    const rate: AmountRate = {
      pricePerHour: 25,
      minCharge: 25,
      dailyMax: null,
      graceMinutes: 15,
    };
    const minutes = 1800; // 30 hours

    const amount = calculateAmount(minutes, rate);

    expect(amount).toBe(750);
  });

  it('Rounded Cents', () => {
    const rate: AmountRate = {
      pricePerHour: 25.1,
      minCharge: 25,
      dailyMax: null,
      graceMinutes: 15,
    };
    const minutes = 150; // 30 hours

    const amount = calculateAmount(minutes, rate);

    expect(amount).toBe(75.3);
  });
});
