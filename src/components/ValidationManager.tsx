import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot,
  query, 
  orderBy,
  doc,
  updateDoc,
  where,
  getDocs,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { 
  generateTimesheetPDF, 
  calculateWorkingHours, 
  exportToCSV 
} from '../utils/exportUtils';

// Interfaces
interface ValidationRecord {
  id?: string;
  date: string;
  agentId: string;
  agentName: string;
  hoursWorked: number;
  status: 'pending' | 'validated' | 'rejected';
  comments?: string;
  validatedBy?: string;
  validatedAt?: any;
}

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
const ValidationManager = () => {
  // États
  const [validationRecords, setValidationRecords] = useState<ValidationRecord[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [pointages, setPointages] = useState<PointageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('day');
  const [exportLoading, setExportLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  
  // Hooks
  const { currentUser } = useAuth();
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

    // Récupérer les validations
    const validationsUnsubscribe = onSnapshot(
      query(
        collection(db, 'validations'),
        orderBy('date', 'desc')
      ),
      (snapshot) => {
        const records: ValidationRecord[] = [];
        snapshot.forEach((doc) => {
          records.push({
            id: doc.id,
            ...doc.data() as Omit<ValidationRecord, 'id'>
          });
        });
        setValidationRecords(records);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur lors de l'écoute des validations:", error);
        setLoading(false);
      }
    );

    // Nettoyage des écouteurs
    return () => {
      agentsUnsubscribe();
      validationsUnsubscribe();
    };
  }, [currentUser, navigate]);

  // Effet pour charger les pointages en fonction de la date sélectionnée
  useEffect(() => {
    if (!selectedDate) return;

    let startDate = new Date(selectedDate);
    let endDate = new Date(selectedDate);

    if (selectedPeriod === 'week') {
      // Calculer le début et la fin de la semaine
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Ajuster si dimanche
      startDate = new Date(startDate.setDate(diff));
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else if (selectedPeriod === 'month') {
      // Calculer le début et la fin du mois
      startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    }

    // Formater les dates pour la requête
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Récupérer les pointages pour la période sélectionnée
    const fetchPointages = async () => {
      try {
        let pointagesQuery;
        
        if (selectedPeriod === 'day') {
          pointagesQuery = query(
            collection(db, 'pointages'),
            where('date', '==', selectedDate),
            orderBy('timestamp', 'asc')
          );
        } else {
          pointagesQuery = query(
            collection(db, 'pointages'),
            where('date', '>=', startDateStr),
            where('date', '<=', endDateStr),
            orderBy('date', 'asc'),
            orderBy('timestamp', 'asc')
          );
        }
        
        const pointagesSnapshot = await getDocs(pointagesQuery);
        const pointagesList: PointageRecord[] = [];
        
        pointagesSnapshot.forEach((doc) => {
          pointagesList.push({
            id: doc.id,
            ...doc.data() as Omit<PointageRecord, 'id'>
          });
        });
        
        setPointages(pointagesList);
      } catch (error) {
        console.error("Erreur lors de la récupération des pointages:", error);
      }
    };
    
    fetchPointages();
  }, [selectedDate, selectedPeriod]);

  // Fonction pour formater la date
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString('fr-FR', options);
  };

  // Fonction pour générer les feuilles d'heures pour validation
  const handleGenerateValidations = async () => {
    try {
      setGenerateLoading(true);
      
      // Regrouper les pointages par agent
      const pointagesByAgent: Record<string, PointageRecord[]> = {};
      
      pointages.forEach(pointage => {
        if (pointage.codePersonnel) {
          if (!pointagesByAgent[pointage.codePersonnel]) {
            pointagesByAgent[pointage.codePersonnel] = [];
          }
          pointagesByAgent[pointage.codePersonnel].push(pointage);
        }
      });
      
      // Pour chaque agent, calculer les heures travaillées et créer une validation
      for (const [agentId, agentPointages] of Object.entries(pointagesByAgent)) {
        // Regrouper les pointages par date
        const pointagesByDate: Record<string, PointageRecord[]> = {};
        
        agentPointages.forEach(pointage => {
          if (!pointagesByDate[pointage.date]) {
            pointagesByDate[pointage.date] = [];
          }
          pointagesByDate[pointage.date].push(pointage);
        });
        
        // Pour chaque date, créer une validation
        for (const [date, datePointages] of Object.entries(pointagesByDate)) {
          // Vérifier si une validation existe déjà pour cet agent et cette date
          const existingValidationQuery = query(
            collection(db, 'validations'),
            where('agentId', '==', agentId),
            where('date', '==', date)
          );
          
          const existingValidationSnapshot = await getDocs(existingValidationQuery);
          
          if (existingValidationSnapshot.empty) {
            // Calculer les heures travaillées
            const { hoursWorked } = calculateWorkingHours(datePointages);
            
            // Trouver le nom de l'agent
            const agent = agents.find(a => a.codePersonnel === agentId);
            const agentName = agent ? agent.nom : 'Agent inconnu';
            
            // Créer la validation
            await addDoc(collection(db, 'validations'), {
              date,
              agentId,
              agentName,
              hoursWorked,
              status: 'pending',
              createdAt: new Date()
            });
          }
        }
      }
      
      setGenerateLoading(false);
      alert('Feuilles d\'heures générées avec succès.');
    } catch (error) {
      console.error('Erreur lors de la génération des feuilles d\'heures:', error);
      setGenerateLoading(false);
      alert('Erreur lors de la génération des feuilles d\'heures');
    }
  };

  // Fonction pour valider une feuille d'heures
  const handleValidate = async (recordId: string | undefined) => {
    if (!recordId) return;
    
    try {
      const validationRef = doc(db, 'validations', recordId);
      await updateDoc(validationRef, {
        status: 'validated',
        validatedBy: currentUser?.email,
        validatedAt: new Date()
      });
      
      alert('Feuille d\'heures validée avec succès.');
    } catch (error) {
      console.error('Erreur lors de la validation de la feuille d\'heures:', error);
      alert('Erreur lors de la validation de la feuille d\'heures');
    }
  };

  // Fonction pour rejeter une feuille d'heures
  const handleReject = async (recordId: string | undefined, comments: string) => {
    if (!recordId) return;
    
    try {
      const validationRef = doc(db, 'validations', recordId);
      await updateDoc(validationRef, {
        status: 'rejected',
        comments,
        validatedBy: currentUser?.email,
        validatedAt: new Date()
      });
      
      alert('Feuille d\'heures rejetée avec succès.');
    } catch (error) {
      console.error('Erreur lors du rejet de la feuille d\'heures:', error);
      alert('Erreur lors du rejet de la feuille d\'heures');
    }
  };

  // Fonction pour exporter une feuille d'heures en PDF
  const handleExportPDF = async (record: ValidationRecord) => {
    try {
      // Récupérer les pointages de l'agent pour la date spécifiée
      const pointagesQuery = query(
        collection(db, 'pointages'),
        where('codePersonnel', '==', record.agentId),
        where('date', '==', record.date),
        orderBy('timestamp', 'asc')
      );
      
      const pointagesSnapshot = await getDocs(pointagesQuery);
      const agentPointages: any[] = [];
      
      pointagesSnapshot.forEach((doc) => {
        agentPointages.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Trouver l'agent
      const agent = agents.find(a => a.codePersonnel === record.agentId) || { nom: record.agentName };
      
      // Générer le PDF
      const pdfDoc = generateTimesheetPDF(agent, agentPointages, record.date);
      
      // Télécharger le PDF
      pdfDoc.save(`feuille_heures_${record.agentName.replace(/\s+/g, '_')}_${record.date}.pdf`);
      
      alert('Feuille d\'heures exportée avec succès.');
    } catch (error) {
      console.error('Erreur lors de l\'export de la feuille d\'heures:', error);
      alert('Erreur lors de l\'export de la feuille d\'heures');
    }
  };

  // Fonction pour exporter toutes les feuilles d'heures en CSV
  const handleExportAllCSV = async () => {
    try {
      setExportLoading(true);
      
      // Préparer les données pour l'export
      const exportData = validationRecords
        .filter(record => selectedStatus === 'all' || record.status === selectedStatus)
        .map(record => ({
          Date: formatDate(record.date),
          Agent: record.agentName,
          'Code Personnel': record.agentId,
          'Heures Travaillées': record.hoursWorked.toFixed(2),
          Statut: record.status === 'pending' ? 'En attente' : 
                 record.status === 'validated' ? 'Validé' : 'Rejeté',
          Commentaires: record.comments || '',
          'Validé Par': record.validatedBy || '',
          'Validé Le': record.validatedAt ? 
                      new Date(record.validatedAt.seconds * 1000).toLocaleString('fr-FR') : ''
        }));
      
      // Exporter en CSV
      exportToCSV(exportData, `feuilles_heures_${new Date().toISOString().split('T')[0]}.csv`);
      
      setExportLoading(false);
    } catch (error) {
      console.error('Erreur lors de l\'export des feuilles d\'heures:', error);
      setExportLoading(false);
      alert('Erreur lors de l\'export des feuilles d\'heures');
    }
  };

  // Fonction pour filtrer les validations
  const filteredRecords = validationRecords.filter(record => {
    if (selectedStatus !== 'all' && record.status !== selectedStatus) {
      return false;
    }
    
    // Si on filtre par jour, vérifier la date exacte
    if (selectedPeriod === 'day') {
      return record.date === selectedDate;
    }
    
    // Si on filtre par semaine
    if (selectedPeriod === 'week') {
      const recordDate = new Date(record.date);
      const selectedDateObj = new Date(selectedDate);
      
      // Calculer le début de la semaine
      const day = selectedDateObj.getDay();
      const diff = selectedDateObj.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(selectedDateObj.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      
      // Calculer la fin de la semaine
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      return recordDate >= weekStart && recordDate <= weekEnd;
    }
    
    // Si on filtre par mois
    if (selectedPeriod === 'month') {
      const recordDate = new Date(record.date);
      const selectedDateObj = new Date(selectedDate);
      
      return recordDate.getMonth() === selectedDateObj.getMonth() && 
             recordDate.getFullYear() === selectedDateObj.getFullYear();
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
              Validation et Export des Feuilles d'Heures
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-blue-600 hover:text-blue-800">
              Retour au tableau de bord
            </Link>
          </div>
        </div>

        {/* Filtres et actions */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div>
              <label htmlFor="periodFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Période
              </label>
              <select
                id="periodFilter"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="day">Jour</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
              </select>
            </div>
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
            <div>
              <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                id="statusFilter"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="validated">Validés</option>
                <option value="rejected">Rejetés</option>
              </select>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => {
                  setSelectedStatus('all');
                  setSelectedDate(new Date().toISOString().split('T')[0]);
                  setSelectedPeriod('day');
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
              >
                Réinitialiser les filtres
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleGenerateValidations}
              disabled={generateLoading}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md ${
                generateLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {generateLoading ? 'Génération en cours...' : 'Générer les feuilles d\'heures'}
            </button>
            <button
              onClick={handleExportAllCSV}
              disabled={exportLoading || filteredRecords.length === 0}
              className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md ${
                exportLoading || filteredRecords.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {exportLoading ? 'Export en cours...' : 'Exporter toutes les feuilles (CSV)'}
            </button>
          </div>
        </div>

        {/* Liste des validations */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-blue-700 mb-4">
            Feuilles d'heures
          </h2>
          
          {loading ? (
            <div className="text-center p-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-600">Chargement des feuilles d'heures...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-yellow-700">Aucune feuille d'heures trouvée pour cette période et ce statut.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Date</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Agent</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Code</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Heures</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Statut</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Commentaires</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecords.map((record, index) => (
                    <tr key={record.id || index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-3 px-4 text-sm text-gray-700">{formatDate(record.date)}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{record.agentName}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 font-mono">{record.agentId}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{record.hoursWorked.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          record.status === 'validated' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.status === 'pending' ? 'En attente' :
                           record.status === 'validated' ? 'Validé' :
                           'Rejeté'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {record.comments || '-'}
                        {record.validatedBy && (
                          <div className="text-xs text-gray-500 mt-1">
                            Par: {record.validatedBy}
                            {record.validatedAt && (
                              <span>
                                {' '}le{' '}
                                {new Date(record.validatedAt.seconds * 1000).toLocaleString('fr-FR')}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex flex-col space-y-2">
                          <button
                            onClick={() => handleExportPDF(record)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs"
                          >
                            Exporter PDF
                          </button>
                          {record.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleValidate(record.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-xs"
                              >
                                Valider
                              </button>
                              <button
                                onClick={() => {
                                  const comments = prompt('Commentaires pour le rejet:');
                                  if (comments) {
                                    handleReject(record.id, comments);
                                  }
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-xs"
                              >
                                Rejeter
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Statistiques */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-blue-700 mb-4">
            Statistiques
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">En attente</h3>
              <p className="text-3xl font-bold text-yellow-600">
                {validationRecords.filter(r => r.status === 'pending').length}
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                feuilles d'heures
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-green-800 mb-2">Validées</h3>
              <p className="text-3xl font-bold text-green-600">
                {validationRecords.filter(r => r.status === 'validated').length}
              </p>
              <p className="text-sm text-green-700 mt-1">
                feuilles d'heures
              </p>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Rejetées</h3>
              <p className="text-3xl font-bold text-red-600">
                {validationRecords.filter(r => r.status === 'rejected').length}
              </p>
              <p className="text-sm text-red-700 mt-1">
                feuilles d'heures
              </p>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Heures travaillées totales</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Cette période</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {filteredRecords.reduce((sum, record) => sum + record.hoursWorked, 0).toFixed(2)} heures
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {validationRecords.reduce((sum, record) => sum + record.hoursWorked, 0).toFixed(2)} heures
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValidationManager;
