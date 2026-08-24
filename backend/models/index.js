'use strict';

const mongoose = require('mongoose');
const config = require('../config');

// Emails are the join key across every collection, so they are normalised at the
// schema level. Mongoose applies these setters to query filters too, which is
// what lets every lookup use an exact match instead of a built regex.
const emailField = (extra = {}) => ({
  type: String,
  required: true,
  trim: true,
  lowercase: true,
  ...extra,
});

const userSchema = new mongoose.Schema({
  email: emailField({ unique: true, index: true }),
  // Never returned by default — callers that need it must ask explicitly.
  password: { type: String, required: true, select: false },
  profile_completed: { type: Boolean, default: false },
  lastLocation: { type: Object },
  active_journey: { type: Object, default: null },
}, { timestamps: true });

const profileSchema = new mongoose.Schema({
  email: emailField({ index: true, unique: true }),
  fullName: String,
  phoneNumber: String,
  passport: { type: String, default: null },
  documentType: String,
  nationality: String,
  bloodGroup: String,
  medicalConditions: String,
  allergies: String,
  isStudent: Boolean,
  universityName: String,
  isWorking: Boolean,
  organizationName: String,
}, { timestamps: true });

const contactSchema = new mongoose.Schema({
  user_email: emailField({ index: true }),
  name: String,
  phone: String,
  relationship: String,
  legacy_id: Number,
}, { timestamps: true });

const documentSchema = new mongoose.Schema({
  user_email: emailField({ index: true }),
  originalName: String,
  fileName: String,       // on-disk name; never exposed to clients
  fileType: String,
  sizeBytes: Number,
  category: { type: String, enum: ['Ticket', 'Hotel', 'Insurance', 'Passport', 'Other'], default: 'Other' },
  uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

const locationSchema = new mongoose.Schema({
  email: emailField(),
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  address: String,
  accuracy: Number,
  riskLevel: String,
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

// Anomaly detection compares consecutive fixes, so each update is its own
// document. The TTL index keeps the breadcrumb trail from growing without bound.
locationSchema.index({ email: 1, timestamp: -1 });
locationSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: config.locationRetentionDays * 24 * 60 * 60 }
);

const geofenceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['safe', 'restricted', 'high-risk'], default: 'restricted' },
  center: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  radius: { type: Number, required: true }, // metres
  created_by: { type: String, default: 'admin' },
}, { timestamps: true });

const SOS_TRIGGERS = ['manual', 'ai_auto', 'inactivity', 'geofence', 'anomaly'];

const sosAlertSchema = new mongoose.Schema({
  email: emailField({ index: true }),
  lat: { type: Number },
  lng: { type: Number },
  trigger: { type: String, enum: SOS_TRIGGERS, default: 'manual' },
  status: { type: String, enum: ['active', 'resolved'], default: 'active' },
  aiScore: { type: Number },
  notes: { type: String },
  // What the server actually managed to send, per contact.
  notifications: [{
    channel: String,
    to: String,
    status: { type: String, enum: ['sent', 'failed', 'skipped'] },
    detail: String,
    at: { type: Date, default: Date.now },
  }],
  resolvedAt: { type: Date },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

sosAlertSchema.index({ status: 1, timestamp: -1 });

const anomalyLogSchema = new mongoose.Schema({
  email: emailField({ index: true }),
  lat: { type: Number },
  lng: { type: Number },
  risk_level: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  anomaly_flag: { type: Boolean, default: false },
  reason: { type: String },
  details: { type: Object },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

anomalyLogSchema.index({ timestamp: -1 });

const crimeStatSchema = new mongoose.Schema({
  state: { type: String, required: true, index: true },
  city: { type: String, required: true, index: true },
  risk: String,
  score: Number,
  areas: mongoose.Schema.Types.Mixed,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' }, // [longitude, latitude]
  },
  radius: { type: Number, default: 1000 },
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true });

const incidentSchema = new mongoose.Schema({
  location: { type: String, required: true, index: true },
  latitude: Number,
  longitude: Number,
  type: { type: String, enum: ['theft', 'assault', 'harassment', 'fraud', 'suspicious', 'other'], default: 'other' },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  reportedBy: String,
  description: String,
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = {
  User: mongoose.model('User', userSchema),
  Profile: mongoose.model('Profile', profileSchema),
  Contact: mongoose.model('Contact', contactSchema),
  Document: mongoose.model('Document', documentSchema),
  Location: mongoose.model('Location', locationSchema),
  Geofence: mongoose.model('Geofence', geofenceSchema),
  SosAlert: mongoose.model('SosAlert', sosAlertSchema),
  AnomalyLog: mongoose.model('AnomalyLog', anomalyLogSchema),
  CrimeStat: mongoose.model('CrimeStat', crimeStatSchema),
  Incident: mongoose.model('Incident', incidentSchema),
  SOS_TRIGGERS,
};
