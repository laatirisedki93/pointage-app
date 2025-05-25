import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot,
  query, 
  orderBy,
  addDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

// Composant principal
const Admin = () => {
  // États
  const [agents, setAgents] = useState<any[]>([]);
  const [pointages, setPointages] = useState<any[]>([]);
  const [newAgent, setNewAgent] = useState({ nom: '', codePersonnel: '', ip: '' });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
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
        setLoading(false);
      },
      (error) => {
        console.error("Erreur lors de l'écoute des agents:", error);
        setLoading(false);
      }
    );

    // Récupérer les pointages
    const pointagesUnsubscribe = onSnapshot(
      query(
        collection(db, 'pointages'),
        orderBy('timestamp', 'desc')
      ),
      (snapshot) => {
        const pointagesList: any[] = [];
        snapshot.forEach((doc) => {
          pointagesList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setPointages(pointagesList);
      },
      (error) => {
        console.error("Erreur lors de l'écoute des pointages:", error);
      }
    );

    // Nettoyage des écouteurs
    return () => {
      agentsUnsubscribe();
      pointagesUnsubscribe();
    };
  }, [currentUser, navigate]);

  // Fonction pour ajouter un agent
  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Vérifier si le nom est vide
      if (!newAgent.nom.trim()) {
        setError('Le nom de l\'agent ne peut pas être vide');
        return;
      }
      
      // Vérifier si le code personnel est valide (6 à 9 chiffres)
      const codeRegex = /^\d{6,9}$/;
      if (!codeRegex.test(newAgent.codePersonnel)) {
        setError('Le code personnel doit contenir entre 6 et 9 chiffres');
        return;
      }
      
      // Vérifier si le code personnel existe déjà
      const existingAgent = agents.find(agent => agent.codePersonnel === newAgent.codePersonnel);
      if (existingAgent) {
        setError('Ce code personnel est déjà utilisé par un autre agent');
        return;
      }
      
      // Ajouter l'agent à Firestore
      await addDoc(collection(db, 'agents'), {
        nom: newAgent.nom,
        codePersonnel: newAgent.codePersonnel,
        ip: newAgent.ip || '',
        createdAt: new Date()
      });
      
      // Réinitialiser le formulaire
      setNewAgent({ nom: '', codePersonnel: '', ip: '' });
      setSuccess('Agent ajouté avec succès');
      setError('');
      
      // Effacer le message de succès après 3 secondes
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'agent:', error);
      setError('Erreur lors de l\'ajout de l\'agent');
    }
  };

  // Fonction pour supprimer un agent
  const handleDeleteAgent = async (agentId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet agent ?')) {
      return;
    }
    
    try {
      // Supprimer l'agent de Firestore
      await deleteDoc(doc(db, 'agents', agentId));
      
      setSuccess('Agent supprimé avec succès');
      
      // Effacer le message de succès après 3 secondes
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'agent:', error);
      setError('Erreur lors de la suppression de l\'agent');
    }
  };

  // Fonction pour générer un code personnel aléatoire
  const generateRandomCode = () => {
    // Générer un code entre 6 et 9 chiffres
    const length = Math.floor(Math.random() * 4) + 6; // 6 à 9
    let code = '';
    for (let i = 0; i < length; i++) {
      code += Math.floor(Math.random() * 10);
    }
    setNewAgent({ ...newAgent, codePersonnel: code });
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

  // Fonction pour filtrer les pointages par date
  const filteredPointages = pointages.filter(pointage => {
    return pointage.date === selectedDate;
  });

  // Fonction pour déconnexion
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

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
              Administration
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

        {/* Messages d'erreur et de succès */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            <p>{error}</p>
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6">
            <p>{success}</p>
          </div>
        )}

        {/* Formulaire d'ajout d'agent */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-blue-700 mb-4">
            Ajouter un agent
          </h2>
          
          <form onSubmit={handleAddAgent} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de l'agent
                </label>
                <input
                  id="nom"
                  type="text"
                  value={newAgent.nom}
                  onChange={(e) => setNewAgent({ ...newAgent, nom: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom de l'agent"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="codePersonnel" className="block text-sm font-medium text-gray-700 mb-1">
                  Code personnel (6 à 9 chiffres)
                </label>
                <div className="flex">
                  <input
                    id="codePersonnel"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6,9}"
                    value={newAgent.codePersonnel}
                    onChange={(e) => setNewAgent({ ...newAgent, codePersonnel: e.target.value })}
                    className="w-full border border-gray-300 rounded-l-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Code personnel"
                    required
                  />
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-r-md"
                  >
                    Générer
                  </button>
                </div>
              </div>
              
              <div>
                <label htmlFor="ip" className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse IP (optionnel)
                </label>
                <input
                  id="ip"
                  type="text"
                  value={newAgent.ip}
                  onChange={(e) => setNewAgent({ ...newAgent, ip: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Adresse IP"
                />
              </div>
            </div>
            
            <div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Ajouter l'agent
              </button>
            </div>
          </form>
        </div>

        {/* Liste des agents */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-blue-700 mb-4">
            Liste des agents
          </h2>
          
          {loading ? (
            <div className="text-center p-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-600">Chargement des agents...</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-yellow-700">Aucun agent trouvé. Ajoutez des agents à l'aide du formulaire ci-dessus.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Nom</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Code personnel</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Adresse IP</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {agents.map((agent, index) => (
                    <tr key={agent.id || index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-3 px-4 text-sm text-gray-700">{agent.nom}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 font-mono">{agent.codePersonnel}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{agent.ip || '-'}</td>
                      <td className="py-3 px-4 text-sm">
                        <button
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-xs"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Liste des pointages */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-blue-700">
              Pointages
            </h2>
            <div>
              <label htmlFor="dateFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Filtrer par date
              </label>
              <input
                id="dateFilter"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          {loading ? (
            <div className="text-center p-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-600">Chargement des pointages...</p>
            </div>
          ) : filteredPointages.length === 0 ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-yellow-700">Aucun pointage trouvé pour cette date.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Date</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Heure</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Type</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Agent</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Code</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">IP</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-800">Adresse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPointages.map((pointage, index) => (
                    <tr key={pointage.id || index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-3 px-4 text-sm text-gray-700">{formatDate(pointage.date)}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{formatTime(pointage.timestamp)}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          pointage.type === 'entree' ? 'bg-green-100 text-green-800' :
                          pointage.type === 'sortie' ? 'bg-red-100 text-red-800' :
                          pointage.type === 'pause_debut' ? 'bg-orange-100 text-orange-800' :
                          pointage.type === 'pause_fin' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {getPointageTypeLabel(pointage.type)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{pointage.nomAgent || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 font-mono">{pointage.codePersonnel || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{pointage.ip || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 truncate max-w-xs">
                        {pointage.address || 'Adresse non disponible'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
