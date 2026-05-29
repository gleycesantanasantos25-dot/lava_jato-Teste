const pool = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Registrar novo usuário
const register = async (req, res) => {
  const { full_name, email, phone, password, user_type, document, business_name } = req.body;

  // Validações básicas
  if (!['client', 'partner', 'admin'].includes(user_type)) {
    return res.status(400).json({ error: 'Tipo de usuário inválido.' });
  }

  try {
    // Verificar se email já existe
    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Iniciar transação
    await pool.query('BEGIN');

    // Inserir na tabela users
    const newUser = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, user_type, document) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, full_name, email, user_type`,
      [full_name, email, phone, hashedPassword, user_type, document]
    );

    const userId = newUser.rows[0].id;

    // Inserir na tabela específica conforme o tipo
    if (user_type === 'client') {
      await pool.query('INSERT INTO clients (user_id) VALUES ($1)', [userId]);
    } else if (user_type === 'partner') {
      if (!business_name) {
        throw new Error('Parceiro precisa informar o nome do negócio.');
      }
      await pool.query(
        `INSERT INTO partners (user_id, business_name, is_active) 
         VALUES ($1, $2, false)`,
        [userId, business_name]
      );
    } else if (user_type === 'admin') {
      // Admin não precisa de tabela adicional
    }

    await pool.query('COMMIT');

    // Gerar token JWT
    const token = jwt.sign(
      { 
        id: userId, 
        email: newUser.rows[0].email, 
        user_type: newUser.rows[0].user_type,
        full_name: newUser.rows[0].full_name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      user: newUser.rows[0],
      token
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.', details: error.message });
  }
};

// Login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Buscar usuário
    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, user_type 
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    const user = result.rows[0];

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    // Verificar se parceiro está ativo (se for partner)
    if (user.user_type === 'partner') {
      const partnerStatus = await pool.query(
        'SELECT is_active FROM partners WHERE user_id = $1',
        [user.id]
      );
      if (partnerStatus.rows[0] && !partnerStatus.rows[0].is_active) {
        return res.status(403).json({ error: 'Sua conta de parceiro aguarda aprovação do administrador.' });
      }
    }

    // Gerar novo token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        user_type: user.user_type,
        full_name: user.full_name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        user_type: user.user_type
      },
      token
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
};

// Obter perfil do usuário logado
const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, user_type, document, created_at 
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const profile = result.rows[0];

    // Buscar dados específicos do tipo
    if (profile.user_type === 'client') {
      const clientData = await pool.query(
        'SELECT loyalty_points, total_spent FROM clients WHERE user_id = $1',
        [req.user.id]
      );
      profile.client_data = clientData.rows[0];
    } else if (profile.user_type === 'partner') {
      const partnerData = await pool.query(
        `SELECT business_name, is_active, commission_rate, address, latitude, longitude 
         FROM partners WHERE user_id = $1`,
        [req.user.id]
      );
      profile.partner_data = partnerData.rows[0];
    }

    res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
};

module.exports = { register, login, getProfile };