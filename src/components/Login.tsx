import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('admin@noisy-le-sec.fr');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, changePassword, initializeAdmin } = useAuth();

  // Initialiser le compte admin si nécessaire
  const handleInitializeAdmin = async () => {
    try {
      setLoading(true);
      await initializeAdmin();
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation admin:', error);
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const success = await login(email, password);
      if (success) {
        navigate('/admin');
      } else {
        setError('Identifiants incorrects');
        // Essayer d'initialiser le compte admin si la connexion échoue
        await handleInitializeAdmin();
      }
    } catch (error) {
      setError('Erreur de connexion. Veuillez réessayer.');
      console.error('Erreur de connexion:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    setLoading(true);
    try {
      await changePassword(newPassword);
      setIsChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      alert('Mot de passe modifié avec succès');
    } catch (error) {
      setError('Erreur lors du changement de mot de passe. Veuillez vous reconnecter et réessayer.');
      console.error('Erreur de changement de mot de passe:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <div className="flex justify-center mb-6">
          <img 
            src="/images/Logo_Noisy_Sec.svg" 
            alt="Logo Mairie de Noisy-le-Sec" 
            className="h-24"
          />
        </div>
        
        <h1 className="text-2xl font-bold text-center text-blue-800 mb-6">
          {isChangingPassword ? 'Changer le mot de passe' : 'Accès Administration'}
        </h1>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {!isChangingPassword ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">Email par défaut: admin@noisy-le-sec.fr</p>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Mot de passe par défaut: admin123</p>
            </div>
            
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setIsChangingPassword(true)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Changer le mot de passe
              </button>
              
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={loading}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(false);
                  setError('');
                }}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Retour à la connexion
              </button>
              
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={loading}
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}
      </div>
      
      <div className="mt-6 text-center">
        <a href="/" className="text-blue-600 hover:text-blue-800">
          Retour à l'accueil
        </a>
      </div>
      
      <div className="mt-6 text-sm text-gray-500">
        © {new Date().getFullYear()} - Ville de Noisy-le-Sec - Tous droits réservés
      </div>
    </div>
  );
};

export default Login;
