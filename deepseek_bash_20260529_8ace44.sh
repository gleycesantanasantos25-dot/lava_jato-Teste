# Registrar um parceiro
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "João Silva",
    "email": "joao@lavajato.com",
    "phone": "11999999999",
    "password": "123456",
    "user_type": "partner",
    "document": "12345678901",
    "business_name": "Lava Jato do João"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@lavajato.com","password":"123456"}'