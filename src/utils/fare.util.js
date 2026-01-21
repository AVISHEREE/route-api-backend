const FARE_RULES = {
  "Mail/Express": {
    perKm: 0.55,
    superfast: 0
  },
  "SuperFast": {
    perKm: 0.6,
    superfast: 75
  }
};

function calculateFare(distanceKm, trainType) {
  const rule = FARE_RULES[trainType] || FARE_RULES["Mail/Express"];

  const baseFare = distanceKm * rule.perKm;
  const finalFare = Math.round(baseFare + rule.superfast);

  return finalFare;
}

export {
  calculateFare
};