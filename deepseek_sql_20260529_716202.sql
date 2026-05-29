-- USUÁRIO BASE (polimórfico)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash TEXT NOT NULL,
    user_type VARCHAR(20) CHECK (user_type IN ('client', 'partner', 'admin')),
    document VARCHAR(20), -- CPF/CNPJ
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- CLIENTES (detalhes adicionais)
CREATE TABLE clients (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    loyalty_points INT DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0
);

-- VEÍCULOS DO CLIENTE
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(user_id) ON DELETE CASCADE,
    plate VARCHAR(10) NOT NULL,
    model VARCHAR(50),
    color VARCHAR(30),
    is_default BOOLEAN DEFAULT false
);

-- PARCEIROS (lava-jatos)
CREATE TABLE partners (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(100) NOT NULL,
    address TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    commission_rate DECIMAL(5,2) DEFAULT 10.00, -- % repassada ao admin
    is_active BOOLEAN DEFAULT true,
    opening_time TIME,
    closing_time TIME,
    max_daily_bookings INT DEFAULT 30
);

-- SERVIÇOS OFERECIDOS
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(user_id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- "Lavagem simples", "Polimento"
    description TEXT,
    duration_minutes INT NOT NULL, -- tempo estimado
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- AGENDAMENTOS
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(user_id),
    vehicle_id UUID REFERENCES vehicles(id),
    service_id UUID REFERENCES services(id),
    scheduled_time TIMESTAMP NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    total_amount DECIMAL(10,2),
    payment_method VARCHAR(20),
    payment_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- TRANSAÇÕES FINANCEIRAS
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id),
    amount DECIMAL(10,2) NOT NULL,
    partner_amount DECIMAL(10,2), -- valor líquido do parceiro
    admin_commission DECIMAL(10,2), -- taxa da plataforma
    payment_id VARCHAR(100), -- ID do gateway (Stripe/Asaas)
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- AVALIAÇÕES
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id),
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);