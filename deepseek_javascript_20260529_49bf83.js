const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const adminController = require('../controllers/adminController');

// Todas as rotas de admin exigem autenticação e role 'admin'
router.use(authenticateToken, roleCheck('admin'));

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/partners', adminController.getPartners);
router.patch('/partners/:partnerId/status', adminController.updatePartnerStatus);
router.put('/settings', adminController.updateGlobalSettings);
router.get('/reports/financial', adminController.getFinancialReport);

module.exports = router;