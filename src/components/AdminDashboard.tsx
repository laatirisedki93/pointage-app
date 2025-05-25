import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot,
  query, 
  orderBy,
  where,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { 
  detectMissingExits, 
  detectInconsistentHours, 
  detectMissingPauses 
} from '../utils/alertsUtils';

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
  manuallyAdded?: boolean;
}

interface Alert {
  id?: string;
  type: 'missing_exit' | 'inconsistent_hours' | 'missing_pause';
  agentId: string;
  agentName: string;
  date: string;
  message: string;
  status: 'pending' | 'resolved' | 'ignored';
  createdAt: Timestamp | Date;
}

// Composant principal
const AdminDashboard = () => {
  // États
  const [pointageRecords, setPointageRecords] = useState<PointageRecord[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedView, setSelectedView] = useState<string>('daily');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [alertsCount, setAlertsCount] = useState<number>(0);
  
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

    // Récupérer les alertes en attente
    const alertsQuery = query(
      collection(db, 'alerts'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const alertsUnsubscribe = onSnapshot(
      alertsQuery,
      (snapshot) => {
        const alertsList: Alert[] = [];
        snapshot.forEach((doc) => {
          alertsList.push({
            id: doc.id,
            ...doc.data() as Omit<Alert, 'id'>
          });
        });
        setAlerts(alertsList);
        setAlertsCount(alertsList.length);
      },
      (error) => {
        console.error("Erreur lors de l'écoute des alertes:", error);
      }
    );

    // Nettoyage des écouteurs
    return () => {
      agentsUnsubscribe();
      pointagesUnsubscribe();
      alertsUnsubscribe();
    };
  }, [currentUser, navigate, selectedDate, selectedView, selectedAgent]);

  // Fonction pour lancer la détection des alertes
  const handleDetectAlerts = async () => {
    try {
      setLoading(true);
      
      // Détecter les sorties manquantes
      await detectMissingExits();
      
      // Détecter les heures incohérentes
      await detectInconsistentHours();
      
      // Détecter les pauses manquantes
      await detectMissingPauses();
      
      setLoading(false);
      alert('Détection des alertes terminée avec succès.');
    } catch (error) {
      console.error('Erreur lors de la détection des alertes:', error);
      setLoading(false);
      alert('Erreur lors de la détection des alertes.');
    }
  };

  // Fonction pour ajouter manuellement un pointage
  const handleAddManualPointage = async (agentId: string, type: 'entree' | 'sortie' | 'pause_debut' | 'pause_fin', date: string, time: string) => {
    try {
      // Trouver l'agent
      const agent = agents.find(a => a.codePersonnel === agentId);
      if (!agent) {
        alert('Agent non trouvé.');
        return;
      }
      
      // Créer le timestamp
      const timestamp = new Date(`${date}T${time}`).toISOString();
      
      // Ajouter le pointage
      await addDoc(collection(db, 'pointages'), {
        ip: agent.ip || '0.0.0.0',
        codePersonnel: agentId,
        nomAgent: agent.nom,
        latitude: null,
        longitude: null,
        address: 'Ajouté manuellement par administrateur',
        timestamp,
        type,
        token: `MANUAL-${date}`,
        date,
        manuallyAdded: true,
        addedBy: currentUser?.email,
        addedAt: new Date()
      });
      
      alert('Pointage ajouté avec succès.');
    } catch (error) {
      console.error('Erreur lors de l\'ajout du pointage:', error);
      alert('Erreur lors de l\'ajout du pointage.');
    }
  };

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
              Tableau de Bord Administrateur
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/admin" className="text-blue-600 hover:text-blue-800">
              Gestion des agents
            </Link>
            <Link to="/qr-admin" className="text-blue-600 hover:text-blue-800">
              Gestion des QR codes
            </Link>
            <Link to="/alerts" className="relative text-blue-600 hover:text-blue-800">
              Alertes
              {alertsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {alertsCount}
                </span>
              )}
            </Link>
            <Link to="/validation" className="text-blue-600 hover:text-blue-800">
              Validation
            </Link>
            <button 
              onClick={handleLogout}
              className="text-red-600 hover:text-red-800"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* Alertes récentes */}
        {alerts.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  {alerts.length} alerte{alerts.length > 1 ? 's' : ''} en attente
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc pl-5 space-y-1">
                    {alerts.slice(0, 3).map((alert) => (
                      <li key={alert.id}>{alert.message}</li>
                    ))}
                    {alerts.length > 3 && (
                      <li>
                        <Link to="/alerts" className="font-medium underline">
                          Voir toutes les alertes
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions rapides */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-700 mb-4">
            Actions rapides
          </h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleDetectAlerts}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md"
              disabled={loading}
            >
              {loading ? 'Traitement en cours...' : 'Détecter les anomalies'}
            </button>
            <button
              onClick={() => {
                const agentId = prompt('Code personnel de l\'agent:');
                if (!agentId) return;
                
                const type = prompt('Type de pointage (entree, sortie, pause_debut, pause_fin):');
                if (!type || !['entree', 'sortie', 'pause_debut', 'pause_fin'].includes(type)) {
                  alert('Type de pointage invalide.');
                  return;
                }
                
                const date = prompt('Date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
                if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                  alert('Format de date invalide.');
                  return;
                }
                
                const time = prompt('Heure (HH:MM):', new Date().toTimeString().slice(0, 5));
                if (!time || !/^\d{2}:\d{2}$/.test(time)) {
                  alert('Format d\'heure invalide.');
                  return;
                }
                
                handleAddManualPointage(
                  agentId, 
                  type as 'entree' | 'sortie' | 'pause_debut' | 'pause_fin',
                  date,
                  time
                );
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Ajouter un pointage manuel
            </button>
            <Link 
              to="/validation" 
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md inline-block"
            >
              Valider les feuilles d'heures
            </Link>
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
                      <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Origine</th>
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
                              {agent ? agent.nom : record.nomAgent || 'Agent inconnu'}
                            </td>
                          )}
                          <td className="py-3 px-4 text-sm text-gray-700 font-mono">
                            {record.codePersonnel || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700 truncate max-w-xs">
                            {record.address || 'Adresse non disponible'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {record.manuallyAdded ? (
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                                Manuel
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                QR Code
                              </span>
                            )}
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

export default AdminDashboard;
