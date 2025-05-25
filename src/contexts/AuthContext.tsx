import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updatePassword,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  initializeAdmin: () => Promise<User | undefined | void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Email admin par défaut
const DEFAULT_ADMIN_EMAIL = 'admin@noisy-le-sec.fr';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // Fonction pour initialiser le compte admin s'il n'existe pas
  const initializeAdmin = async () => {
    try {
      // Vérifier si le document admin existe dans Firestore
      const adminDocRef = doc(db, 'parametres', 'admin');
      const adminDoc = await getDoc(adminDocRef);

      if (!adminDoc.exists()) {
        // Créer un compte admin par défaut
        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            DEFAULT_ADMIN_EMAIL,
            DEFAULT_ADMIN_PASSWORD
          );
          
          // Enregistrer les informations admin dans Firestore
          await setDoc(adminDocRef, {
            email: DEFAULT_ADMIN_EMAIL,
            createdAt: new Date().toISOString()
          });
          
          console.log('Compte admin créé avec succès');
          return userCredential.user;
        } catch (error) {
          console.error('Erreur lors de la création du compte admin:', error);
          // Si l'erreur est due au fait que l'utilisateur existe déjà, ce n'est pas grave
          // On essaie de se connecter avec les identifiants par défaut
          try {
            await signInWithEmailAndPassword(auth, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD);
          } catch (loginError) {
            console.error('Erreur lors de la connexion avec les identifiants par défaut:', loginError);
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation admin:', error);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error('Erreur de connexion:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  const changePassword = async (newPassword: string) => {
    if (!currentUser) {
      throw new Error('Aucun utilisateur connecté');
    }
    
    try {
      await updatePassword(currentUser, newPassword);
    } catch (error) {
      console.error('Erreur lors du changement de mot de passe:', error);
      throw error;
    }
  };

  const value = {
    currentUser,
    isAuthenticated: !!currentUser,
    isLoading,
    login,
    logout,
    changePassword,
    initializeAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
