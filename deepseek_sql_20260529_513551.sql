CREATE INDEX idx_bookings_partner_time ON bookings(scheduled_time, partner_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_partners_location ON partners(latitude, longitude);
CREATE INDEX idx_bookings_client_status ON bookings(client_id, status);