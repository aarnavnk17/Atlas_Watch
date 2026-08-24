'use strict';

const express = require('express');
const { Contact } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * Contacts are addressed by id, but every query is also filtered by the
 * authenticated user — an id alone must not be enough to read or change a
 * record belonging to somebody else.
 */
function ownerFilter(id, userEmail) {
  const filter = { user_email: userEmail };
  if (/^[0-9a-fA-F]{24}$/.test(id)) filter._id = id;
  else if (/^\d+$/.test(id)) filter.legacy_id = Number(id);
  else return null;
  return filter;
}

router.get('/contacts', requireAuth, async (req, res) => {
  const contacts = await Contact.find({ user_email: req.userEmail }).lean();
  return res.json({ success: true, contacts });
});

router.post('/contacts', requireAuth, async (req, res) => {
  const { name, phone, relationship } = req.body;
  if (!name || !phone) return res.status(400).json({ success: false, message: 'Name and phone are required' });

  const contact = await Contact.create({ user_email: req.userEmail, name, phone, relationship });
  return res.json({ success: true, id: contact._id });
});

router.post('/contacts/:id', requireAuth, async (req, res) => {
  const filter = ownerFilter(req.params.id, req.userEmail);
  if (!filter) return res.status(400).json({ success: false, message: 'Invalid contact id' });

  const { name, phone, relationship } = req.body;
  const update = {};
  if (name) update.name = name;
  if (phone) update.phone = phone;
  if (relationship !== undefined) update.relationship = relationship;

  const result = await Contact.updateOne(filter, { $set: update });
  if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
  return res.json({ success: true });
});

router.delete('/contacts/:id', requireAuth, async (req, res) => {
  const filter = ownerFilter(req.params.id, req.userEmail);
  if (!filter) return res.status(400).json({ success: false, message: 'Invalid contact id' });

  const result = await Contact.deleteOne(filter);
  if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
  return res.json({ success: true });
});

module.exports = router;
