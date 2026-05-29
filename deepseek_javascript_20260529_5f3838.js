const pool = require('../config/database');
const axios = require('axios');

// Integração com Asaas (Gateway de pagamento)
const asaasApiKey = process.env.ASAAS_API_KEY;
const asaasBaseUrl = 'https://sandbox.asaas.com/api/v3';

// Listar lava-jatos próximos
const getNearbyWashStations = async (req, res) => {
  const { lat, lng, radius = 10 } = req.query;
  
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.full_name, u.phone,
        p.business_name, p.address, p.latitude, p.longitude, p.is_active,
        (6371 * acos(cos(radians($1)) * cos(radians(p.latitude)) * 
         cos(radians(p.longitude) - radians($2)) + sin(radians($1)) * 
         sin(radians(p.latitude)))) AS distance
      FROM partners p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_active = true
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
      HAVING distance < $3
      ORDER BY distance
      LIMIT 20
    `, [lat, lng, radius]);
    
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar lava-jatos próximos.' });
  }
};

// Listar serviços de um lava-jato
const getPartnerServices = async (req, res) => {
  const { partnerId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT id, name, description, duration_minutes, price, is_active
      FROM services
      WHERE partner_id = $1 AND is_active = true
      ORDER BY price ASC
    `, [partnerId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar serviços.' });
  }
};

// Criar agendamento e gerar pagamento
const createBooking = async (req, res) => {
  const clientId = req.user.id;
  const { service_id, vehicle_id, scheduled_time, payment_method } = req.body;
  
  try {
    await pool.query('BEGIN');
    
    // Buscar serviço e parceiro
    const serviceResult = await pool.query(`
      SELECT s.*, p.commission_rate, p.user_id as partner_id
      FROM services s
      JOIN partners p ON s.partner_id = p.user_id
      WHERE s.id = $1 AND s.is_active = true
    `, [service_id]);
    
    if (serviceResult.rows.length === 0) {
      throw new Error('Serviço não encontrado ou indisponível.');
    }
    
    const service = serviceResult.rows[0];
    const totalAmount = parseFloat(service.price);
    const adminCommission = (totalAmount * service.commission_rate) / 100;
    const partnerAmount = totalAmount - adminCommission;
    
    // Verificar disponibilidade de horário
    const existingBooking = await pool.query(`
      SELECT id FROM bookings b
      JOIN services s ON b.service_id = s.id
      WHERE s.partner_id = $1 
        AND b.scheduled_time BETWEEN $2::timestamp - INTERVAL '1 hour' 
                                 AND $2::timestamp + INTERVAL '1 hour'
        AND b.status NOT IN ('cancelled', 'completed')
    `, [service.partner_id, scheduled_time]);
    
    if (existingBooking.rows.length > 0) {
      throw new Error('Horário indisponível. Escolha outro horário.');
    }
    
    // Criar agendamento
    const bookingResult = await pool.query(`
      INSERT INTO bookings (client_id, vehicle_id, service_id, scheduled_time, total_amount, payment_method, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending_payment')
      RETURNING *
    `, [clientId, vehicle_id, service_id, scheduled_time, totalAmount, payment_method]);
    
    const booking = bookingResult.rows[0];
    
    // Gerar pagamento no Asaas
    const paymentData = {
      customer: req.user.email,
      billingType: payment_method === 'pix' ? 'PIX' : 'CREDIT_CARD',
      value: totalAmount,
      dueDate: new Date(scheduled_time).toISOString().split('T')[0],
      description: `Lavagem - ${service.name}`,
      externalReference: booking.id,
      postalService: false
    };
    
    const asaasResponse = await axios.post(`${asaasBaseUrl}/payments`, paymentData, {
      headers: { access_token: asaasApiKey }
    });
    
    // Salvar referência do pagamento
    await pool.query(`
      UPDATE bookings 
      SET payment_id = $1 
      WHERE id = $2
    `, [asaasResponse.data.id, booking.id]);
    
    await pool.query('COMMIT');
    
    res.json({
      booking,
      payment: {
        id: asaasResponse.data.id,
        status: asaasResponse.data.status,
        pixQrCode: asaasResponse.data.pixQrCode,
        paymentLink: asaasResponse.data.paymentLink
      }
    });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: error.message || 'Erro ao criar agendamento.' });
  }
};

// Webhook para receber confirmação de pagamento
const paymentWebhook = async (req, res) => {
  const { event, payment } = req.body;
  
  if (event === 'PAYMENT_CONFIRMED') {
    try {
      await pool.query('BEGIN');
      
      // Atualizar agendamento
      await pool.query(`
        UPDATE bookings 
        SET status = 'confirmed', payment_status = 'paid'
        WHERE payment_id = $1
      `, [payment.id]);
      
      // Buscar booking_id para registrar transação
      const bookingResult = await pool.query(`
        SELECT b.*, s.price, s.partner_id, p.commission_rate
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        JOIN partners p ON s.partner_id = p.user_id
        WHERE b.payment_id = $1
      `, [payment.id]);
      
      const booking = bookingResult.rows[0];
      const adminCommission = (parseFloat(booking.price) * booking.commission_rate) / 100;
      const partnerAmount = parseFloat(booking.price) - adminCommission;
      
      // Registrar transação
      await pool.query(`
        INSERT INTO transactions (booking_id, amount, partner_amount, admin_commission, payment_id, status)
        VALUES ($1, $2, $3, $4, $5, 'settled')
      `, [booking.id, booking.price, partnerAmount, adminCommission, payment.id]);
      
      // Adicionar pontos de fidelidade (1 ponto a cada R$10)
      const loyaltyPoints = Math.floor(parseFloat(booking.price) / 10);
      await pool.query(`
        UPDATE clients 
        SET loyalty_points = loyalty_points + $1,
            total_spent = total_spent + $2
        WHERE user_id = $3
      `, [loyaltyPoints, booking.price, booking.client_id]);
      
      await pool.query('COMMIT');
      
      // Notificar parceiro (implementar com WebSocket ou Firebase)
      // io.to(`partner_${booking.partner_id}`).emit('new_booking', booking);
      
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error(error);
    }
  }
  
  res.sendStatus(200);
};

// Histórico do cliente
const getClientHistory = async (req, res) => {
  const clientId = req.user.id;
  
  try {
    const result = await pool.query(`
      SELECT 
        b.id, b.scheduled_time, b.total_amount, b.status, b.payment_method,
        s.name as service_name,
        v.model as vehicle_model, v.plate as vehicle_plate,
        u.full_name as partner_name,
        p.business_name
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      JOIN partners pr ON s.partner_id = pr.user_id
      JOIN users u ON pr.user_id = u.id
      JOIN vehicles v ON b.vehicle_id = v.id
      WHERE b.client_id = $1
      ORDER BY b.scheduled_time DESC
      LIMIT 50
    `, [clientId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
};

module.exports = {
  getNearbyWashStations,
  getPartnerServices,
  createBooking,
  paymentWebhook,
  getClientHistory
};