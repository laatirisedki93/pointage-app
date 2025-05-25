import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Fonction pour générer un PDF de feuille d'heures
export const generateTimesheetPDF = (agent: any, pointages: any[], date: string) => {
  // Créer un nouveau document PDF
  const doc = new jsPDF();
  
  // Ajouter le titre
  doc.setFontSize(18);
  doc.text('Feuille d\'heures', 105, 15, { align: 'center' });
  
  // Ajouter le logo
  // doc.addImage('/images/Logo_Noisy_Sec.svg', 'SVG', 10, 10, 30, 30);
  
  // Ajouter les informations de l'agent
  doc.setFontSize(12);
  doc.text(`Agent: ${agent.nom || 'Nom inconnu'}`, 14, 30);
  doc.text(`Code personnel: ${agent.codePersonnel || 'Code inconnu'}`, 14, 40);
  doc.text(`Date: ${formatDate(date)}`, 14, 50);
  
  // Calculer les heures travaillées
  const { hoursWorked, details } = calculateWorkingHours(pointages);
  
  doc.text(`Heures travaillées: ${hoursWorked.toFixed(2)}`, 14, 60);
  
  // Ajouter les détails des heures travaillées
  if (details.length > 0) {
    doc.text('Détails:', 14, 70);
    let y = 80;
    details.forEach((detail, index) => {
      doc.text(`${index + 1}. ${detail}`, 20, y);
      y += 10;
    });
  }
  
  // Ajouter le tableau des pointages
  const tableColumn = ['Heure', 'Type', 'Adresse'];
  const tableRows = pointages.map(pointage => [
    formatTime(pointage.timestamp),
    getPointageTypeLabel(pointage.type),
    pointage.address || 'Adresse non disponible'
  ]);
  
  (doc as any).autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: details.length > 0 ? 80 + details.length * 10 : 80,
    theme: 'striped',
    headStyles: { fillColor: [66, 139, 202] }
  });
  
  // Ajouter la signature
  const finalY = (doc as any).lastAutoTable.finalY || 120;
  doc.text('Signature de l\'agent:', 14, finalY + 20);
  doc.line(14, finalY + 40, 80, finalY + 40);
  
  doc.text('Signature du responsable:', 120, finalY + 20);
  doc.line(120, finalY + 40, 186, finalY + 40);
  
  return doc;
};

// Fonction pour calculer les heures travaillées
export const calculateWorkingHours = (pointages: any[]) => {
  // Trier les pointages par horodatage
  const sortedPointages = [...pointages].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  
  let totalMinutes = 0;
  let details: string[] = [];
  let entryTime: Date | null = null;
  let pauseStartTime: Date | null = null;
  let pauseMinutes = 0;
  
  // Parcourir les pointages pour calculer les heures travaillées
  sortedPointages.forEach(pointage => {
    const time = new Date(pointage.timestamp);
    
    if (pointage.type === 'entree') {
      entryTime = time;
      details.push(`Entrée à ${formatTime(pointage.timestamp)}`);
    } else if (pointage.type === 'sortie' && entryTime) {
      const workMinutes = Math.round((time.getTime() - entryTime.getTime()) / 60000) - pauseMinutes;
      totalMinutes += workMinutes;
      details.push(`Sortie à ${formatTime(pointage.timestamp)} (${(workMinutes / 60).toFixed(2)} heures)`);
      
      // Réinitialiser pour le prochain cycle
      entryTime = null;
      pauseMinutes = 0;
    } else if (pointage.type === 'pause_debut') {
      pauseStartTime = time;
      details.push(`Début de pause à ${formatTime(pointage.timestamp)}`);
    } else if (pointage.type === 'pause_fin' && pauseStartTime) {
      const pauseDuration = Math.round((time.getTime() - pauseStartTime.getTime()) / 60000);
      pauseMinutes += pauseDuration;
      details.push(`Fin de pause à ${formatTime(pointage.timestamp)} (${(pauseDuration / 60).toFixed(2)} heures)`);
      pauseStartTime = null;
    }
  });
  
  return {
    hoursWorked: totalMinutes / 60,
    details
  };
};

// Fonction pour formater la date
export const formatDate = (dateString: string) => {
  const options: Intl.DateTimeFormatOptions = { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  };
  return new Date(dateString).toLocaleDateString('fr-FR', options);
};

// Fonction pour formater l'heure
export const formatTime = (timestampString: string) => {
  const options: Intl.DateTimeFormatOptions = { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  };
  return new Date(timestampString).toLocaleTimeString('fr-FR', options);
};

// Fonction pour obtenir le libellé du type de pointage
export const getPointageTypeLabel = (type: string) => {
  switch (type) {
    case 'entree': return 'Entrée';
    case 'sortie': return 'Sortie';
    case 'pause_debut': return 'Début de pause';
    case 'pause_fin': return 'Fin de pause';
    default: return type;
  }
};

// Fonction pour exporter les données en CSV
export const exportToCSV = (data: any[], filename: string) => {
  // Convertir les données en format CSV
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(item => Object.values(item).join(','));
  const csv = [headers, ...rows].join('\n');
  
  // Créer un blob et un lien de téléchargement
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
