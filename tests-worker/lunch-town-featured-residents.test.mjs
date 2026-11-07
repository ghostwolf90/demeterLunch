import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../web/lunch-town/app.js', import.meta.url), 'utf8');
const english = readFileSync(new URL('../web/locales/en.js', import.meta.url), 'utf8');
function fn(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}
function declaration(name) {
  const start = source.indexOf(`const ${name} = `);
  assert.notEqual(start, -1, `${name} exists`);
  return source.slice(start, source.indexOf(';\n', start) + 1);
}
const constants = ['FEATURED_RESIDENT_NPCS', 'CHARACTER_PROFILES', 'ROLE_DIALOGUES', 'ROLE_LABELS',
  'ROLE_DESTINATION_PREFERENCES', 'ROLE_OUTFIT_STYLES', 'COLORS', 'NPC_PERSONALITIES',
  'BIKE_ELIGIBLE_ROLES', 'RIVERBANK_LEISURE_ROLES', 'WEEKEND_MARKET_ROLES', 'RESIDENTIAL_VENUE_TYPES',
  'CHARACTER_EXPRESSION_LABELS', 'DIALOGUE_EXPRESSION_SEQUENCES',
  'NPC_LIFE_MEMORY_LIMIT', 'NPC_LIFE_MEMORY_WINDOW_MS'];
const functions = ['hashText', 'varyOutfitColors', 'mobilityModeFor', 'chooseNpcDistrictRoute',
  'createNpcSchedule', 'chooseRoleDestination', 'hubSupportsRole', 'venueScheduleStop',
  'activityForDestination', 'reasonAtVenue', 'addResidentialStops', 'npcPrefersBike',
  'createRiverbankLeisureExcursion', 'createNeighborCountyExcursion', 'neighborCountyForNpc',
  'npcWalkingSpeed', 'clampNpcNeed', 'createNpcLifeState', 'rememberNpcLifeEvent',
  'npcPlayerMemoryLines', 'npcLifeTopicSummary', 'createTownCharacters', 'buildPlayerConversation', 'openNpcDialogue',
  'npcDialogueExpression', 'currentCharacterExpression', 'characterExpressionLabel',
  'renderNpcDialogue',
  'advanceNpcDialogue', 'closeNpcDialogue', 'drawPerson',
  'drawCharacterLegs', 'drawCharacterArms', 'drawCharacterOutfit', 'drawCharacterBackAccessory',
  'drawCharacterHair', 'drawCharacterFace', 'drawCharacterAccessory', 'resolveOutfitStyle',
  'drawNpcRiverbankActivity', 'drawPersonEmote', 'drawRainUmbrella', 'drawNpcBicycle'];

function load() {
  const calls = [];
  let depth = 0;
  const drawing = { fillStyle: '', strokeStyle: '',
    save() { depth++; }, restore() { assert.ok(depth > 0); depth--; },
  };
  for (const method of ['fillRect', 'strokeRect', 'translate', 'scale', 'arc', 'moveTo', 'lineTo', 'beginPath', 'stroke', 'fillText']) {
    drawing[method] = (...args) => {
      args.filter(value => typeof value === 'number').forEach(value => assert.ok(Number.isFinite(value), `${method} finite`));
      calls.push({ method, args, color: drawing.fillStyle });
    };
  }
  const refs = Object.fromEntries([
    'prompt', 'npcDialogue', 'npcName', 'npcRole', 'npcSource', 'npcText', 'npcNext', 'npcExpression',
  ].map(key => [key, {}]));
  refs.npcPortrait = { setAttribute() {} };
  const c = { state: { npcs: [], venues: [], schools: [], districtThemes: new Map(), keys: new Set(),
    environment: { clock: { hour: 12 } }, conversationMemory: [] }, refs, context: drawing, reducedMotion: false,
    DISTRICT_DISPLAY_ORDER: [], DISTRICT_ZONES: {}, SERVICE_VENUE_TYPES: [], SERVICE_STAFF_NAMES: {},
    DISTRICT_ADULTS: [], CHILD_NAMES: [], OCCASIONAL_TOWN_NPCS: [], DIVERSE_TOWN_NPCS: [],
    TOWN_SERVICE_NPCS: [], CITY_HALL_NPCS: [], CIVIC_TOWN_NPCS: [], CANDIDATE_APPEARANCE_RULES: {},
    // Isolate the resident integration from unrelated county population and DOM bootstrap.
    appendNeighborCountyCharacters() {},
    appendFlowerFestivalPromoters() {},
    drawFlowerFestivalPromoterBubble() {},
    createSmartNpcState() { return null; },
    chooseNpcInitialSpawn(identity, schedule) { return { stop: schedule[0], segment: 0 }; },
    assignNpcResidences(identities) { identities.forEach(n => { n.residenceVenueId = `${n.district}-home`; n.residenceLabel = '住家'; }); },
    setQuestPanelOpen() {}, endAmbientConversation() {}, trackTownEvent() {}, recordAchievementEvent() {},
    beginNpcLifeFollowUp() { return false; },
    announce() {}, updateNearbyPrompt() {}, townText: text => text, npcDisplayName: npc => npc.name,
    townUsesEnglish() { return false; }, renderNpcPortrait() {},
    districtAtPoint: npc => npc.district, performance: { now: () => 1000 }, canvas: { focus() {} },
    rememberConversation(memory) { c.state.conversationMemory.push(memory); },
  };
  vm.createContext(c);
  vm.runInContext(constants.map(declaration).join('\n') + '\n' + functions.map(fn).join('\n') +
    '\nObject.assign(globalThis, { FEATURED_RESIDENT_NPCS, CHARACTER_PROFILES, ROLE_DIALOGUES, ROLE_LABELS, ROLE_DESTINATION_PREFERENCES });', c);
  for (const n of c.FEATURED_RESIDENT_NPCS) {
    const types = ['apartment', ...c.ROLE_DESTINATION_PREFERENCES[n.role]];
    types.forEach((type, i) => c.state.venues.push({ id: i ? `${n.district}-${type}` : `${n.district}-home`,
      district: n.district, type, label: `${n.district}${type}`, x: 100 + i * 100, y: 100, w: 60, h: 40 }));
  }
  return { c, calls, depth: () => depth };
}

test('town creation includes three distinct adult female residents with fixed visual identities', () => {
  const { c } = load();
  c.createTownCharacters();
  assert.deepEqual(Array.from(c.state.npcs, n => n.name), ['海音', '沐白', '晴夏']);
  assert.deepEqual(Array.from(c.state.npcs, n => n.outfitStyle), ['leather-jacket', 'ivory-dress', 'athletic-set']);
  assert.deepEqual(Array.from(c.state.npcs, n => n.accessory), ['coffee-cup', 'butterfly-pin', 'water-bottle']);
  for (const n of c.state.npcs) {
    assert.equal(n.ageGroup, 'adult'); assert.equal(n.gender, 'female');
    assert.equal(n.featuredResident, true); assert.equal(n.mobilityMode, 'neighborhood');
    assert.ok(n.speed > 0); assert.ok(Number.isFinite(n.x)); assert.ok(Number.isFinite(n.y));
    assert.equal(n.dialogueCursor, 0); assert.equal(n.dialogues.length, 4);
    const profile = c.CHARACTER_PROFILES.find(p => p.role === n.role);
    for (const index of [0, 1, 29, 150]) {
      const varied = c.varyOutfitColors(profile, n, index);
      assert.notEqual(varied, profile, 'palette copy must not mutate shared profile');
      assert.deepEqual(varied, profile);
    }
  }
});

test('each resident route stays in her neighborhood and starts and ends at home', () => {
  const { c } = load(); c.createTownCharacters();
  for (const n of c.state.npcs) for (const index of [0, 1, 7, 29]) {
    const route = c.createNpcSchedule(n, index);
    assert.ok(route.length >= 5);
    assert.equal(route[0].venueId, n.residenceVenueId);
    assert.equal(route.at(-1).venueId, n.residenceVenueId);
    assert.equal(route[0].activity, 'at-home');
    for (const stop of route) {
      assert.equal(stop.district, n.district);
      assert.ok(Number.isFinite(stop.x) && Number.isFinite(stop.y));
      assert.ok(stop.dwellSeconds > 0);
    }
    for (const stop of route.slice(1, -1)) {
      const venue = c.state.venues.find(v => v.id === stop.venueId);
      assert.ok(c.ROLE_DESTINATION_PREFERENCES[n.role].includes(venue.type));
      if (n.role === 'fitness-coach' && ['park', 'stadium'].includes(venue.type)) assert.equal(stop.activity, 'exercising');
    }
  }
});

test('signature dialogue rotates, remembers the player, closes and reopens cleanly', () => {
  const { c } = load(); c.createTownCharacters();
  for (const n of c.state.npcs) {
    const dialogue = c.ROLE_DIALOGUES[n.role];
    for (let session = 0; session < dialogue.length + 1; session++) {
      c.openNpcDialogue(n);
      assert.equal(c.state.dialogueNpc, n);
      assert.equal(c.refs.npcDialogue.hidden, false);
      if (session === 0) assert.equal(c.refs.npcText.textContent, dialogue[0]);
      else assert.match(c.refs.npcText.textContent, /^我記得你上次和我聊過/);
      const sessionLines = [...c.state.dialogueLines];
      for (let line = 1; line < sessionLines.length; line++) {
        c.advanceNpcDialogue();
        assert.equal(c.refs.npcText.textContent, sessionLines[line]);
      }
      assert.equal(c.refs.npcNext.textContent, '結束對話');
      c.advanceNpcDialogue();
      assert.equal(c.state.dialogueNpc, null); assert.equal(c.state.dialogueLines.length, 0);
      assert.equal(c.refs.npcDialogue.hidden, true); assert.equal(n.activity, 'waiting');
      assert.equal(c.state.conversationMemory.at(-1).topicId, `resident-${n.role}`);
      c.advanceNpcDialogue(); // A late duplicate click after closing must be harmless.
    }
  }
});

test('all three render in four directions, gait frames, activities, rain and reduced motion', () => {
  const { c, calls, depth } = load(); c.createTownCharacters();
  for (const resident of c.state.npcs) for (const direction of ['up', 'down', 'left', 'right']) {
    for (const reduced of [false, true]) for (const activity of ['waiting', 'greeting', 'listening', 'exercising']) {
      c.reducedMotion = reduced; c.state.environment.isRaining = true;
      for (let step = 0; step < 4; step++) {
        calls.length = 0;
        c.drawPerson({ ...resident, direction, activity, step, isMoving: step !== 0, hasUmbrella: true,
          emote: 'smile', emoteUntil: 5000 }, 1000 + step * 280);
        assert.equal(depth(), 0, 'Canvas state is balanced');
        assert.ok(calls.filter(call => call.method === 'fillRect').length > 25);
        assert.ok(calls.some(call => call.color === resident.outfit));
        assert.ok(calls.some(call => call.color === resident.hair));
        const scale = calls.find(call => call.method === 'scale');
        assert.deepEqual(scale.args, [direction === 'left' ? -1 : 1, 1]);
      }
    }
  }
});

test('signature accessories render their distinguishing pixels and hide front pin from back', () => {
  const { c, calls } = load(); c.createTownCharacters();
  const [coffee, floral, fitness] = c.state.npcs;
  c.drawCharacterAccessory(coffee, 'down', 2, false);
  assert.ok(calls.some(call => call.color === '#bb8d61' && call.args[0] === 9));
  calls.length = 0; c.drawCharacterAccessory(floral, 'up', 0, false);
  assert.equal(calls.length, 0);
  c.drawCharacterAccessory(floral, 'down', 0, false);
  assert.equal(calls.length, 4);
  calls.length = 0; c.drawCharacterAccessory(fitness, 'down', 2, false);
  assert.ok(calls.some(call => call.color === '#d8eef2'));
});

test('featured names, roles, districts and every signature line have English coverage', () => {
  const { c } = load(); const locale = { window: {} }; vm.createContext(locale); vm.runInContext(english, locale);
  for (const n of c.FEATURED_RESIDENT_NPCS) {
    for (const text of [n.name, n.district, c.ROLE_LABELS[n.role], ...c.ROLE_DIALOGUES[n.role]]) {
      const translation = locale.window.LunchEnglish[text];
      assert.equal(typeof translation, 'string', `missing translation: ${text}`);
      assert.ok(translation.length > 0); assert.doesNotMatch(translation, /[\u3400-\u9fff]/u);
    }
  }
});

test('featured residents retain profiles after existing residents shift their creation indexes', () => {
  const { c } = load();
  c.OCCASIONAL_TOWN_NPCS.push({ name: '既有居民', role: 'coffee-lover', gender: 'female',
    district: '梧棲區', featuredResident: true });
  c.createTownCharacters();
  assert.equal(c.state.npcs.length, 4);
  const added = c.state.npcs.slice(1);
  assert.deepEqual(Array.from(added, n => [n.name, n.lookIndex, n.outfitStyle]), [
    ['海音', 1, 'leather-jacket'], ['沐白', 2, 'ivory-dress'], ['晴夏', 3, 'athletic-set'],
  ]);
  c.reducedMotion = true; c.createTownCharacters();
  for (const npc of c.state.npcs) {
    assert.equal(npc.speed, 0); assert.equal(npc.dwellRemaining, Infinity);
    assert.equal(npc.insideVenueId, '', 'stationary residents must remain visible and reachable');
  }
});

test('walking animates while reduced motion makes resident drawing stable across frames', () => {
  const { c, calls } = load(); c.createTownCharacters();
  for (const npc of c.state.npcs) {
    const draw = (step, now) => {
      calls.length = 0;
      c.drawPerson({ ...npc, direction: 'down', isMoving: true, activity: 'greeting', step }, now);
      return JSON.stringify(calls);
    };
    c.reducedMotion = false;
    assert.notEqual(draw(0, 1000), draw(1, 1280));
    c.reducedMotion = true;
    assert.equal(draw(0, 1000), draw(1, 1280));
  }
});
