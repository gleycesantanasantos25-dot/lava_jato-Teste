const pool = require('../config/database');

// Dashboard principal
const getDashboardStats = async (req, res) => {
  try {
    // Estatísticas gerais
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE user_type = 'client') as total_clients,
        (SELECT COUNT(*) FROM users WHERE user_type = 'partner') as total_partners,
        (SELECT COUNT(*) FROM bookings) as total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'completed') as completed_bookings,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'settled') as total_revenue,
        (SELECT COALESCE(SUM(admin_commission), 0) FROM transactions WHERE status = 'settled') as total_commission
    `);
    
    // Faturamento dos últimos 30 dias
    const revenueLast30Days = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(amount) as revenue,
        SUM(admin_commission) as commission
      FROM transactions
      WHERE status = 'settled' 
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    // Top 5 parceiros por faturamento
    const topPartners = await pool.query(`
      SELECT 
        u.full_name,
        p.business_name,
        COUNT(b.id) as total_services,
        COALESCE(SUM(t.amount), 0) as revenue
      FROM partners p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN services s ON p.user_id = s.partner_id
      LEFT JOIN bookings b ON s.id = b.service_id AND b.status = 'completed'
      LEFT JOIN transactions t ON b.id = t.booking_id
      GROUP BY u.id, p.business_name
      ORDER BY revenue DESC
      LIMIT 5
    `);
    
    // Agendamentos por status
    const bookingsByStatus = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM bookings
      GROUP BY status
    `);
    
    res.json({
      stats: stats.rows[0],
      revenue_last_30_days: revenueLast30Days.rows,
      top_partners: topPartners.rows,
      bookings_by_status: bookingsByStatus.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar estatísticas.' });
  }
};

// Listar todos os parceiros com filtros
const getPartners = async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    let query = `
      SELECT 
        u.id, u.full_name, u.email, u.phone, u.document, u.created_at,
        p.business_name, p.is_active, p.commission_rate,
        COUNT(DISTINCT b.id) as total_bookings,
        COALESCE(SUM(t.amount), 0) as total_revenue
      FROM users u
      JOIN partners p ON u.id = p.user_id
      LEFT JOIN services s ON p.user_id = s.partner_id
      LEFT JOIN bookings b ON s.id = b.service_id
      LEFT JOIN transactions t ON b.id = t.booking_id
      WHERE u.user_type = 'partner'
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status === 'active') {
      query += ` AND p.is_active = true`;
    } else if (status === 'inactive') {
      query += ` AND p.is_active = false`;
    }
    
    if (search) {
      query += ` AND (u.full_name ILIKE $${paramIndex} OR p.business_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` GROUP BY u.id, p.business_name, p.is_active, p.commission_rate ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Total de registros para paginação
    const countResult = await pool.query(`
      SELECT COUNT(*) as total 
      FROM users u 
      JOIN partners p ON u.id = p.user_id 
      WHERE u.user_type = 'partner'
    `);
    
    res.json({
      partners: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar parceiros.' });
  }
};

// Aprovar/reprovar parceiro
const updatePartnerStatus = async (req, res) => {
  const { partnerId } = req.params;
  const { is_active, commission_rate } = req.body;
  
  try {
    await pool.query(
      `UPDATE partners 
       SET is_active = $1, 
           commission_rate = COALESCE($2, commission_rate),
           updated_at = NOW()
       WHERE user_id = $3`,
      [is_active, commission_rate, partnerId]
    );
    
    // Buscar dados do parceiro para notificação
    const partner = await pool.query(
      `SELECT u.email, u.full_name, p.business_name 
       FROM users u 
       JOIN partners p ON u.id = p.user_id 
       WHERE u.id = $1`,
      [partnerId]
    );
    
    // Aqui você pode enviar email/SMS/whatsapp notificando o parceiro
    
    res.json({ 
      message: is_active ? 'Parceiro aprovado com sucesso!' : 'Parceiro desativado.',
      partner: partner.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar status do parceiro.' });
  }
};

// Configurações globais da plataforma
const updateGlobalSettings = async (req, res) => {
  const { default_commission, min_booking_advance_hours, max_cancellation_hours } = req.body;
  
  try {
    // Criar tabela de configurações se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS global_settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Atualizar configurações
    const settings = { default_commission, min_booking_advance_hours, max_cancellation_hours };
    
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        await pool.query(
          `INSERT INTO global_settings (key, value, updated_at) 
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) 
           DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, value.toString()]
        );
      }
    }
    
    res.json({ message: 'Configurações atualizadas com sucesso!', settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar configurações.' });
  }
};

// Relatório financeiro completo
const getFinancialReport = async (req, res) => {
  const { start_date, end_date, partner_id } = req.query;
  
  try {
    let query = `
      SELECT 
        DATE(t.created_at) as date,
        COUNT(DISTINCT b.id) as total_services,
        SUM(t.amount) as gross_revenue,
        SUM(t.admin_commission) as platform_commission,
        SUM(t.partner_amount) as partner_payout,
        COUNT(DISTINCT CASE WHEN b.payment_method = 'pix' THEN b.id END) as pix_payments,
        COUNT(DISTINCT CASE WHEN b.payment_method = 'credit_card' THEN b.id END) as card_payments
      FROM transactions t
      JOIN bookings b ON t.booking_id = b.id
      JOIN services s ON b.service_id = s.id
      WHERE t.status = 'settled'
        AND b.status = 'completed'
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (start_date) {
      query += ` AND t.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND t.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    if (partner_id) {
      query += ` AND s.partner_id = $${paramIndex}`;
      params.push(partner_id);
      paramIndex++;
    }
    
    query += ` GROUP BY DATE(t.created_at) ORDER BY date DESC`;
    
    const result = await pool.query(query, params);
    
    // Totais gerais
    const totals = await pool.query(`
      SELECT 
        COALESCE(SUM(t.amount), 0) as total_gross,
        COALESCE(SUM(t.admin_commission), 0) as total_commission,
        COALESCE(SUM(t.partner_amount), 0) as total_payout
      FROM transactions t
      JOIN bookings b ON t.booking_id = b.id
      WHERE t.status = 'settled' AND b.status = 'completed'
    `);
    
    res.json({
      daily_report: result.rows,
      totals: totals.rows[0],
      filters: { start_date, end_date, partner_id }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar relatório financeiro.' });
  }
};

module.exports = {
  getDashboardStats,
  getPartners,
  updatePartnerStatus,
  updateGlobalSettings,
  getFinancialReport
};