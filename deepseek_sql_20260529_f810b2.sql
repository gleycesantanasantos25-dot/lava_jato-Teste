-- Relatório diário/semanal do parceiro
SELECT 
  DATE(b.scheduled_time) as date,
  COUNT(b.id) as total_services,
  SUM(t.amount) as gross_revenue,
  SUM(t.admin_commission) as total_commission,
  SUM(t.partner_amount) as net_revenue
FROM bookings b
JOIN transactions t ON b.id = t.booking_id
WHERE b.partner_id = $1
  AND b.scheduled_time BETWEEN $2 AND $3
  AND b.status = 'completed'
GROUP BY DATE(b.scheduled_time)
ORDER BY date DESC;