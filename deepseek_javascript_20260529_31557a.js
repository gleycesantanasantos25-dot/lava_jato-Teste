// src/routes/partnerRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const pool = require('../config/database');

// Dashboard do parceiro
router.get('/dashboard', authenticateToken, roleCheck('partner'), async (req, res) => {
  try {
    const partnerId = req.user.id;
    const { filter = 'today' } = req.query;
    
    let dateFilter = '';
    if (filter === 'today') {
      dateFilter = "DATE(scheduled_time) = CURRENT_DATE";
    } else if (filter === 'week') {
      dateFilter = "scheduled_time >= CURRENT_DATE - INTERVAL '7 days'";
    } else {
      dateFilter = "1=1";
    }
    
    // Buscar agendamentos
    const bookingsResult = await pool.query(
      `SELECT b.*, 
              c.full_name as client_name,
              v.model as vehicle_model,
              v.plate as vehicle_plate,
              s.name as service_name
       FROM bookings b
       JOIN clients ON b.client_id = clients.user_id
       JOIN users c ON clients.user_id = c.id
       JOIN vehicles v ON b.vehicle_id = v.id
       JOIN services s ON b.service_id = s.id
       WHERE s.partner_id = $1 AND ${dateFilter}
       ORDER BY b.scheduled_time ASC`,
      [partnerId]
    );
    
    // Resumo financeiro
    const summaryResult = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN DATE(scheduled_time) = CURRENT_DATE THEN total_amount ELSE 0 END), 0) as today_revenue,
        COUNT(*) as total_bookings,
        COALESCE(SUM(CASE WHEN status = 'completed' AND DATE(scheduled_time) = CURRENT_DATE THEN 1 ELSE 0 END), 0) as completed_today,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_bookings
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE s.partner_id = $1 AND ${dateFilter}`,
      [partnerId]
    );
    
    res.json({
      bookings: bookingsResult.rows,
      summary: {
        todayRevenue: parseFloat(summaryResult.rows[0].today_revenue),
        totalBookings: parseInt(summaryResult.rows[0].total_bookings),
        completedToday: parseInt(summaryResult.rows[0].completed_today),
        pendingBookings: parseInt(summaryResult.rows[0].pending_bookings)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar dashboard.' });
  }
});

// Atualizar status do agendamento
router.patch('/bookings/:bookingId/status', authenticateToken, roleCheck('partner'), async (req, res) => {
  const { bookingId } = req.params;
  const { status } = req.body;
  const partnerId = req.user.id;
  
  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }
  
  try {
    // Verificar se o agendamento pertence ao parceiro
    const bookingCheck = await pool.query(
      `SELECT b.id FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.id = $1 AND s.partner_id = $2`,
      [bookingId, partnerId]
    );
    
    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }
    
    await pool.query(
      `UPDATE bookings 
       SET status = $1, 
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $2`,
      [status, bookingId]
    );
    
    res.json({ message: 'Status atualizado com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

module.exports = router;