// weatherCodes — N14/F2 extraction unit cover.
//
// Pinning the three pure helpers extracted from `useWeather` + `useForecast`
// against the WMO ranges in https://open-meteo.com/en/docs. Asserts each
// branch + edge boundaries so a future range tweak shows up in CI.

import {
  getConditionFromCode,
  getPrecipitationFromCode,
  getWindCategory,
} from '../weatherCodes';

describe('weatherCodes', () => {
  describe('getConditionFromCode', () => {
    it('returns clear for 0', () => {
      expect(getConditionFromCode(0)).toBe('weather.condition.clear');
    });

    it('returns cloudy for 1-3', () => {
      expect(getConditionFromCode(1)).toBe('weather.condition.cloudy');
      expect(getConditionFromCode(2)).toBe('weather.condition.cloudy');
      expect(getConditionFromCode(3)).toBe('weather.condition.cloudy');
    });

    it('returns fog for 45 and 48 only', () => {
      expect(getConditionFromCode(45)).toBe('weather.condition.fog');
      expect(getConditionFromCode(48)).toBe('weather.condition.fog');
      expect(getConditionFromCode(46)).toBe('weather.condition.unknown');
    });

    it('returns drizzle for 51-57 inclusive', () => {
      expect(getConditionFromCode(51)).toBe('weather.condition.drizzle');
      expect(getConditionFromCode(57)).toBe('weather.condition.drizzle');
    });

    it('returns rain for 61-67, rain_showers for 80-82', () => {
      expect(getConditionFromCode(61)).toBe('weather.condition.rain');
      expect(getConditionFromCode(67)).toBe('weather.condition.rain');
      expect(getConditionFromCode(80)).toBe('weather.condition.rain_showers');
      expect(getConditionFromCode(82)).toBe('weather.condition.rain_showers');
    });

    it('returns snow for 71-77, snow_showers for 85-86', () => {
      expect(getConditionFromCode(71)).toBe('weather.condition.snow');
      expect(getConditionFromCode(77)).toBe('weather.condition.snow');
      expect(getConditionFromCode(85)).toBe('weather.condition.snow_showers');
      expect(getConditionFromCode(86)).toBe('weather.condition.snow_showers');
    });

    it('returns thunder for 95-99', () => {
      expect(getConditionFromCode(95)).toBe('weather.condition.thunder');
      expect(getConditionFromCode(99)).toBe('weather.condition.thunder');
    });

    it('returns unknown for out-of-range codes', () => {
      expect(getConditionFromCode(100)).toBe('weather.condition.unknown');
      expect(getConditionFromCode(40)).toBe('weather.condition.unknown');
    });
  });

  describe('getPrecipitationFromCode', () => {
    it('returns snow for 71-77 and 85-86', () => {
      expect(getPrecipitationFromCode(71)).toBe('snow');
      expect(getPrecipitationFromCode(77)).toBe('snow');
      expect(getPrecipitationFromCode(85)).toBe('snow');
      expect(getPrecipitationFromCode(86)).toBe('snow');
    });

    it('returns rain for 51-67, 80-82, 95-99', () => {
      expect(getPrecipitationFromCode(51)).toBe('rain');
      expect(getPrecipitationFromCode(67)).toBe('rain');
      expect(getPrecipitationFromCode(80)).toBe('rain');
      expect(getPrecipitationFromCode(82)).toBe('rain');
      expect(getPrecipitationFromCode(95)).toBe('rain');
      expect(getPrecipitationFromCode(99)).toBe('rain');
    });

    it('returns none for clear / cloudy / fog / unknown', () => {
      expect(getPrecipitationFromCode(0)).toBe('none');
      expect(getPrecipitationFromCode(3)).toBe('none');
      expect(getPrecipitationFromCode(45)).toBe('none');
      expect(getPrecipitationFromCode(48)).toBe('none');
      expect(getPrecipitationFromCode(100)).toBe('none');
    });
  });

  describe('getWindCategory', () => {
    it('returns low for <15 km/h', () => {
      expect(getWindCategory(0)).toBe('low');
      expect(getWindCategory(14.9)).toBe('low');
    });

    it('returns medium for 15-29 km/h', () => {
      expect(getWindCategory(15)).toBe('medium');
      expect(getWindCategory(29.9)).toBe('medium');
    });

    it('returns high for ≥30 km/h', () => {
      expect(getWindCategory(30)).toBe('high');
      expect(getWindCategory(100)).toBe('high');
    });
  });
});
