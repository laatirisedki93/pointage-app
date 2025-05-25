import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot,
  query, 
  orderBy,
  doc,
  updateDoc,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { sendAlertEmails } from '../utils/alertsUtils';

// Interface pour les alertes
interface Alert {
  id?: string;
  type: 'missing_exit' | 'inconsistent_hours' | 'missing_pause';
  agentId: string;
  agentName: string;
  date: string;
  message: string;
  status: 'pending' | 'resolved' | 'ignored';
  createdAt: Timestamp | Date;
  resolvedAt?: Timestamp | Date;
  resolvedBy?: string;
  emailSent?: boolean;
}

// Composant principal
const AlertsManager = () => {
  // États
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [emailSending, setEmailSending] = useState<boolean>(false);
  
  // Hooks
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Effet pour vérifier l'authentification et charger les données
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Récupérer les alertes
    const alertsUnsubscribe = onSnapshot(
      query(
        collection(db, 'alerts'),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        const alertsList: Alert[] = [];
        snapshot.forEach((doc) => {
          alertsList.push({
            id: doc.id,
            ...doc.data() as Omit<Alert, 'id'>
          });
        });
        setAlerts(alertsList);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur lors de l'écoute des alertes:", error);
        setLoading(false);
      }
    );

    // Nettoyage des écouteurs
    return () => {
      alertsUnsubscribe();
    };
  }, [currentUser, navigate]);

  // Fonction pour formater la date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Date inconnue';
    
    const date = timestamp.seconds 
      ? new Date(timestamp.seconds * 1000) 
      : new Date(timestamp);
    
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return date.toLocaleDateString('fr-FR', options);
  };

  // Fonction pour marquer une alerte comme résolue
  const handleResolveAlert = async (alertId: string) => {
    try {
      const alertRef = doc(db, 'alerts', alertId);
      await updateDoc(alertRef, {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: currentUser?.email
      });
      
      alert('Alerte marquée comme résolue avec succès.');
    } catch (error) {
      console.error('Erreur lors de la résolution de l\'alerte:', error);
      alert('Erreur lors de la résolution de l\'alerte');
    }
  };

  // Fonction pour ignorer une alerte
  const handleIgnoreAlert = async (alertId: string) => {
    try {
      const alertRef = doc(db, 'alerts', alertId);
      await updateDoc(alertRef, {
        status: 'ignored',
        resolvedAt: new Date(),
        resolvedBy: currentUser?.email
      });
      
      alert('Alerte ignorée avec succès.');
    } catch (error) {
      console.error('Erreur lors de l\'ignorance de l\'alerte:', error);
      alert('Erreur lors de l\'ignorance de l\'alerte');
    }
  };

  // Fonction pour ajouter un pointage manuel depuis une alerte
  const handleAddManualPointage = async (alert: Alert, type: 'entree' | 'sortie' | 'pause_debut' | 'pause_fin') => {
    try {
      // Demander l'heure du pointage
      const timeStr = prompt('Heure du pointage (HH:MM):', '17:00');
      if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) {
        window.alert('Format d\'heure invalide.');
        return;
      }
      
      // Créer le timestamp
      const timestamp = new Date(`${alert.date}T${timeStr}:00`).toISOString();
      
      // Ajouter le pointage
      await addDoc(collection(db, 'pointages'), {
        ip: '0.0.0.0',
        codePersonnel: alert.agentId,
        nomAgent: alert.agentName,
        latitude: null,
        longitude: null,
        address: 'Ajouté manuellement suite à une alerte',
        timestamp,
        type,
        token: `MANUAL-${alert.date}`,
        date: alert.date,
        manuallyAdded: true,
        addedBy: currentUser?.email,
        addedAt: new Date()
      });
      
      // Résoudre l'alerte
      if (alert.id) {
        await handleResolveAlert(alert.id);
      }
      
      window.alert('Pointage ajouté avec succès et alerte résolue.');
    } catch (error) {
      console.error('Erreur lors de l\'ajout du pointage:', error);
      window.alert('Erreur lors de l\'ajout du pointage.');
    }
  };

  // Fonction pour envoyer des emails pour les alertes en attente
  const handleSendEmails = async () => {
    try {
      setEmailSending(true);
      const result = await sendAlertEmails();
      setEmailSending(false);
      
      if (result.success) {
        alert(`${result.emailsSent} email(s) d'alerte envoyé(s) avec succès.`);
      } else {
        throw new Error('Échec de l\'envoi des emails.');
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi des emails:', error);
      setEmailSending(false);
      alert('Erreur lors de l\'envoi des emails.');
    }
  };

  // Fonction pour filtrer les alertes
  const filteredAlerts = alerts.filter(alert => {
    if (selectedStatus !== 'all' && alert.status !== selectedStatus) {
      return false;
    }
    if (selectedType !== 'all' && alert.type !== selectedType) {
      return false;
    }
    return true;
  });

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
              Gestion des Alertes
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-blue-600 hover:text-blue-800">
              Retour au tableau de bord
            </Link>
            <button
              onClick={handleSendEmails}
              disabled={emailSending}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md ${
                emailSending ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {emailSending ? 'Envoi en cours...' : 'Envoyer les notifications par email'}
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Filtrer par statut
              </label>
              <select
                id="statusFilter"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="resolved">Résolues</option>
                <option value="ignored">Ignorées</option>
              </select>
            </div>
            <div>
              <label htmlFor="typeFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Filtrer par type
              </label>
              <select
                id="typeFilter"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les types</option>
                <option value="missing_exit">Sortie manquante</option>
                <option value="inconsistent_hours">Heures incohérentes</option>
                <option value="missing_pause">Pause manquante</option>
              </select>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => {
                  setSelectedStatus('all');
                  setSelectedType('all');
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
              >
                Réinitialiser les filtres
              </button>
            </div>
          </div>
        </div>

        {/* Liste des alertes */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-blue-700 mb-4">
            Alertes
          </h2>
          
          {loading ? (
            <div className="text-center p-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-600">Chargement des alertes...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-yellow-700">Aucune alerte trouvée pour ce statut.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Date</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Type</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Agent</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Message</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Statut</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAlerts.map((alert, index) => (
                    <tr key={alert.id || index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-3 px-4 text-sm text-gray-700">{formatDate(alert.createdAt)}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          alert.type === 'missing_exit' ? 'bg-red-100 text-red-800' :
                          alert.type === 'inconsistent_hours' ? 'bg-orange-100 text-orange-800' :
                          alert.type === 'missing_pause' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.type === 'missing_exit' ? 'Sortie manquante' :
                           alert.type === 'inconsistent_hours' ? 'Heures incohérentes' :
                           alert.type === 'missing_pause' ? 'Pause manquante' :
                           alert.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{alert.agentName}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{alert.message}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          alert.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          alert.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {alert.status === 'pending' ? 'En attente' :
                           alert.status === 'resolved' ? 'Résolue' :
                           'Ignorée'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {alert.status === 'pending' && (
                          <div className="flex flex-col space-y-2">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => alert.id && handleResolveAlert(alert.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-xs"
                              >
                                Résoudre
                              </button>
                              <button
                                onClick={() => alert.id && handleIgnoreAlert(alert.id)}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-xs"
                              >
                                Ignorer
                              </button>
                            </div>
                            
                            {alert.type === 'missing_exit' && (
                              <button
                                onClick={() => handleAddManualPointage(alert, 'sortie')}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs"
                              >
                                Ajouter sortie manuelle
                              </button>
                            )}
                            
                            {alert.type === 'missing_pause' && (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleAddManualPointage(alert, 'pause_debut')}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs"
                                >
                                  Ajouter début pause
                                </button>
                                <button
                                  onClick={() => handleAddManualPointage(alert, 'pause_fin')}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs"
                                >
                                  Ajouter fin pause
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {alert.status !== 'pending' && (
                          <div className="text-sm text-gray-500">
                            {alert.resolvedBy && `Par: ${alert.resolvedBy}`}
                            {alert.resolvedAt && <br />}
                            {alert.resolvedAt && `Le: ${formatDate(alert.resolvedAt)}`}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Statistiques des alertes */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-blue-700 mb-4">
            Statistiques des alertes
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Sorties manquantes</h3>
              <p className="text-3xl font-bold text-red-600">
                {alerts.filter(a => a.type === 'missing_exit' && a.status === 'pending').length}
              </p>
              <p className="text-sm text-red-700 mt-1">
                alertes en attente
              </p>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h3 className="text-lg font-semibold text-orange-800 mb-2">Heures incohérentes</h3>
              <p className="text-3xl font-bold text-orange-600">
                {alerts.filter(a => a.type === 'inconsistent_hours' && a.status === 'pending').length}
              </p>
              <p className="text-sm text-orange-700 mt-1">
                alertes en attente
              </p>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Pauses manquantes</h3>
              <p className="text-3xl font-bold text-yellow-600">
                {alerts.filter(a => a.type === 'missing_pause' && a.status === 'pending').length}
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                alertes en attente
              </p>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Résumé</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total des alertes</p>
                  <p className="text-2xl font-bold text-gray-800">{alerts.length}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">En attente</p>
                  <p className="text-2xl font-bold text-yellow-600">{alerts.filter(a => a.status === 'pending').length}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Résolues</p>
                  <p className="text-2xl font-bold text-green-600">{alerts.filter(a => a.status === 'resolved').length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertsManager;
