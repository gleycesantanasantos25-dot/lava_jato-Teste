import React, { useState, useEffect } from 'react';
import { 
  Users, Briefcase, CreditCard, TrendingUp, 
  CheckCircle, XCircle, Clock, DollarSign,
  Download, Search, Filter, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    total_clients: 0,
    total_partners: 0,
    total_bookings: 0,
    total_revenue: 0,
    total_commission: 0
  });
  const [partners, setPartners] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [partnerFilter, setPartnerFilter] = useState('');
  const [partnerPage, setPartnerPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [settings, setSettings] = useState({
    default_commission: 10,
    min_booking_advance_hours: 2,
    max_cancellation_hours: 1
  });

  useEffect(() => {
    fetchDashboardData();
    fetchPartners();
  }, [partnerPage, partnerFilter]);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/admin/dashboard/stats');
      setStats(response.data.stats);
      setRevenueData(response.data.revenue_last_30_days);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async () => {
    try {
      const response = await api.get('/admin/partners', {
        params: { page: partnerPage, search: partnerFilter }
      });
      setPartners(response.data.partners);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Erro ao carregar parceiros:', error);
    }
  };

  const updatePartnerStatus = async (partnerId, isActive) => {
    if (window.confirm(`Tem certeza que deseja ${isActive ? 'ativar' : 'desativar'} este parceiro?`)) {
      try {
        await api.patch(`/admin/partners/${partnerId}/status`, { is_active: isActive });
        fetchPartners();
        alert(`Parceiro ${isActive ? 'ativado' : 'desativado'} com sucesso!`);
      } catch (error) {
        alert('Erro ao atualizar status do parceiro.');
      }
    }
  };

  const updateCommissionRate = async (partnerId, commissionRate) => {
    try {
      await api.patch(`/admin/partners/${partnerId}/status`, { commission_rate: commissionRate });
      fetchPartners();
      alert('Taxa de comissão atualizada!');
    } catch (error) {
      alert('Erro ao atualizar comissão.');
    }
  };

  const updateGlobalSettings = async () => {
    try {
      await api.put('/admin/settings', settings);
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      alert('Erro ao salvar configurações.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Carregando dashboard administrativo...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
          <p className="text-blue-100 mt-2">Gerencie toda a plataforma Lava Jato</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'dashboard', name: 'Dashboard', icon: TrendingUp },
              { id: 'partners', name: 'Parceiros', icon: Briefcase },
              { id: 'settings', name: 'Configurações', icon: Filter },
              { id: 'reports', name: 'Relatórios', icon: Download }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center px-1 py-4 border-b-2 font-medium text-sm
                  ${activeTab === tab.id 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <>
            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Clientes</p>
                    <p className="text-2xl font-bold">{stats.total_clients}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Parceiros</p>
                    <p className="text-2xl font-bold">{stats.total_partners}</p>
                  </div>
                  <Briefcase className="h-8 w-8 text-green-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Serviços Realizados</p>
                    <p className="text-2xl font-bold">{stats.total_bookings}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-purple-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Faturamento Total</p>
                    <p className="text-2xl font-bold">
                      R$ {parseFloat(stats.total_revenue).toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-yellow-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Comissão Plataforma</p>
                    <p className="text-2xl font-bold">
                      R$ {parseFloat(stats.total_commission).toFixed(2)}
                    </p>
                  </div>
                  <CreditCard className="h-8 w-8 text-red-500" />
                </div>
              </div>
            </div>
            
            {/* Gráfico de faturamento */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Faturamento Últimos 30 Dias</h2>
              <div className="space-y-2">
                {revenueData.map((day) => (
                  <div key={day.date} className="flex items-center">
                    <div className="w-32 text-sm text-gray-600">
                      {format(new Date(day.date), "dd/MM", { locale: ptBR })}
                    </div>
                    <div className="flex-1 ml-4">
                      <div className="relative">
                        <div 
                          className="bg-blue-500 h-8 rounded flex items-center px-2 text-white text-sm"
                          style={{ width: `${(day.revenue / Math.max(...revenueData.map(d => d.revenue))) * 100}%` }}
                        >
                          R$ {parseFloat(day.revenue).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'partners' && (
          <div className="bg-white rounded-lg shadow">
            {/* Filtros */}
            <div className="p-4 border-b">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, empresa ou email..."
                    className="pl-10 pr-4 py-2 border rounded-lg w-full"
                    value={partnerFilter}
                    onChange={(e) => setPartnerFilter(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => fetchPartners()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Buscar
                </button>
              </div>
            </div>
            
            {/* Tabela de parceiros */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parceiro</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comissão</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serviços</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faturamento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {partners.map((partner) => (
                    <tr key={partner.id}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{partner.full_name}</div>
                        <div className="text-sm text-gray-500">{partner.email}</div>
                      </td>
                      <td className="px-6 py-4">{partner.business_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          partner.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {partner.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={partner.commission_rate}
                          onChange={(e) => updateCommissionRate(partner.id, e.target.value)}
                          className="w-20 px-2 py-1 border rounded text-center"
                          step="0.5"
                          min="0"
                          max="100"
                        />
                        <span className="ml-1">%</span>
                      </td>
                      <td className="px-6 py-4">{partner.total_bookings}</td>
                      <td className="px-6 py-4">R$ {parseFloat(partner.total_revenue).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => updatePartnerStatus(partner.id, !partner.is_active)}
                          className={`px-3 py-1 rounded text-sm ${
                            partner.is_active 
                              ? 'bg-red-600 text-white hover:bg-red-700' 
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {partner.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Paginação */}
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Mostrando {pagination.page * pagination.limit - pagination.limit + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} parceiros
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPartnerPage(p => Math.max(1, p - 1))}
                  disabled={partnerPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPartnerPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={partnerPage === pagination.pages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
            <h2 className="text-xl font-semibold mb-6">Configurações da Plataforma</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comissão Padrão (%)
                </label>
                <input
                  type="number"
                  value={settings.default_commission}
                  onChange={(e) => setSettings({...settings, default_commission: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg"
                  step="0.5"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-gray-500 mt-1">Taxa cobrada por serviço para novos parceiros</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Antecedência Mínima para Agendamento (horas)
                </label>
                <input
                  type="number"
                  value={settings.min_booking_advance_hours}
                  onChange={(e) => setSettings({...settings, min_booking_advance_hours: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="0"
                  max="48"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prazo Máximo para Cancelamento (horas antes)
                </label>
                <input
                  type="number"
                  value={settings.max_cancellation_hours}
                  onChange={(e) => setSettings({...settings, max_cancellation_hours: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="0"
                  max="24"
                />
              </div>
              
              <button
                onClick={updateGlobalSettings}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;