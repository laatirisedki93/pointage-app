import { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc,
  getDocs,
  where,
  query
} from 'firebase/firestore';
import { db } from '../firebase/config';
// import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

// Composant principal
const Pointage = () => {
  // États
  const [codePersonnel, setCodePersonnel] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [loading, setLoading] = useState<boolean>(false);
  const [showCodeForm, setShowCodeForm] = useState<boolean>(false);
  const [adresseObtenue, setAdresseObtenue] = useState<boolean>(false);
  
  // Hooks
  const navigate = useNavigate();

  // Effet pour récupérer les paramètres de l'URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const type = params.get('type');
    
    if (!token || !type) {
      setMessage('Paramètres invalides. Veuillez scanner un QR code valide.');
      setMessageType('error');
      return;
    }
    
    // Vérifier si le token est valide (format QR-YYYY-MM-DD)
    const tokenRegex = /^QR-\d{4}-\d{2}-\d{2}$/;
    if (!tokenRegex.test(token)) {
      setMessage('QR code invalide. Veuillez scanner un QR code valide.');
      setMessageType('error');
      return;
    }
    
    // Vérifier si le type est valide
    const validTypes = ['entree', 'sortie', 'pause_debut', 'pause_fin'];
    if (!validTypes.includes(type)) {
      setMessage('Type de pointage invalide. Veuillez scanner un QR code valide.');
      setMessageType('error');
      return;
    }
    
    // Afficher le formulaire de code personnel
    setShowCodeForm(true);
    
    // Récupérer la position GPS et l'adresse
    getLocationAndAddress();
  }, []);

  // Fonction pour récupérer la position GPS et l'adresse
  const getLocationAndAddress = () => {
    setLoading(true);
    setMessage('Récupération de votre position...');
    setMessageType('info');
    
    // Vérifier si la géolocalisation est disponible
    if (!navigator.geolocation) {
      setMessage('La géolocalisation n\'est pas prise en charge par votre navigateur.');
      setMessageType('error');
      setLoading(false);
      return;
    }
    
    // Options de géolocalisation
    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    };
    
    // Récupérer la position
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Récupérer l'adresse à partir des coordonnées
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=18&addressdetails=1`
          );
          
          if (!response.ok) {
            throw new Error('Erreur lors de la récupération de l\'adresse');
          }
          
          await response.json(); // On récupère les données mais on ne les utilise pas ici
          
          setAdresseObtenue(true);
          setMessage('Position récupérée avec succès. Veuillez saisir votre code personnel.');
          setMessageType('success');
          setLoading(false);
        } catch (error) {
          console.error('Erreur lors de la récupération de l\'adresse:', error);
          setMessage('Impossible de récupérer votre adresse. Veuillez autoriser la géolocalisation et réessayer.');
          setMessageType('error');
          setLoading(false);
        }
      },
      (error) => {
        console.error('Erreur de géolocalisation:', error);
        let errorMessage = 'Erreur lors de la récupération de votre position.';
        
        // Messages d'erreur spécifiques
        if (error.code === 1) {
          errorMessage = 'Vous avez refusé l\'accès à votre position. Veuillez autoriser la géolocalisation et réessayer.';
          if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            errorMessage += ' Sur iPhone, allez dans Réglages > Confidentialité > Service de localisation > Safari > et sélectionnez "Lors de l\'utilisation".';
          }
        } else if (error.code === 2) {
          errorMessage = 'Votre position n\'est pas disponible. Veuillez vérifier que la géolocalisation est activée et réessayer.';
        } else if (error.code === 3) {
          errorMessage = 'La récupération de votre position a pris trop de temps. Veuillez réessayer.';
        }
        
        setMessage(errorMessage);
        setMessageType('error');
        setLoading(false);
      },
      options
    );
  };

  // Fonction pour enregistrer le pointage
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adresseObtenue) {
      setMessage('Impossible de procéder au pointage sans votre adresse. Veuillez autoriser la géolocalisation et réessayer.');
      setMessageType('error');
      return;
    }
    
    // Vérifier si le code personnel est valide
    if (!codePersonnel) {
      setMessage('Veuillez saisir votre code personnel.');
      setMessageType('error');
      return;
    }
    
    // Vérifier le format du code personnel (6 à 9 chiffres)
    const codeRegex = /^\d{6,9}$/;
    if (!codeRegex.test(codePersonnel)) {
      setMessage('Le code personnel doit contenir entre 6 et 9 chiffres.');
      setMessageType('error');
      return;
    }
    
    setLoading(true);
    setMessage('Enregistrement du pointage...');
    setMessageType('info');
    
    try {
      // Récupérer les paramètres de l'URL
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || '';
      const type = params.get('type') || '';
      const date = token.split('-').slice(1).join('-');
      
      // Vérifier si l'agent existe
      const agentsQuery = query(collection(db, 'agents'));
      const agentsSnapshot = await getDocs(agentsQuery);
      
      let agentFound = false;
      let agentName = '';
      
      agentsSnapshot.forEach((doc) => {
        const agentData = doc.data() as any;
        if (agentData.codePersonnel === codePersonnel) {
          agentFound = true;
          agentName = agentData.nom || 'Agent sans nom';
        }
      });
      
      if (!agentFound) {
        setMessage('Code personnel invalide. Veuillez vérifier votre code et réessayer.');
        setMessageType('error');
        setLoading(false);
        return;
      }
      
      // Vérifier si l'agent a déjà pointé aujourd'hui avec ce type
      const pointagesQuery = query(
        collection(db, 'pointages'),
        where('codePersonnel', '==', codePersonnel),
        where('date', '==', date),
        where('type', '==', type)
      );
      
      const pointagesSnapshot = await getDocs(pointagesQuery);
      
      if (!pointagesSnapshot.empty) {
        setMessage(`Vous avez déjà effectué un pointage de type "${type}" aujourd'hui.`);
        setMessageType('error');
        setLoading(false);
        return;
      }
      
      // Récupérer l'adresse IP publique
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const ip = ipData.ip || 'IP non disponible';
      
      // Récupérer la position GPS
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      
      // Récupérer l'adresse à partir des coordonnées
      const addressResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=18&addressdetails=1`
      );
      
      const addressData = await addressResponse.json();
      const address = addressData.display_name || 'Adresse non disponible';
      
      // Enregistrer le pointage dans Firestore
      await addDoc(collection(db, 'pointages'), {
        ip,
        codePersonnel,
        nomAgent: agentName,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        address,
        timestamp: new Date().toISOString(),
        type,
        token,
        date
      });
      
      // Afficher un message de succès
      setMessage(`Pointage de type "${type}" enregistré avec succès.`);
      setMessageType('success');
      setLoading(false);
      
      // Réinitialiser le formulaire
      setCodePersonnel('');
      setShowCodeForm(false);
      
      // Rediriger vers la page d'accueil après 3 secondes
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du pointage:', error);
      setMessage('Erreur lors de l\'enregistrement du pointage. Veuillez réessayer.');
      setMessageType('error');
      setLoading(false);
    }
  };

  // Fonction pour réessayer la géolocalisation
  const handleRetryLocation = () => {
    getLocationAndAddress();
  };

  // Rendu du composant
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-center mb-6">
          <img 
            src="/images/Logo_Noisy_Sec.svg" 
            alt="Logo Mairie de Noisy-le-Sec" 
            className="h-20"
          />
        </div>
        
        <h1 className="text-2xl font-bold text-center text-blue-800 mb-6">
          Pointage
        </h1>
        
        {message && (
          <div className={`p-4 mb-6 rounded-md ${
            messageType === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' :
            messageType === 'error' ? 'bg-red-100 text-red-800 border-l-4 border-red-500' :
            'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
          }`}>
            <p>{message}</p>
            
            {messageType === 'error' && !adresseObtenue && (
              <button
                onClick={handleRetryLocation}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
              >
                Réessayer la géolocalisation
              </button>
            )}
          </div>
        )}
        
        {showCodeForm && adresseObtenue && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="codePersonnel" className="block text-sm font-medium text-gray-700 mb-1">
                Code personnel (6 à 9 chiffres)
              </label>
              <input
                id="codePersonnel"
                type="text"
                inputMode="numeric"
                pattern="\d{6,9}"
                value={codePersonnel}
                onChange={(e) => setCodePersonnel(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Entrez votre code personnel"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></span>
                  Traitement en cours...
                </span>
              ) : (
                'Enregistrer le pointage'
              )}
            </button>
          </form>
        )}
        
        <div className="mt-6 text-center">
          <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Pointage;
