'use strict';

const axios = require('axios');
const config = require('../config');

/**
 * Server-side emergency notification.
 *
 * The mobile app opens the SMS composer, which needs a conscious user to press
 * send — no use in exactly the situation auto-SOS exists for. This runs on the
 * server so an alert leaves the system regardless of the phone's state.
 *
 * With TWILIO_* configured it sends real SMS; otherwise every intended
 * recipient is recorded as 'skipped' with the reason, so an unconfigured deploy
 * is visible in the alert record instead of looking like a successful send.
 */
function buildMessage({ location, profile, aiScore, trigger }) {
  const name = profile?.fullName || 'An AtlasWatch user';
  const lines = [`🚨 ${name} triggered an SOS alert.`];

  if (location?.lat != null && location?.lng != null) {
    lines.push(`Location: https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`);
  }
  if (trigger === 'ai_auto') {
    lines.push(`Auto-triggered by AtlasWatch risk monitoring${aiScore != null ? ` (danger score ${aiScore}/100)` : ''}.`);
  }
  if (profile) {
    const medical = [
      profile.bloodGroup && `Blood: ${profile.bloodGroup}`,
      profile.allergies && `Allergies: ${profile.allergies}`,
      profile.medicalConditions && `Conditions: ${profile.medicalConditions}`,
    ].filter(Boolean);
    if (medical.length) lines.push(`Medical: ${medical.join(' | ')}`);
  }
  return lines.join('\n');
}

async function sendSms(to, body) {
  const { accountSid, authToken, fromNumber } = config.twilio;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });

  const response = await axios.post(url, params.toString(), {
    auth: { username: accountSid, password: authToken },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });
  return response.data?.sid || 'sent';
}

/**
 * @returns {Promise<Array>} one record per contact, shaped for SosAlert.notifications
 */
async function notifyEmergencyContacts({ contacts = [], location, profile, aiScore, trigger }) {
  if (!contacts.length) {
    console.warn('🚨 SOS raised but the user has no emergency contacts on file');
    return [];
  }

  const body = buildMessage({ location, profile, aiScore, trigger });

  if (!config.twilio.enabled) {
    console.warn(
      `🚨 SOS notification NOT sent (TWILIO_* not configured). Would have texted ${contacts.length} contact(s):\n${body}`
    );
    return contacts.map(c => ({
      channel: 'sms',
      to: c.phone,
      status: 'skipped',
      detail: 'No SMS provider configured (set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER)',
    }));
  }

  return Promise.all(contacts.map(async contact => {
    try {
      const sid = await sendSms(contact.phone, body);
      console.log(`📨 SOS SMS sent to ${contact.phone} (${sid})`);
      return { channel: 'sms', to: contact.phone, status: 'sent', detail: sid };
    } catch (err) {
      const detail = err.response?.data?.message || err.message;
      console.error(`❌ SOS SMS to ${contact.phone} failed: ${detail}`);
      return { channel: 'sms', to: contact.phone, status: 'failed', detail };
    }
  }));
}

module.exports = { notifyEmergencyContacts, buildMessage };
