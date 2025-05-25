import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot,
  query, 
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG as QRCode } from 'qrcode.react';

// Interface pour l'historique des QR codes
interface QrHistory {
  id?: string;
  date: string;
  entryUrl: string;
  exitUrl: string;
  pauseStartUrl: string;
  pauseEndUrl: string;
  createdAt: any;
  createdBy: string;
  description?: string;
}

// Composant principal
const QrAdmin = () => {
  // États
  const [entryQrUrl, setEntryQrUrl] = useState<string>('');
  const [exitQrUrl, setExitQrUrl] = useState<string>('');
  const [pauseStartQrUrl, setPauseStartQrUrl] = useState<string>('');
  const [pauseEndQrUrl, setPauseEndQrUrl] = useState<string>('');
  const [showExitQr, setShowExitQr] = useState<boolean>(false);
  const [showPauseQr, setShowPauseQr] = useState<boolean>(false);
  const [customDate, setCustomDate] = useState<string>('');
  const [qrDescription, setQrDescription] = useState<string>('');
  const [qrHistory, setQrHistory] = useState<QrHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [printMode, setPrintMode] = useState<boolean>(false);
  const [selectedQrType, setSelectedQrType] = useState<string>('all');
  
  // Hooks
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // Effet pour vérifier l'authentification et générer les QR codes
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Générer les QR codes par défaut pour aujourd'hui
    generateQrCodes();

    // Vérifier l'heure pour afficher automatiquement le QR de sortie
    checkTimeForExitQr();

    // Récupérer l'historique des QR codes
    const qrHistoryUnsubscribe = onSnapshot(
      query(
        collection(db, 'qrHistory'),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        const historyList: QrHistory[] = [];
        snapshot.forEach((doc) => {
          historyList.push({
            id: doc.id,
            ...doc.data() as Omit<QrHistory, 'id'>
          });
        });
        setQrHistory(historyList);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur lors de l'écoute de l'historique des QR codes:", error);
        setLoading(false);
      }
    );

    // Nettoyage des écouteurs
    return () => {
      qrHistoryUnsubscribe();
    };
  }, [currentUser, navigate]);

  // Fonction pour générer les QR codes
  const generateQrCodes = (date?: string) => {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const baseUrl = window.location.origin;
    
    // QR code d'entrée
    const entryUrl = `${baseUrl}/pointage?token=QR-${targetDate}&type=entree`;
    setEntryQrUrl(entryUrl);
    
    // QR code de sortie
    const exitUrl = `${baseUrl}/pointage?token=QR-${targetDate}&type=sortie`;
    setExitQrUrl(exitUrl);
    
    // QR code de début de pause
    const pauseStartUrl = `${baseUrl}/pointage?token=QR-${targetDate}&type=pause_debut`;
    setPauseStartQrUrl(pauseStartUrl);
    
    // QR code de fin de pause
    const pauseEndUrl = `${baseUrl}/pointage?token=QR-${targetDate}&type=pause_fin`;
    setPauseEndQrUrl(pauseEndUrl);
  };

  // Fonction pour enregistrer les QR codes dans l'historique
  const saveQrToHistory = async () => {
    if (!customDate) {
      alert('Veuillez sélectionner une date');
      return;
    }
    
    try {
      // Vérifier si un enregistrement existe déjà pour cette date
      const existingQuery = query(
        collection(db, 'qrHistory'),
        where('date', '==', customDate)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        if (!confirm('Un ensemble de QR codes existe déjà pour cette date. Voulez-vous le remplacer?')) {
          return;
        }
        
        // Supprimer l'enregistrement existant
        await deleteDoc(doc(db, 'qrHistory', existingSnapshot.docs[0].id));
      }
      
      // Enregistrer les nouveaux QR codes
      await addDoc(collection(db, 'qrHistory'), {
        date: customDate,
        entryUrl: entryQrUrl,
        exitUrl: exitQrUrl,
        pauseStartUrl: pauseStartQrUrl,
        pauseEndUrl: pauseEndQrUrl,
        description: qrDescription || `QR codes pour le ${formatDate(customDate)}`,
        createdAt: new Date(),
        createdBy: currentUser?.email || 'Admin'
      });
      
      alert(`QR codes enregistrés pour le ${formatDate(customDate)}`);
      setQrDescription('');
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des QR codes dans l'historique:", error);
      alert("Erreur lors de l'enregistrement des QR codes");
    }
  };

  // Fonction pour vérifier l'heure et afficher automatiquement le QR de sortie
  const checkTimeForExitQr = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Convertir l'heure en minutes depuis minuit
    const timeInMinutes = hours * 60 + minutes;
    
    // Vendredi (jour 5) : afficher le QR de sortie à partir de 15h00 (900 minutes)
    if (day === 5 && timeInMinutes >= 900) {
      setShowExitQr(true);
    }
    // Lundi à jeudi (jours 1 à 4) : afficher le QR de sortie à partir de 16h30 (990 minutes)
    else if (day >= 1 && day <= 4 && timeInMinutes >= 990) {
      setShowExitQr(true);
    }
    // Sinon, ne pas afficher le QR de sortie
    else {
      setShowExitQr(false);
    }
    
    // Afficher les QR de pause entre 11h30 et 14h30
    if (timeInMinutes >= 690 && timeInMinutes <= 870) {
      setShowPauseQr(true);
    } else {
      setShowPauseQr(false);
    }
  };

  // Fonction pour générer des QR codes pour une date spécifique
  const handleGenerateCustomQr = () => {
    if (!customDate) {
      alert('Veuillez sélectionner une date');
      return;
    }
    
    generateQrCodes(customDate);
    setShowExitQr(true);
    setShowPauseQr(true);
  };

  // Fonction pour supprimer un historique de QR code
  const handleDeleteQrHistory = async (historyId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet historique de QR codes ?')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'qrHistory', historyId));
      alert('Historique de QR codes supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'historique de QR codes:', error);
      alert('Erreur lors de la suppression de l\'historique de QR codes');
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

  // Fonction pour déconnexion
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  // Fonction pour basculer en mode impression
  const togglePrintMode = () => {
    setPrintMode(!printMode);
    if (!printMode) {
      // Attendre que le DOM soit mis à jour avant d'imprimer
      setTimeout(() => {
        window.print();
        setPrintMode(false);
      }, 500);
    }
  };

  // Rendu du composant
  return (
    <div className={`min-h-screen bg-gray-50 p-4 ${printMode ? 'print-mode' : ''}`}>
      <div className="max-w-7xl mx-auto">
        {/* En-tête - caché en mode impression */}
        {!printMode && (
          <div className="flex justify-between items-center mb-6 no-print">
            <div className="flex items-center">
              <img 
                src="/images/Logo_Noisy_Sec.svg" 
                alt="Logo Mairie de Noisy-le-Sec" 
                className="h-16 mr-4"
              />
              <h1 className="text-2xl font-bold text-blue-800">
                Gestion des QR Codes
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-blue-600 hover:text-blue-800">
                Tableau de bord
              </Link>
              <button 
                onClick={handleLogout}
                className="text-red-600 hover:text-red-800"
              >
                Déconnexion
              </button>
            </div>
          </div>
        )}

        {/* Générateur de QR codes - caché en mode impression */}
        {!printMode && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 no-print">
            <h2 className="text-xl font-semibold text-blue-700 mb-4">
              Générer des QR codes pour une date spécifique
            </h2>
            
            <div className="flex flex-wrap items-end gap-4 mb-6">
              <div>
                <label htmlFor="customDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  id="customDate"
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="qrDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optionnel)
                </label>
                <input
                  id="qrDescription"
                  type="text"
                  value={qrDescription}
                  onChange={(e) => setQrDescription(e.target.value)}
                  placeholder="Ex: Réunion spéciale, Journée portes ouvertes..."
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>
              <button
                onClick={handleGenerateCustomQr}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Générer les QR codes
              </button>
              <button
                onClick={saveQrToHistory}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
              >
                Enregistrer dans l'historique
              </button>
              <button
                onClick={togglePrintMode}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md"
              >
                Imprimer les QR codes
              </button>
            </div>
          </div>
        )}
        
        {/* QR codes */}
        <div className={`bg-white rounded-lg shadow-lg p-6 mb-6 ${printMode ? 'print-friendly' : ''}`}>
          {printMode && (
            <div className="print-header mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <img 
                    src="/images/Logo_Noisy_Sec.svg" 
                    alt="Logo Mairie de Noisy-le-Sec" 
                    className="h-16 mr-4"
                  />
                  <div>
                    <h1 className="text-2xl font-bold text-blue-800">
                      QR Codes de Pointage
                    </h1>
                    <p className="text-gray-600">
                      {customDate ? `Date : ${formatDate(customDate)}` : 'Date du jour'}
                    </p>
                    {qrDescription && (
                      <p className="text-gray-600">
                        {qrDescription}
                      </p>
                    )}
                  </div>
                </div>
                <button 
                  onClick={togglePrintMode}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md no-print"
                >
                  Quitter le mode impression
                </button>
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-6 justify-center">
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">QR Code d'entrée</h3>
              <div className="bg-white p-4 border border-gray-300 rounded-lg">
                <QRCode value={entryQrUrl} size={200} />
              </div>
              <p className="mt-2 text-sm text-gray-600 max-w-xs text-center">
                Scannez ce code pour enregistrer votre entrée
              </p>
            </div>
            
            {(showExitQr || customDate || printMode) && (
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">QR Code de sortie</h3>
                <div className="bg-white p-4 border border-gray-300 rounded-lg">
                  <QRCode value={exitQrUrl} size={200} />
                </div>
                <p className="mt-2 text-sm text-gray-600 max-w-xs text-center">
                  Scannez ce code pour enregistrer votre sortie
                </p>
              </div>
            )}
            
            {(showPauseQr || customDate || printMode) && (
              <>
                <div className="flex flex-col items-center">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">QR Code début de pause</h3>
                  <div className="bg-white p-4 border border-gray-300 rounded-lg">
                    <QRCode value={pauseStartQrUrl} size={200} />
                  </div>
                  <p className="mt-2 text-sm text-gray-600 max-w-xs text-center">
                    Scannez ce code pour enregistrer votre début de pause
                  </p>
                </div>
                
                <div className="flex flex-col items-center">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">QR Code fin de pause</h3>
                  <div className="bg-white p-4 border border-gray-300 rounded-lg">
                    <QRCode value={pauseEndQrUrl} size={200} />
                  </div>
                  <p className="mt-2 text-sm text-gray-600 max-w-xs text-center">
                    Scannez ce code pour enregistrer votre fin de pause
                  </p>
                </div>
              </>
            )}
          </div>
          
          {!printMode && (
            <div className="mt-6 no-print">
              <div className="flex items-center mb-4">
                <input
                  id="showPauseQr"
                  type="checkbox"
                  checked={showPauseQr}
                  onChange={(e) => setShowPauseQr(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="showPauseQr" className="ml-2 block text-sm text-gray-700">
                  Afficher les QR codes de pause
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  id="showExitQr"
                  type="checkbox"
                  checked={showExitQr}
                  onChange={(e) => setShowExitQr(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="showExitQr" className="ml-2 block text-sm text-gray-700">
                  Afficher le QR code de sortie (s'affiche automatiquement à 16h30 du lundi au jeudi, et à 15h00 le vendredi)
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Historique des QR codes - caché en mode impression */}
        {!printMode && (
          <div className="bg-white rounded-lg shadow-lg p-6 no-print">
            <h2 className="text-xl font-semibold text-blue-700 mb-4">
              Historique des QR codes
            </h2>
            
            <div className="mb-4">
              <label htmlFor="qrTypeFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Filtrer par type
              </label>
              <select
                id="qrTypeFilter"
                value={selectedQrType}
                onChange={(e) => setSelectedQrType(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les types</option>
                <option value="recent">Récents (7 derniers jours)</option>
                <option value="future">Dates futures</option>
                <option value="past">Dates passées</option>
              </select>
            </div>
            
            {loading ? (
              <div className="text-center p-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p className="mt-2 text-gray-600">Chargement de l'historique...</p>
              </div>
            ) : qrHistory.length === 0 ? (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="text-yellow-700">Aucun historique de QR code trouvé.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Date</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Description</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Créé par</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Créé le</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {qrHistory
                      .filter(history => {
                        if (selectedQrType === 'all') return true;
                        
                        const historyDate = new Date(history.date);
                        const today = new Date();
                        const sevenDaysAgo = new Date();
                        sevenDaysAgo.setDate(today.getDate() - 7);
                        
                        if (selectedQrType === 'recent') {
                          return historyDate >= sevenDaysAgo;
                        } else if (selectedQrType === 'future') {
                          return historyDate > today;
                        } else if (selectedQrType === 'past') {
                          return historyDate < today;
                        }
                        
                        return true;
                      })
                      .map((history, index) => (
                        <tr key={history.id || index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="py-3 px-4 text-sm text-gray-700">{formatDate(history.date)}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">{history.description || '-'}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">{history.createdBy}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {history.createdAt?.seconds 
                              ? new Date(history.createdAt.seconds * 1000).toLocaleString('fr-FR')
                              : new Date(history.createdAt).toLocaleString('fr-FR')}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  setCustomDate(history.date);
                                  setEntryQrUrl(history.entryUrl);
                                  setExitQrUrl(history.exitUrl);
                                  setPauseStartQrUrl(history.pauseStartUrl);
                                  setPauseEndQrUrl(history.pauseEndUrl);
                                  setQrDescription(history.description || '');
                                  setShowExitQr(true);
                                  setShowPauseQr(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs"
                              >
                                Afficher
                              </button>
                              <button
                                onClick={() => history.id && handleDeleteQrHistory(history.id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-xs"
                              >
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Styles pour l'impression */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          .print-friendly {
            box-shadow: none !important;
            border: none !important;
          }
          
          .print-mode {
            background-color: white !important;
            padding: 0 !important;
          }
          
          body {
            background-color: white !important;
          }
        }
      `}</style>
    </div>
  );
};

export default QrAdmin;
