export type DayFormality = 1 | 2 | 3 | 4 | 5;

export type OutfitStrategy =
  | 'one_polished_adaptable'
  | 'comfort_first'
  | 'weather_first'
  | 'office_to_evening'
  | 'event_priority'
  | 'casual_flexible';

export interface DayWeatherInput {
  temperature?: number;
  precipitation?: string;
  wind?: string;
}

export interface DayEventInput {
  id?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface EventIntelligence {
  index: number;
  title: string;
  timeLabel: string;
  allDay: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
  occasion: string;
  formality: DayFormality;
  confidence: number;
  isAnchorCandidate: boolean;
  tags: string[];
}

export interface DayIntelligence {
  dominant_occasion: string;
  dominant_formality: DayFormality;
  strategy: OutfitStrategy;
  anchor_event: EventIntelligence | null;
  first_important_event: EventIntelligence | null;
  highest_formality_event: EventIntelligence | null;
  final_event: EventIntelligence | null;
  all_day_focus: boolean;
  transition_complexity: 'low' | 'medium' | 'high';
  transition_summary: string;
  likely_indoor_outdoor: 'mostly_indoor' | 'mixed' | 'mostly_outdoor';
  travel_relevance: 'none' | 'moderate' | 'high';
  commute_relevance: 'none' | 'moderate' | 'high';
  weather_sensitivity: 'low' | 'medium' | 'high';
  weather_constraints: string[];
  wardrobe_priorities: string[];
  emphasis: {
    comfort: number;
    polish: number;
    versatility: number;
    weather_protection: number;
    travel_practicality: number;
  };
  events: EventIntelligence[];
}

const OCCASION_RULES: Array<{ occasion: string; formality: DayFormality; confidence: number; tags: string[] }> = [
  { occasion: 'formal', formality: 5, confidence: 0.98, tags: ['wedding', 'black tie', 'gala', 'ceremony', 'award', 'banquet'] },
  { occasion: 'party', formality: 4, confidence: 0.9, tags: ['party', 'celebration', 'birthday', 'cocktail', 'reception'] },
  { occasion: 'work', formality: 4, confidence: 0.9, tags: ['boardroom', 'client', 'presentation', 'interview', 'pitch', 'office', 'meeting'] },
  { occasion: 'dinner', formality: 4, confidence: 0.84, tags: ['dinner', 'restaurant', 'drinks', 'date', 'anniversary'] },
  { occasion: 'travel', formality: 2, confidence: 0.95, tags: ['airport', 'flight', 'terminal', 'train', 'station', 'hotel', 'check-in', 'travel', 'commute'] },
  { occasion: 'workout', formality: 1, confidence: 0.97, tags: ['gym', 'workout', 'run club', 'yoga', 'pilates', 'training', 'spin'] },
  { occasion: 'social', formality: 3, confidence: 0.72, tags: ['brunch', 'coffee', 'lunch', 'shopping', 'museum'] },
  { occasion: 'remote', formality: 2, confidence: 0.7, tags: ['remote', 'wfh', 'work from home', 'home office'] },
];

function normalizeText(input: string | null | undefined): string {
  return String(input || '').toLowerCase();
}

function toMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hh, mm] = value.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start && !end) return 'All day';
  if (!start) return `Until ${end}`;
  if (!end) return `${start}`;
  return `${start}-${end}`;
}

function inferEventOccasion(event: DayEventInput): EventIntelligence {
  const haystack = [event.title, event.description, event.location].map(normalizeText).join(' ');
  const allDay = !event.start_time;
  const startMinutes = toMinutes(event.start_time);
  const endMinutes = toMinutes(event.end_time);

  let bestRule = OCCASION_RULES[OCCASION_RULES.length - 1];
  let bestScore = 0;
  for (const rule of OCCASION_RULES) {
    const score = rule.tags.reduce((acc, tag) => acc + (haystack.includes(tag) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  let inferredFormality = bestRule.formality;
  if ((startMinutes !== null && startMinutes >= 1080) && inferredFormality < 4 && bestRule.occasion !== 'workout') {
    inferredFormality = Math.min(5, inferredFormality + 1) as DayFormality;
  }
  if ((startMinutes !== null && startMinutes <= 540) && bestRule.occasion === 'travel') {
    inferredFormality = 2;
  }

  const locationText = normalizeText(event.location);
  const titleText = normalizeText(event.title);
  const travelTagged = ['airport', 'terminal', 'station', 'flight', 'train', 'hotel'].some((token) => haystack.includes(token));
  const workoutTagged = ['gym', 'workout', 'run', 'training', 'yoga', 'pilates'].some((token) => haystack.includes(token));
  const outdoorTagged = ['park', 'outdoor', 'walk', 'run club', 'hike'].some((token) => haystack.includes(token));

  const tags: string[] = [];
  if (travelTagged) tags.push('travel');
  if (workoutTagged) tags.push('workout');
  if (outdoorTagged) tags.push('outdoor');
  if (locationText.includes('office') || titleText.includes('meeting')) tags.push('office');
  if (allDay) tags.push('all_day');

  return {
    index: 0,
    title: event.title,
    timeLabel: formatTimeRange(event.start_time, event.end_time),
    allDay,
    startMinutes,
    endMinutes,
    occasion: bestRule.occasion,
    formality: inferredFormality,
    confidence: bestScore > 0 ? bestRule.confidence : 0.45,
    isAnchorCandidate: inferredFormality >= 4 || travelTagged || workoutTagged,
    tags,
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

export function buildDayIntelligence(events: DayEventInput[], weather?: DayWeatherInput | null): DayIntelligence {
  const interpreted = events
    .map(inferEventOccasion)
    .map((event, index) => ({ ...event, index }))
    .sort((a, b) => (a.startMinutes ?? 9999) - (b.startMinutes ?? 9999));

  const formalityCounts = new Map<DayFormality, number>();
  const occasionCounts = new Map<string, number>();
  let travelEvents = 0;
  let workoutEvents = 0;
  let outdoorEvents = 0;

  for (const event of interpreted) {
    formalityCounts.set(event.formality, (formalityCounts.get(event.formality) || 0) + 1);
    occasionCounts.set(event.occasion, (occasionCounts.get(event.occasion) || 0) + 1);
    if (event.tags.includes('travel')) travelEvents += 1;
    if (event.tags.includes('workout')) workoutEvents += 1;
    if (event.tags.includes('outdoor')) outdoorEvents += 1;
  }

  const dominantOccasion = [...occasionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'casual';
  const dominantFormality = ([...formalityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 3) as DayFormality;
  const highestFormalityEvent = interpreted.reduce<EventIntelligence | null>((best, current) => {
    if (!best || current.formality > best.formality) return current;
    return best;
  }, null);
  const anchorEvent = interpreted.reduce<EventIntelligence | null>((best, current) => {
    const currentScore = current.formality * 2 + (current.isAnchorCandidate ? 2 : 0) + (current.confidence * 2);
    const bestScore = best ? (best.formality * 2 + (best.isAnchorCandidate ? 2 : 0) + (best.confidence * 2)) : -1;
    return currentScore > bestScore ? current : best;
  }, null);

  const firstImportantEvent = interpreted.find((event) => event.formality >= 3 || event.tags.includes('travel')) || interpreted[0] || null;
  const finalEvent = interpreted[interpreted.length - 1] || null;
  const allDayFocus = interpreted.length > 0 && interpreted.every((event) => event.allDay);

  let transitionPoints = 0;
  for (let i = 1; i < interpreted.length; i++) {
    const prev = interpreted[i - 1];
    const next = interpreted[i];
    if (Math.abs(prev.formality - next.formality) >= 2) transitionPoints += 1;
    if (prev.occasion !== next.occasion) transitionPoints += 1;
    if ((next.startMinutes ?? 0) - (prev.endMinutes ?? prev.startMinutes ?? 0) <= 90) transitionPoints += 0.5;
  }

  let weatherSensitivityScore = 0;
  const precipitation = normalizeText(weather?.precipitation);
  const temp = weather?.temperature;
  if (precipitation.includes('rain') || precipitation.includes('snow')) weatherSensitivityScore += 2.5;
  if (typeof temp === 'number' && (temp <= 8 || temp >= 29)) weatherSensitivityScore += 2;
  if (travelEvents > 0 || outdoorEvents > 0) weatherSensitivityScore += 1.5;

  const weatherSensitivity = weatherSensitivityScore >= 4 ? 'high' : weatherSensitivityScore >= 2 ? 'medium' : 'low';
  const transitionComplexity = transitionPoints >= 3 ? 'high' : transitionPoints >= 1.5 ? 'medium' : 'low';
  const travelRelevance = travelEvents >= 2 ? 'high' : travelEvents === 1 ? 'moderate' : 'none';
  const commuteRelevance = interpreted.some((event) => event.startMinutes !== null && event.startMinutes <= 540)
    || interpreted.some((event) => event.startMinutes !== null && event.startMinutes >= 1020)
    ? 'moderate'
    : 'none';

  const likelyIndoorOutdoor = outdoorEvents >= interpreted.length && interpreted.length > 0
    ? 'mostly_outdoor'
    : outdoorEvents > 0 || travelEvents > 0
      ? 'mixed'
      : 'mostly_indoor';

  let strategy: OutfitStrategy = 'casual_flexible';
  if (travelRelevance === 'high' || weatherSensitivity === 'high') strategy = weatherSensitivity === 'high' ? 'weather_first' : 'comfort_first';
  if (dominantOccasion === 'work' && interpreted.some((event) => ['party', 'dinner'].includes(event.occasion) && (event.startMinutes ?? 0) >= 1020)) {
    strategy = 'office_to_evening';
  }
  if (highestFormalityEvent && highestFormalityEvent.formality >= 5) strategy = 'event_priority';
  if (transitionComplexity === 'medium' && dominantFormality >= 4 && strategy === 'casual_flexible') strategy = 'one_polished_adaptable';

  const emphasis = {
    comfort: clampScore(4 + travelEvents * 2 + workoutEvents * 1.5 + (transitionComplexity === 'high' ? 1 : 0)),
    polish: clampScore(3 + dominantFormality * 1.4 + (highestFormalityEvent?.formality === 5 ? 1.5 : 0)),
    versatility: clampScore(4 + transitionPoints * 1.6),
    weather_protection: clampScore(3 + weatherSensitivityScore * 2),
    travel_practicality: clampScore(2 + travelEvents * 3 + (commuteRelevance !== 'none' ? 1 : 0)),
  };

  const weatherConstraints: string[] = [];
  if (precipitation.includes('rain')) weatherConstraints.push('rain-ready layers and shoes');
  if (precipitation.includes('snow')) weatherConstraints.push('insulated outerwear and traction shoes');
  if (typeof temp === 'number' && temp <= 8) weatherConstraints.push('warmth and layering are mandatory');
  if (typeof temp === 'number' && temp >= 29) weatherConstraints.push('heat-breathable fabrics and low bulk');

  const wardrobePriorities = [
    strategy === 'office_to_evening' ? 'structured base that can dress up at night' : null,
    travelRelevance !== 'none' ? 'comfortable footwear and crease-resistant layers' : null,
    transitionComplexity !== 'low' ? 'modular layers that flex across events' : null,
    weatherSensitivity !== 'low' ? 'weather-protective outer layer' : null,
    dominantFormality >= 4 ? 'polished top layer with clean silhouette' : 'easy movement and all-day comfort',
  ].filter((entry): entry is string => Boolean(entry));

  const anchorName = anchorEvent ? `${anchorEvent.timeLabel} ${anchorEvent.title}` : 'day flow';
  const transitionSummary = transitionComplexity === 'high'
    ? `High-transition day anchored by ${anchorName}; outfit needs modular adjustments.`
    : transitionComplexity === 'medium'
      ? `Mixed day anchored by ${anchorName}; one adaptable look with a swap layer works best.`
      : `Steady day anchored by ${anchorName}; one consistent outfit strategy is sufficient.`;

  return {
    dominant_occasion: dominantOccasion,
    dominant_formality: dominantFormality,
    strategy,
    anchor_event: anchorEvent,
    first_important_event: firstImportantEvent,
    highest_formality_event: highestFormalityEvent,
    final_event: finalEvent,
    all_day_focus: allDayFocus,
    transition_complexity: transitionComplexity,
    transition_summary: transitionSummary,
    likely_indoor_outdoor: likelyIndoorOutdoor,
    travel_relevance: travelRelevance,
    commute_relevance: commuteRelevance,
    weather_sensitivity: weatherSensitivity,
    weather_constraints: weatherConstraints,
    wardrobe_priorities: wardrobePriorities,
    emphasis,
    events: interpreted,
  };
}
