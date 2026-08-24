'use strict';

const crimeData = require('./lib/crimeData');

const SOS_THRESHOLD = 75;
const DANGER_THRESHOLD = 60;
const CAUTION_THRESHOLD = 40;

const HIGH_RISK_AREAS = ['dharavi','kurla','govandi','mankhurd','seelampur','sangam vihar','uttam nagar','gajuwaka','jagadamba','benz circle','patamata','saidapet','vyasarpadi','kolathur','turbhe','vashi naka','asilmetta','maharanipeta','brodiepet','arundelpet'];
const MEDIUM_RISK_AREAS = ['airport','railway station','bus stand','bus depot','market','bazaar','junction','flyover'];
const LOW_RISK_AREAS = ['resort','hotel','mall','it park','tech park','university','hospital','embassy'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Compresses raw incident counts into a 0–65 base, leaving headroom for modifiers. */
function normaliseCrimeBase(rawScore) {
  if (!rawScore || rawScore <= 0) return 0;
  return Math.min(65, Math.round(Math.sqrt(rawScore / crimeData.maxRawScore) * 65));
}

function crimeScoreForLocation(locationName) {
  return normaliseCrimeBase(crimeData.rawScoreFor(locationName));
}

function locationProfileScore(locationName, cityScore = 35) {
  const loc = String(locationName).toLowerCase();
  let modifier = 0;
  for (const a of HIGH_RISK_AREAS) if (loc.includes(a)) { modifier = 20; break; }
  if (modifier === 0) for (const a of MEDIUM_RISK_AREAS) if (loc.includes(a)) { modifier = 10; break; }
  if (modifier === 0) for (const a of LOW_RISK_AREAS) if (loc.includes(a)) { modifier = -15; break; }
  return clamp(cityScore + modifier, 5, 100);
}

function temporalRiskScore(hour, dayOfWeek) {
  let s;
  if (hour >= 23 || hour < 3)       s = 90;
  else if (hour >= 3 && hour < 6)   s = 70;
  else if (hour >= 6 && hour < 9)   s = 35;
  else if (hour >= 9 && hour < 17)  s = 20;
  else if (hour >= 17 && hour < 20) s = 30;
  else                              s = 55;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend && (hour >= 22 || hour < 4)) s = Math.min(100, s + 10);
  return s;
}

function reportVelocityScore(reportCount) {
  if (reportCount <= 0) return 0;
  return Math.min(100, Math.round(30 * Math.log(reportCount + 1)));
}

function transportRiskScore(mode) {
  if (!mode) return 0;
  const m = String(mode).toLowerCase();
  if (m.includes('walk') || m.includes('foot')) return 35;
  if (m.includes('bike') || m.includes('cycle')) return 28;
  if (m.includes('auto') || m.includes('rickshaw')) return 20;
  if (m.includes('bus')) return 15;
  if (m.includes('car') || m.includes('taxi')) return 8;
  if (m.includes('metro') || m.includes('train')) return 5;
  return 12;
}

function behaviouralScore(flags = {}) {
  let score = 0;
  if (flags.prolongedInactivity) score += 35;

  // Zone risk is counted once. `geofenceBoost` is the specific zone-type value
  // (high-risk / restricted / safe); `geofenceBreach` is the generic "inside a
  // flagged zone" signal. Adding both double-counted the same event.
  const zoneScore = flags.geofenceBoost
    ? flags.geofenceBoost
    : (flags.geofenceBreach ? 50 : 0);

  return clamp(score + zoneScore, 0, 100);
}

/**
 * Resolves the hour-of-day to score against.
 *
 * Time-of-day risk is about the user's local night, not the server's. The
 * client sends its own local hour (or UTC offset); the server clock is only a
 * last resort and is reported as such in `meta.timeSource`.
 */
function resolveLocalTime({ now = new Date(), localHour, tzOffsetMinutes } = {}) {
  if (Number.isInteger(localHour) && localHour >= 0 && localHour <= 23) {
    return { hour: localHour, dayOfWeek: now.getUTCDay(), timeSource: 'client_hour' };
  }
  if (Number.isFinite(tzOffsetMinutes)) {
    const shifted = new Date(now.getTime() + tzOffsetMinutes * 60000);
    return { hour: shifted.getUTCHours(), dayOfWeek: shifted.getUTCDay(), timeSource: 'client_offset' };
  }
  return { hour: now.getHours(), dayOfWeek: now.getDay(), timeSource: 'server_clock' };
}

function severityLabel(score) {
  if (score >= SOS_THRESHOLD) return 'critical';
  if (score >= DANGER_THRESHOLD) return 'danger';
  if (score >= CAUTION_THRESHOLD) return 'caution';
  return 'safe';
}

function displayNameFor(locationName) {
  const entry = crimeData.lookup(locationName);
  if (entry) return entry.city;
  return String(locationName).split(',')[0].trim();
}

function buildExplanation(score, bd, reportCount, locationName, hour) {
  const displayName = displayNameFor(locationName);
  const factors = [];

  if (bd.crimeBase >= 50)      factors.push(`High historical crime rate in ${displayName}`);
  else if (bd.crimeBase >= 30) factors.push(`Moderate crime data for ${displayName}`);
  else if (bd.crimeBase > 0)   factors.push(`Low crime baseline for ${displayName}`);

  if (bd.locationProfile > bd.crimeBase)      factors.push('Specific area type increases risk level');
  else if (bd.locationProfile < bd.crimeBase) factors.push('Specific area type provides safety buffer');

  if (bd.temporalRisk >= 70)  factors.push(`High-risk time of night (${hour}:00 local)`);
  if (reportCount > 0)        factors.push(`${reportCount} recent incident report${reportCount > 1 ? 's' : ''} nearby`);
  if (bd.behavioural >= 30)   factors.push('Unusual movement or geofence breach detected');
  if (bd.transportRisk >= 25) factors.push('High vulnerability due to travel mode (walking/cycling)');

  const severity = severityLabel(score);
  let reasoning;
  switch (severity) {
    case 'critical': reasoning = `Critical danger detected near ${displayName}. Immediate action recommended.`; break;
    case 'danger':   reasoning = `Significant risk factors present near ${displayName}. Stay vigilant.`; break;
    case 'caution':  reasoning = `Elevated risk in ${displayName}. Exercise extra caution.`; break;
    default:         reasoning = `${displayName} appears relatively safe. Maintain normal awareness.`;
  }
  return { reasoning, factors };
}

function assess(input) {
  const {
    crimeRawScore = 0,
    locationName = 'Unknown',
    reportCount = 0,
    transportMode = null,
    flags = {},
    now = new Date(),
    localHour,
    tzOffsetMinutes,
  } = input;

  const { hour, dayOfWeek, timeSource } = resolveLocalTime({ now, localHour, tzOffsetMinutes });

  const datasetScore = crimeScoreForLocation(locationName);
  const dbScore = normaliseCrimeBase(crimeRawScore);
  const crimeBase = datasetScore > 0 ? datasetScore : (dbScore > 0 ? dbScore : 35);

  const locationProfile = locationProfileScore(locationName, crimeBase);
  const temporalRisk = temporalRiskScore(hour, dayOfWeek);
  const reportVelocity = reportVelocityScore(reportCount);
  const behavioural = behaviouralScore(flags);
  const transportRisk = transportRiskScore(transportMode);

  // Crime is the base (0–65); everything else is a bounded modifier.
  const timeMod = Math.round((temporalRisk - 15) * 0.25);
  const reportMod = Math.round(reportVelocity * 0.20);
  const behaviourMod = Math.round(behavioural * 0.08);
  const locMod = locationProfile >= 70 ? 12 : locationProfile >= 50 ? 6 : locationProfile <= 20 ? -5 : 0;
  const transportMod = Math.round((transportRisk - 8) * 0.15);

  const score = clamp(crimeBase + timeMod + reportMod + behaviourMod + locMod + transportMod, 5, 100);
  const breakdown = { crimeBase, locationProfile, temporalRisk, recentReports: reportVelocity, behavioural, transportRisk };
  const { reasoning, factors } = buildExplanation(score, breakdown, reportCount, locationName, hour);

  // An automatic SOS needs something to have *happened*. Crime statistics plus a
  // late hour describe a place, not an emergency: on their own they score
  // walking through a large city at night at 100, which would broadcast a
  // distress alert to a user's contacts every night they walked home. A high
  // score still shows the warning UI — it just does not dial out by itself
  // unless the user is stationary when they shouldn't be, has entered a flagged
  // zone, or there are fresh incident reports nearby.
  const situationalSignal =
    Boolean(flags.prolongedInactivity) ||
    Boolean(flags.geofenceBreach) ||
    (flags.geofenceBoost || 0) > 0 ||
    reportCount > 0;

  return {
    score,
    severity: severityLabel(score),
    reasoning,
    shouldTriggerSos: score >= SOS_THRESHOLD && situationalSignal,
    sosSuppressed: score >= SOS_THRESHOLD && !situationalSignal,
    riskFactors: factors,
    breakdown,
    meta: {
      reportCount,
      hour,
      dayOfWeek,
      timeSource,
      situationalSignal,
      location: locationName,
      transportMode,
      computedAt: now.toISOString(),
    },
  };
}

module.exports = {
  assess,
  extractCity: crimeData.extractCity,
  normaliseCrimeBase,
  temporalRiskScore,
  behaviouralScore,
  resolveLocalTime,
  severityLabel,
  SOS_THRESHOLD,
  DANGER_THRESHOLD,
  CAUTION_THRESHOLD,
};
