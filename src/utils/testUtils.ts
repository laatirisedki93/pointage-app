// Fichier de test pour la synchronisation multi-appareils
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

// Fonction pour tester l'écriture dans Firebase
export const testFirebaseWrite = async () => {
  try {
    // Créer un document de test dans la collection pointages
    const testData = {
      ip: '192.168.1.100',
      type: 'entree',
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      address: 'Adresse de test',
      latitude: 48.8566,
      longitude: 2.3522,
      token: `QR-${new Date().toISOString().split('T')[0]}`
    };
    
    const docRef = await addDoc(collection(db, 'pointages'), testData);
    console.log('Document écrit avec ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de l\'écriture dans Firebase:', error);
    throw error;
  }
};

  // Fonction pour tester la lecture depuis Firebase
export const testFirebaseRead = async () => {
  try {
    // Lire tous les documents de la collection pointages
    const pointagesRef = collection(db, 'pointages');
    const q = query(pointagesRef, orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const records: Array<any> = [];
    querySnapshot.forEach((doc) => {
      records.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log('Documents lus:', records.length);
    return records;
  } catch (error) {
    console.error('Erreur lors de la lecture depuis Firebase:', error);
    throw error;
  }
};// Fonction pour tester la synchronisation en temps réel
export const testRealtimeSync = async (callback: (result: {
  success: boolean;
  message: string;
  records: Array<any>;
}) => void): Promise<void> => {
  try {
    // Écrire un nouveau document
    const docId = await testFirebaseWrite();
    
    // Attendre 2 secondes pour simuler un autre appareil
    setTimeout(async () => {
      // Lire les documents pour vérifier que le nouveau document est présent
      const records = await testFirebaseRead();
      
      // Vérifier si le document écrit est présent dans les résultats
      const docFound = records.some(record => record.id === docId);
      
      callback({
        success: docFound,
        message: docFound 
          ? 'Synchronisation réussie: le document écrit a été lu avec succès' 
          : 'Échec de synchronisation: le document écrit n\'a pas été trouvé',
        records
      });
    }, 2000);
  } catch (error) {
    console.error('Erreur lors du test de synchronisation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    callback({
      success: false,
      message: `Erreur lors du test de synchronisation: ${errorMessage}`,
      records: []
    });
  }
};

// Fonction pour tester la restriction post-pointage
export const testPostPointageRestriction = () => {
  // Vérifier si la navigation arrière est bloquée
  const canGoBack = window.history.length > 1;
  
  // Vérifier si les liens de navigation sont présents
  const hasNavigationLinks = document.querySelectorAll('a[href="/"]').length > 0;
  
  return {
    canGoBack,
    hasNavigationLinks,
    isRestricted: !canGoBack && !hasNavigationLinks
  };
};
