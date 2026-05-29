import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, DollarSign, Star, Clock, CreditCard, QrCode } from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ClientApp = () => {
  const [step, setStep] = useState('stations'); // stations, services, payment
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    // Obter localização do usuário
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        fetchNearbyStations(position.coords.latitude, position.coords.longitude);
      });
    }
    
    fetchVehicles();
  }, []);

  const fetchNearbyStations = async (lat, lng) => {
    try {
      const response = await api.get('/client/wash-stations/nearby', {
        params: { lat, lng, radius: 10 }
      });
      setStations(response.data);
    } catch (error) {
      console.error('Erro ao buscar lava-jatos:', error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await api.get('/client/vehicles');
      setVehicles(response.data);
    } catch (error) {
      console.error('Erro ao buscar veículos:', error);
    }
  };

  const fetchServices = async (partnerId) => {
    setLoading(true);
    try {
      const response = await api.get(`/client/partners/${partnerId}/services`);
      setServices(response.data);
      setStep('services');
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectService = (service) => {
    setSelectedService(service);
  };

  const handleSchedule = () => {
    if (!selectedService || !selectedVehicle || !scheduledDate || !scheduledTime) {
      alert('Preencha todos os campos!');
      return;
    }
    setStep('payment');
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      const scheduledDateTime = `${scheduledDate}T${scheduledTime}:00`;
      const response = await api.post('/client/bookings', {
        service_id: selectedService.id,
        vehicle_id: selectedVehicle.id,
        scheduled_time: scheduledDateTime,
        payment_method: paymentMethod
      });
      
      setPaymentData(response.data.payment);
      alert('Agendamento criado! Aguardando confirmação do pagamento.');
      setStep('confirmed');
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao criar agendamento');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'stations') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <h1 className="text-2xl font-bold">Lava Jato Express</h1>
          <p className="text-blue-100 mt-1">Encontre lava-jatos próximos a você</p>
        </div>
        
        <div className="max-w-lg mx-auto p-4 space-y-4">
          {stations.map((station) => (
            <div key={station.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{station.business_name}</h3>
                  <div className="flex items-center text-sm text-gray-500 mt-1">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{station.address || 'Endereço não informado'}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 mt-1">
                    <Star className="h-4 w-4 mr-1 text-yellow-500" />
                    <span>{station.distance?.toFixed(1) || '?'} km de distância</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedStation(station);
                    fetchServices(station.id);
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Ver Serviços
                </button>
              </div>
            </div>
          ))}
          
          {stations.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              Nenhum lava-jato encontrado nas proximidades
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'services') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b p-4 flex items-center">
          <button onClick={() => setStep('stations')} className="text-blue-600 mr-4">
            ← Voltar
          </button>
          <h2 className="text-xl font-semibold">{selectedStation?.business_name}</h2>
        </div>
        
        <div className="max-w-lg mx-auto p-4 space-y-4">
          {services.map((service) => (
            <div
              key={service.id}
              className={`bg-white rounded-lg shadow p-4 cursor-pointer transition ${
                selectedService?.id === service.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleSelectService(service)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{service.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                  <div className="flex items-center text-sm text-gray-500 mt-2">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{service.duration_minutes} minutos</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    R$ {service.price.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {selectedService && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
            <div className="max-w-lg mx-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione o veículo
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={selectedVehicle?.id || ''}
                  onChange={(e) => {
                    const vehicle = vehicles.find(v => v.id === parseInt(e.target.value));
                    setSelectedVehicle(vehicle);
                  }}
                >
                  <option value="">Selecione um veículo</option>
                  {vehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.model} - {vehicle.plate}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Horário
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
              
              <button
                onClick={handleSchedule}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
              >
                Continuar para Pagamento
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto p-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Pagamento</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Método de Pagamento
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setPaymentMethod('pix')}
                  className={`w-full p-3 border rounded-lg flex items-center justify-between ${
                    paymentMethod === 'pix' ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <QrCode className="h-5 w-5 mr-2" />
                    <span>PIX</span>
                  </div>
                  {paymentMethod === 'pix' && <div className="text-blue-600">✓</div>}
                </button>
                
                <button
                  onClick={() => setPaymentMethod('credit_card')}
                  className={`w-full p-3 border rounded-lg flex items-center justify-between ${
                    paymentMethod === 'credit_card' ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2" />
                    <span>Cartão de Crédito</span>
                  </div>
                  {paymentMethod === 'credit_card' && <div className="text-blue-600">✓</div>}
                </button>
              </div>
            </div>
            
            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>R$ {selectedService?.price.toFixed(2)}</span>
              </div>
            </div>
            
            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirmed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <div className="text-green-600 text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-bold mb-2">Agendamento Confirmado!</h2>
          <p className="text-gray-600 mb-6">
            Seu serviço foi agendado com sucesso. Você receberá um lembrete por push.
          </p>
          
          {paymentData?.pixQrCode && (
            <div className="mb-6">
              <img src={paymentData.pixQrCode} alt="QR Code PIX" className="mx-auto w-48 h-48" />
              <p className="text-sm text-gray-500 mt-2">Escaneie o QR Code para pagar via PIX</p>
            </div>
          )}
          
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }
  
  return null;
};

export default ClientApp;