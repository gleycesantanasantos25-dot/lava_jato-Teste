// Quando cliente agenda um serviço
async function createBooking(clientId, serviceId, scheduledTime) {
  // 1. Buscar serviço e parceiro
  const service = await db.query(
    `SELECT s.*, p.commission_rate, p.user_id as partner_id 
     FROM services s 
     JOIN partners p ON s.partner_id = p.user_id 
     WHERE s.id = $1`, [serviceId]
  );
  
  // 2. Calcular valores
  const totalAmount = service.price;
  const adminCommission = (totalAmount * service.commission_rate) / 100;
  const partnerAmount = totalAmount - adminCommission;
  
  // 3. Criar agendamento (status pending payment)
  const booking = await db.query(
    `INSERT INTO bookings (client_id, service_id, scheduled_time, total_amount, status) 
     VALUES ($1, $2, $3, $4, 'pending_payment') 
     RETURNING *`,
    [clientId, serviceId, scheduledTime, totalAmount]
  );
  
  // 4. Gerar link de pagamento (Asaas)
  const paymentLink = await asaas.createPayment({
    customer: clientId,
    amount: totalAmount,
    dueDate: scheduledTime,
    callbackUrl: `https://api.suaapp.com/webhook/asaas`
  });
  
  return { booking, paymentLink };
}

// Webhook de pagamento aprovado
app.post('/webhook/asaas', async (req, res) => {
  const { payment_id, status } = req.body;
  
  if (status === 'CONFIRMED') {
    // 1. Atualizar booking para 'confirmed'
    await db.query(`UPDATE bookings SET payment_status = 'paid', status = 'confirmed' WHERE payment_id = $1`, [payment_id]);
    
    // 2. Registrar transação com split
    await db.query(
      `INSERT INTO transactions (booking_id, amount, partner_amount, admin_commission, payment_id, status)
       VALUES ($1, $2, $3, $4, $5, 'settled')`,
      [bookingId, totalAmount, partnerAmount, adminCommission, payment_id]
    );
    
    // 3. Notificar parceiro (push + email)
    await notifyPartner(partnerId, `Novo agendamento confirmado para ${scheduledTime}`);
    
    // 4. Adicionar pontos ao cliente (1 ponto a cada R$10)
    const points = Math.floor(totalAmount / 10);
    await db.query(`UPDATE clients SET loyalty_points = loyalty_points + $1 WHERE user_id = $2`, [points, clientId]);
  }
  
  res.sendStatus(200);
});