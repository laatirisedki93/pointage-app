import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot,
  query, 
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

// Interfaces
interface PointageRecord {
  id?: string;
  ip: string;
  codePersonnel?: string;
  nomAgent?: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
  timestamp: string;
  type: 'entree' | 'sortie' | 'pause_debut' | 'pause_fin';
  token: string;
  date: string;
}

// Composant principal
const Dashboard = () => {
  // États
  const [pointageRecords, setPointageRecords] = useState<PointageRecord[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedView, setSelectedView] = useState<string>('daily');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  
  // Hooks
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // Effet pour vérifier l'authentification et charger les données
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Récupérer les agents
    const agentsUnsubscribe = onSnapshot(
      collection(db, 'agents'),
      (snapshot) => {
        const agentsList: any[] = [];
        snapshot.forEach((doc) => {
          agentsList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setAgents(agentsList);
      },
      (error) => {
        console.error("Erreur lors de l'écoute des agents:", error);
      }
    );

    // Récupérer les pointages en temps réel
    const pointagesQuery = selectedView === 'daily'
      ? query(
          collection(db, 'pointages'),
          where('date', '==', selectedDate),
          orderBy('timestamp', 'desc')
        )
      : query(
          collection(db, 'pointages'),
          where('codePersonnel', '==', selectedAgent),
          orderBy('date', 'desc'),
          orderBy('timestamp', 'desc')
        );

    const pointagesUnsubscribe = onSnapshot(
      pointagesQuery,
      (snapshot) => {
        const records: PointageRecord[] = [];
        snapshot.forEach((doc) => {
          records.push({
            id: doc.id,
            ...doc.data() as Omit<PointageRecord, 'id'>
          });
        });
        setPointageRecords(records);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur lors de l'écoute des pointages:", error);
        setLoading(false);
      }
    );

    // Nettoyage des écouteurs
    return () => {
      agentsUnsubscribe();
      pointagesUnsubscribe();
    };
  }, [currentUser, navigate, selectedDate, selectedView, selectedAgent]);

  // Fonction pour formater la date
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString('fr-FR', options);
  };

  // Fonction pour formater l'heure
  const formatTime = (timestampString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    };
    return new Date(timestampString).toLocaleTimeString('fr-FR', options);
  };

  // Fonction pour obtenir le libellé du type de pointage
  const getPointageTypeLabel = (type: string) => {
    switch (type) {
      case 'entree': return 'Entrée';
      case 'sortie': return 'Sortie';
      case 'pause_debut': return 'Début de pause';
      case 'pause_fin': return 'Fin de pause';
      default: return type;
    }
  };

  // Fonction pour calculer les heures travaillées par jour
  const calculateHoursWorked = (records: PointageRecord[]) => {
    // Regrouper les pointages par date
    const recordsByDate: Record<string, PointageRecord[]> = {};
    
    records.forEach(record => {
      if (!recordsByDate[record.date]) {
        recordsByDate[record.date] = [];
      }
      recordsByDate[record.date].push(record);
    });
    
    // Calculer les heures travaillées pour chaque jour
    const hoursWorkedByDate: Record<string, number> = {};
    
    Object.entries(recordsByDate).forEach(([date, dateRecords]) => {
      let totalMinutes = 0;
      let entryTime: Date | null = null;
      let pauseStartTime: Date | null = null;
      
      // Trier les pointages par heure
      const sortedRecords = [...dateRecords].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      sortedRecords.forEach(record => {
        const recordTime = new Date(record.timestamp);
        
        if (record.type === 'entree') {
          entryTime = recordTime;
        } else if (record.type === 'sortie' && entryTime) {
          const minutesWorked = (recordTime.getTime() - entryTime.getTime()) / (1000 * 60);
          totalMinutes += minutesWorked;
          entryTime = null;
        } else if (record.type === 'pause_debut') {
          pauseStartTime = recordTime;
        } else if (record.type === 'pause_fin' && pauseStartTime) {
          const pauseMinutes = (recordTime.getTime() - pauseStartTime.getTime()) / (1000 * 60);
          totalMinutes -= pauseMinutes;
          pauseStartTime = null;
        }
      });
      
      hoursWorkedByDate[date] = totalMinutes / 60;
    });
    
    return hoursWorkedByDate;
  };

  // Fonction pour déconnexion
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  // Calculer les heures travaillées
  const hoursWorked = calculateHoursWorked(pointageRecords);

  // Rendu du composant
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <img 
              src="/images/Logo_Noisy_Sec.svg" 
              alt="Logo Mairie de Noisy-le-Sec" 
              className="h-16 mr-4"
            />
            <h1 className="text-2xl font-bold text-blue-800">
              Tableau de Bord des Pointages
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/admin" className="text-blue-600 hover:text-blue-800">
              Gestion des agents
            </Link>
            <Link to="/qr-admin" className="text-blue-600 hover:text-blue-800">
              Gestion des QR codes
            </Link>
            <button 
              onClick={handleLogout}
              className="text-red-600 hover:text-red-800"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* Sélection de vue */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label htmlFor="viewType" className="block text-sm font-medium text-gray-700 mb-1">
                Type de vue
              </label>
              <select
                id="viewType"
                value={selectedView}
                onChange={(e) => {
                  setSelectedView(e.target.value);
                  if (e.target.value === 'individual' && selectedAgent === 'all') {
                    setSelectedAgent(agents[0]?.codePersonnel || 'all');
                  }
                }}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Vue journalière</option>
                <option value="individual">Vue individuelle</option>
              </select>
            </div>
            
            {selectedView === 'daily' ? (
              <div>
                <label htmlFor="dateFilter" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  id="dateFilter"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="agentFilter" className="block text-sm font-medium text-gray-700 mb-1">
                  Agent
                </label>
                <select
                  id="agentFilter"
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.codePersonnel}>
                      {agent.nom}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tableau des pointages */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-blue-700 mb-4">
            {selectedView === 'daily' 
              ? `Pointages du ${formatDate(selectedDate)}` 
              : `Pointages de ${agents.find(a => a.codePersonnel === selectedAgent)?.nom || 'l\'agent'}`}
          </h2>
          
          {loading ? (
            <div className="text-center p-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-600">Chargement des pointages...</p>
            </div>
          ) : pointageRecords.length === 0 ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-yellow-700">Aucun pointage trouvé pour cette période.</p>
            </div>
          ) : (
            <>
              {selectedView === 'individual' && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Récapitulatif des heures</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700 border-b">Date</th>
                          <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700 border-b">Heures travaillées</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(hoursWorked).map(([date, hours], index) => (
                          <tr key={date} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="py-2 px-4 text-sm text-gray-700 border-b">{formatDate(date)}</td>
                            <td className="py-2 px-4 text-sm text-gray-700 border-b">
                              {hours.toFixed(2)} heures
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50">
                          <td className="py-2 px-4 text-sm font-semibold text-gray-800 border-b">Total</td>
                          <td className="py-2 px-4 text-sm font-semibold text-gray-800 border-b">
                            {Object.values(hoursWorked).reduce((sum, hours) => sum + hours, 0).toFixed(2)} heures
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead className="bg-blue-100">
                    <tr>
                      {selectedView === 'individual' && (
                        <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Date</th>
                      )}
                      <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Heure</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Type</th>
                      {selectedView === 'daily' && (
                        <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Agent</th>
                      )}
                      <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Code</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Adresse</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pointageRecords.map((record, index) => {
                      // Trouver le nom de l'agent
                      const agent = record.codePersonnel 
                        ? agents.find(a => a.codePersonnel === record.codePersonnel)
                        : agents.find(a => a.ip === record.ip);
                      
                      return (
                        <tr key={record.id || index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          {selectedView === 'individual' && (
                            <td className="py-3 px-4 text-sm text-gray-700">{formatDate(record.date)}</td>
                          )}
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {formatTime(record.timestamp)}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              record.type === 'entree' ? 'bg-green-100 text-green-800' :
                              record.type === 'sortie' ? 'bg-red-100 text-red-800' :
                              record.type === 'pause_debut' ? 'bg-orange-100 text-orange-800' :
                              record.type === 'pause_fin' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {getPointageTypeLabel(record.type)}
                            </span>
                          </td>
                          {selectedView === 'daily' && (
                            <td className="py-3 px-4 text-sm text-gray-700">
                              {agent ? agent.nom : 'Agent inconnu'}
                            </td>
                          )}
                          <td className="py-3 px-4 text-sm text-gray-700 font-mono">
                            {record.codePersonnel || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700 truncate max-w-xs">
                            {record.address || 'Adresse non disponible'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
