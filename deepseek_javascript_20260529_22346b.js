const express = require('express');
const { register, login, getProfile } = require('../controllers/authController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { body } = require('express-validator');

const router = express.Router();

// Rotas públicas
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('full_name').notEmpty(),
    body('user_type').isIn(['client', 'partner', 'admin'])
  ],
  register
);

router.post('/login', login);

// Rotas protegidas (qualquer usuário logado)
router.get('/profile', authenticateToken, getProfile);

// Exemplo de rota apenas para admin
router.get('/admin-only', authenticateToken, roleCheck('admin'), (req, res) => {
  res.json({ message: 'Bem-vindo, administrador!' });
});

// Exemplo de rota para parceiro e admin
router.get('/partner-dashboard', authenticateToken, roleCheck('partner', 'admin'), (req, res) => {
  res.json({ message: `Bem-vindo, ${req.user.user_type}!` });
});

module.exports = router;