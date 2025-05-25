import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

// Interface pour les alertes
export interface Alert {
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

// Fonction pour détecter les sorties manquantes
export const detectMissingExits = async () => {
  try {
    // Date d'hier (pour vérifier les pointages de la veille)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Récupérer tous les agents
    const agentsSnapshot = await getDocs(collection(db, 'agents'));
    const agents: any[] = [];
    agentsSnapshot.forEach(doc => {
      agents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Pour chaque agent, vérifier s'il a pointé en entrée mais pas en sortie
    for (const agent of agents) {
      // Vérifier les entrées
      const entryQuery = query(
        collection(db, 'pointages'),
        where('codePersonnel', '==', agent.codePersonnel),
        where('date', '==', yesterdayStr),
        where('type', '==', 'entree')
      );
      const entrySnapshot = await getDocs(entryQuery);
      
      if (!entrySnapshot.empty) {
        // L'agent a pointé en entrée, vérifier s'il a pointé en sortie
        const exitQuery = query(
          collection(db, 'pointages'),
          where('codePersonnel', '==', agent.codePersonnel),
          where('date', '==', yesterdayStr),
          where('type', '==', 'sortie')
        );
        const exitSnapshot = await getDocs(exitQuery);
        
        if (exitSnapshot.empty) {
          // L'agent n'a pas pointé en sortie, créer une alerte
          await createAlert({
            type: 'missing_exit',
            agentId: agent.codePersonnel,
            agentName: agent.nom,
            date: yesterdayStr,
            message: `L'agent ${agent.nom} n'a pas pointé sa sortie le ${formatDate(yesterdayStr)}.`,
            status: 'pending',
            createdAt: new Date(),
            emailSent: false
          });
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la détection des sorties manquantes:', error);
    return { success: false, error };
  }
};

// Fonction pour détecter les heures incohérentes
export const detectInconsistentHours = async () => {
  try {
    // Date d'hier (pour vérifier les pointages de la veille)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Récupérer tous les agents
    const agentsSnapshot = await getDocs(collection(db, 'agents'));
    const agents: any[] = [];
    agentsSnapshot.forEach(doc => {
      agents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Pour chaque agent, vérifier la cohérence des heures de pointage
    for (const agent of agents) {
      // Récupérer tous les pointages de l'agent pour hier
      const pointagesQuery = query(
        collection(db, 'pointages'),
        where('codePersonnel', '==', agent.codePersonnel),
        where('date', '==', yesterdayStr)
      );
      const pointagesSnapshot = await getDocs(pointagesQuery);
      
      if (!pointagesSnapshot.empty) {
        const pointages: any[] = [];
        pointagesSnapshot.forEach(doc => {
          pointages.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Trier les pointages par timestamp
        pointages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        // Vérifier la séquence des pointages
        let lastType = '';
        let inconsistentFound = false;
        let inconsistentMessage = '';
        
        for (const pointage of pointages) {
          if (
            (pointage.type === 'entree' && lastType === 'entree') ||
            (pointage.type === 'sortie' && lastType === 'sortie') ||
            (pointage.type === 'pause_debut' && lastType === 'pause_debut') ||
            (pointage.type === 'pause_fin' && lastType === 'pause_fin') ||
            (pointage.type === 'pause_fin' && lastType !== 'pause_debut' && lastType !== '') ||
            (pointage.type === 'sortie' && lastType === 'pause_debut')
          ) {
            inconsistentFound = true;
            inconsistentMessage = `Séquence de pointage incohérente pour ${agent.nom} le ${formatDate(yesterdayStr)}: ${getTypeLabel(lastType)} suivi de ${getTypeLabel(pointage.type)}.`;
            break;
          }
          
          lastType = pointage.type;
        }
        
        // Vérifier les heures de travail excessives (plus de 12h)
        if (pointages.length >= 2) {
          const firstPointage = pointages[0];
          const lastPointage = pointages[pointages.length - 1];
          
          if (firstPointage.type === 'entree' && lastPointage.type === 'sortie') {
            const startTime = new Date(firstPointage.timestamp).getTime();
            const endTime = new Date(lastPointage.timestamp).getTime();
            const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
            
            if (hoursWorked > 12) {
              inconsistentFound = true;
              inconsistentMessage = `Durée de travail excessive pour ${agent.nom} le ${formatDate(yesterdayStr)}: ${hoursWorked.toFixed(2)} heures.`;
            }
          }
        }
        
        if (inconsistentFound) {
          // Créer une alerte pour les heures incohérentes
          await createAlert({
            type: 'inconsistent_hours',
            agentId: agent.codePersonnel,
            agentName: agent.nom,
            date: yesterdayStr,
            message: inconsistentMessage,
            status: 'pending',
            createdAt: new Date(),
            emailSent: false
          });
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la détection des heures incohérentes:', error);
    return { success: false, error };
  }
};

// Fonction pour détecter les pauses manquantes
export const detectMissingPauses = async () => {
  try {
    // Date d'hier (pour vérifier les pointages de la veille)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Récupérer tous les agents
    const agentsSnapshot = await getDocs(collection(db, 'agents'));
    const agents: any[] = [];
    agentsSnapshot.forEach(doc => {
      agents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Pour chaque agent, vérifier s'il a travaillé plus de 6h sans pause
    for (const agent of agents) {
      // Récupérer tous les pointages de l'agent pour hier
      const pointagesQuery = query(
        collection(db, 'pointages'),
        where('codePersonnel', '==', agent.codePersonnel),
        where('date', '==', yesterdayStr)
      );
      const pointagesSnapshot = await getDocs(pointagesQuery);
      
      if (!pointagesSnapshot.empty) {
        const pointages: any[] = [];
        pointagesSnapshot.forEach(doc => {
          pointages.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Trier les pointages par timestamp
        pointages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        // Vérifier si l'agent a pointé en entrée et en sortie
        const entryPointage = pointages.find(p => p.type === 'entree');
        const exitPointage = pointages.find(p => p.type === 'sortie');
        
        if (entryPointage && exitPointage) {
          const startTime = new Date(entryPointage.timestamp).getTime();
          const endTime = new Date(exitPointage.timestamp).getTime();
          const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
          
          // Vérifier si l'agent a travaillé plus de 6h
          if (hoursWorked > 6) {
            // Vérifier s'il a pris une pause
            const pauseStartPointage = pointages.find(p => p.type === 'pause_debut');
            const pauseEndPointage = pointages.find(p => p.type === 'pause_fin');
            
            if (!pauseStartPointage || !pauseEndPointage) {
              // L'agent n'a pas pris de pause, créer une alerte
              await createAlert({
                type: 'missing_pause',
                agentId: agent.codePersonnel,
                agentName: agent.nom,
                date: yesterdayStr,
                message: `L'agent ${agent.nom} a travaillé ${hoursWorked.toFixed(2)} heures le ${formatDate(yesterdayStr)} sans prendre de pause.`,
                status: 'pending',
                createdAt: new Date(),
                emailSent: false
              });
            }
          }
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la détection des pauses manquantes:', error);
    return { success: false, error };
  }
};

// Fonction pour créer une alerte
export const createAlert = async (alert: Omit<Alert, 'id'>) => {
  try {
    // Vérifier si une alerte similaire existe déjà
    const existingAlertQuery = query(
      collection(db, 'alerts'),
      where('agentId', '==', alert.agentId),
      where('date', '==', alert.date),
      where('type', '==', alert.type),
      where('status', '==', 'pending')
    );
    const existingAlertSnapshot = await getDocs(existingAlertQuery);
    
    if (existingAlertSnapshot.empty) {
      // Créer l'alerte
      const alertRef = await addDoc(collection(db, 'alerts'), alert);
      return { success: true, alertId: alertRef.id };
    } else {
      return { success: true, alertId: existingAlertSnapshot.docs[0].id, alreadyExists: true };
    }
  } catch (error) {
    console.error('Erreur lors de la création de l\'alerte:', error);
    return { success: false, error };
  }
};

// Fonction pour envoyer des emails d'alerte
export const sendAlertEmails = async () => {
  try {
    // Dans un environnement réel, cette fonction enverrait des emails via un service comme SendGrid ou Mailgun
    // Pour cette démonstration, nous allons simplement marquer les alertes comme "email envoyé"
    
    // Récupérer toutes les alertes en attente qui n'ont pas encore eu d'email envoyé
    const alertsQuery = query(
      collection(db, 'alerts'),
      where('status', '==', 'pending'),
      where('emailSent', '==', false)
    );
    const alertsSnapshot = await getDocs(alertsQuery);
    
    if (!alertsSnapshot.empty) {
      console.log(`Envoi d'emails pour ${alertsSnapshot.size} alertes...`);
      
      // Dans un environnement réel, nous enverrions des emails ici
      // Pour cette démonstration, nous allons simplement logger les alertes
      alertsSnapshot.forEach(doc => {
        const alert = doc.data();
        console.log(`Email d'alerte envoyé pour: ${alert.message}`);
      });
    }
    
    return { success: true, emailsSent: alertsSnapshot.size };
  } catch (error) {
    console.error('Erreur lors de l\'envoi des emails d\'alerte:', error);
    return { success: false, error };
  }
};

// Fonction utilitaire pour formater une date
export const formatDate = (dateString: string) => {
  const options: Intl.DateTimeFormatOptions = { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  };
  return new Date(dateString).toLocaleDateString('fr-FR', options);
};

// Fonction utilitaire pour obtenir le libellé du type de pointage
export const getTypeLabel = (type: string) => {
  switch (type) {
    case 'entree': return 'Entrée';
    case 'sortie': return 'Sortie';
    case 'pause_debut': return 'Début de pause';
    case 'pause_fin': return 'Fin de pause';
    default: return type;
  }
};
