import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../web/lunch-town/app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  let depth = 0;
  let opened = false;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
      opened = true;
    } else if (source[index] === '}') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unable to extract ${name}`);
}

function loadSchedule(environment) {
  const context = {
    state: {
      environment,
      venues: [
        { id: 'home', district: '西屯區', type: 'apartment', label: '市政晴庭公寓' },
        { id: 'civic-south-night-convenience', district: '西屯區', type: 'convenience-store', label: '福星小站・市政生活店' },
      ],
    },
    CIVIC_AFTER_HOURS_ROLES: new Set(['mayor', 'civil-servant', 'city-supervisor']),
    venueScheduleStop(venue) {
      return { x: 1, y: 2, district: venue.district, venueId: venue.id, label: venue.label };
    },
    eveningShoppingVenues() { return []; },
    hashText() { return 0; },
  };
  vm.createContext(context);
  vm.runInContext([
    functionSource('civicAfterHoursPeriod'),
    functionSource('civicAfterHoursRetailVenue'),
    functionSource('createCivicAfterHoursSchedule'),
  ].join('\n'), context);
  return context;
}

test('City Hall staff load at home during the 23:00–07:00 late-night period', () => {
  const context = loadSchedule({ dateKey: '2026-11-03', clock: { hour: 23 } });
  const schedule = context.createCivicAfterHoursSchedule({
    name: '怡安承辦', role: 'civil-servant', residenceVenueId: 'home',
  }, 0, context.state.environment);
  assert.equal(context.civicAfterHoursPeriod(context.state.environment), 'late-night');
  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].venueId, 'home');
  assert.equal(schedule[0].activity, 'at-home');
  assert.match(schedule[0].reason, /今晚不再返回市府辦公區/);
});

test('City Hall staff may shop after 18:00 but their evening route ends at home', () => {
  const context = loadSchedule({ dateKey: '2026-11-03', clock: { hour: 20 } });
  const schedule = context.createCivicAfterHoursSchedule({
    name: '怡安承辦', role: 'civil-servant', residenceVenueId: 'home',
  }, 0, context.state.environment);
  assert.equal(context.civicAfterHoursPeriod(context.state.environment), 'evening');
  assert.deepEqual(Array.from(schedule, stop => stop.venueId), ['civic-south-night-convenience', 'home']);
  assert.equal(schedule.at(-1).dwellSeconds, 12 * 60 * 60);
});

