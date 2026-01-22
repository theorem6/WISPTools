/**
 * Portal Content API
 * Manages alerts, FAQ, knowledge base, and chat settings for customer portal
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth, requireAdmin } = require('../middleware/admin-auth');

// Portal Content Schemas
const AlertSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'warning', 'outage', 'maintenance'], default: 'info' },
  status: { type: String, enum: ['active', 'resolved', 'scheduled'], default: 'active' },
  startDate: Date,
  endDate: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const FAQSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: { type: String, default: 'General' },
  order: { type: Number, default: 0 },
  published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const KBArticleSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, default: 'Getting Started' },
  tags: [String],
  published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ChatSettingsSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  welcomeMessage: { type: String, default: 'Hello! How can we help you today?' },
  offlineMessage: { type: String, default: 'We are currently offline. Please leave a message.' },
  operatingHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '09:00' },
    end: { type: String, default: '17:00' },
    timezone: { type: String, default: 'America/New_York' }
  },
  autoResponses: {
    greeting: { type: String, default: 'Thanks for reaching out! A support agent will be with you shortly.' },
    away: { type: String, default: 'All agents are currently busy. Please wait.' },
    closed: { type: String, default: 'We are currently closed.' }
  },
  updatedAt: { type: Date, default: Date.now }
});

// Create models (check if they already exist to avoid recompilation errors)
const Alert = mongoose.models.PortalAlert || mongoose.model('PortalAlert', AlertSchema);
const FAQ = mongoose.models.PortalFAQ || mongoose.model('PortalFAQ', FAQSchema);
const KBArticle = mongoose.models.PortalKBArticle || mongoose.model('PortalKBArticle', KBArticleSchema);
const ChatSettings = mongoose.models.PortalChatSettings || mongoose.model('PortalChatSettings', ChatSettingsSchema);

const requireAdminMiddleware = requireAdmin();

// ============ ALERTS ============

// Get all alerts for tenant
router.get('/:tenantId/alerts', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const alerts = await Alert.find({ tenantId }).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get active alerts for tenant (public endpoint for portal)
router.get('/:tenantId/alerts/active', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const now = new Date();
    
    const alerts = await Alert.find({
      tenantId,
      status: { $in: ['active', 'scheduled'] },
      $or: [
        { startDate: { $exists: false } },
        { startDate: { $lte: now } }
      ]
    }).sort({ type: 1, createdAt: -1 });
    
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching active alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Create alert
router.post('/:tenantId/alerts', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const alert = new Alert({ ...req.body, tenantId });
    await alert.save();
    res.status(201).json(alert);
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Update alert
router.put('/:tenantId/alerts/:alertId', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId, alertId } = req.params;
    const alert = await Alert.findOneAndUpdate(
      { _id: alertId, tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(alert);
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Delete alert
router.delete('/:tenantId/alerts/:alertId', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId, alertId } = req.params;
    const alert = await Alert.findOneAndDelete({ _id: alertId, tenantId });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// ============ FAQ ============

// Get all FAQs for tenant
router.get('/:tenantId/faq', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const faqs = await FAQ.find({ tenantId }).sort({ category: 1, order: 1 });
    res.json(faqs);
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
});

// Get published FAQs for tenant (public endpoint for portal)
router.get('/:tenantId/faq/published', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const faqs = await FAQ.find({ tenantId, published: true }).sort({ category: 1, order: 1 });
    res.json(faqs);
  } catch (error) {
    console.error('Error fetching published FAQs:', error);
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
});

// Create FAQ
router.post('/:tenantId/faq', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Get max order for category
    const maxOrder = await FAQ.findOne({ tenantId, category: req.body.category })
      .sort({ order: -1 })
      .select('order');
    
    const faq = new FAQ({
      ...req.body,
      tenantId,
      order: (maxOrder?.order || 0) + 1
    });
    await faq.save();
    res.status(201).json(faq);
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({ error: 'Failed to create FAQ' });
  }
});

// Update FAQ
router.put('/:tenantId/faq/:faqId', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId, faqId } = req.params;
    const faq = await FAQ.findOneAndUpdate(
      { _id: faqId, tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }
    
    res.json(faq);
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({ error: 'Failed to update FAQ' });
  }
});

// Delete FAQ
router.delete('/:tenantId/faq/:faqId', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId, faqId } = req.params;
    const faq = await FAQ.findOneAndDelete({ _id: faqId, tenantId });
    
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
});

// ============ KNOWLEDGE BASE ============

// Get all articles for tenant
router.get('/:tenantId/knowledge-base', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const articles = await KBArticle.find({ tenantId }).sort({ category: 1, createdAt: -1 });
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get published articles for tenant (public endpoint for portal)
router.get('/:tenantId/knowledge-base/published', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const articles = await KBArticle.find({ tenantId, published: true }).sort({ category: 1, createdAt: -1 });
    res.json(articles);
  } catch (error) {
    console.error('Error fetching published articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get single article
router.get('/:tenantId/knowledge-base/:articleId', async (req, res) => {
  try {
    const { tenantId, articleId } = req.params;
    const article = await KBArticle.findOne({ _id: articleId, tenantId });
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json(article);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// Create article
router.post('/:tenantId/knowledge-base', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const article = new KBArticle({ ...req.body, tenantId });
    await article.save();
    res.status(201).json(article);
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// Update article
router.put('/:tenantId/knowledge-base/:articleId', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId, articleId } = req.params;
    const article = await KBArticle.findOneAndUpdate(
      { _id: articleId, tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json(article);
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// Delete article
router.delete('/:tenantId/knowledge-base/:articleId', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId, articleId } = req.params;
    const article = await KBArticle.findOneAndDelete({ _id: articleId, tenantId });
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// ============ CHAT SETTINGS ============

// Get chat settings for tenant
router.get('/:tenantId/chat-settings', async (req, res) => {
  try {
    const { tenantId } = req.params;
    let settings = await ChatSettings.findOne({ tenantId });
    
    if (!settings) {
      // Return defaults
      settings = {
        enabled: false,
        welcomeMessage: 'Hello! How can we help you today?',
        offlineMessage: 'We are currently offline. Please leave a message.',
        operatingHours: {
          enabled: false,
          start: '09:00',
          end: '17:00',
          timezone: 'America/New_York'
        },
        autoResponses: {
          greeting: 'Thanks for reaching out! A support agent will be with you shortly.',
          away: 'All agents are currently busy. Please wait.',
          closed: 'We are currently closed.'
        }
      };
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching chat settings:', error);
    res.status(500).json({ error: 'Failed to fetch chat settings' });
  }
});

// Update chat settings
router.put('/:tenantId/chat-settings', requireAuth, requireAdminMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const settings = await ChatSettings.findOneAndUpdate(
      { tenantId },
      { ...req.body, tenantId, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating chat settings:', error);
    res.status(500).json({ error: 'Failed to update chat settings' });
  }
});

module.exports = router;

