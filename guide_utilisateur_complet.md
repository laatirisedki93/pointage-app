# Guide d'utilisation complet de l'application de pointage

## Introduction

L'application de pointage pour la Ville de Noisy-le-Sec permet aux agents municipaux d'enregistrer leurs heures de travail via un système de QR codes et de codes personnels. Cette application offre également aux administrateurs un tableau de bord complet pour suivre les pointages en temps réel, gérer les alertes, valider les feuilles d'heures et exporter les données.

Ce guide détaille l'ensemble des fonctionnalités disponibles et explique comment les utiliser efficacement.

## Sommaire

1. [Pointage pour les agents](#1-pointage-pour-les-agents)
2. [Tableau de bord administrateur](#2-tableau-de-bord-administrateur)
3. [Gestion des alertes](#3-gestion-des-alertes)
4. [Gestion des QR codes](#4-gestion-des-qr-codes)
5. [Validation et export des feuilles d'heures](#5-validation-et-export-des-feuilles-dheures)
6. [Gestion des agents](#6-gestion-des-agents)

## 1. Pointage pour les agents

### Accès à l'application

Les agents peuvent accéder à l'application de pointage via l'URL fournie, en scannant un QR code ou en accédant directement à la page de pointage.

### Processus de pointage

1. **Scanner un QR code** : L'agent scanne le QR code correspondant au type de pointage souhaité (entrée, sortie, début de pause, fin de pause).
2. **Autoriser la géolocalisation** : L'application demande l'autorisation d'accéder à la position de l'agent pour enregistrer le lieu du pointage.
3. **Saisir le code personnel** : L'agent saisit son code personnel à 4 chiffres pour s'identifier.
4. **Confirmation** : Un message de confirmation s'affiche pour indiquer que le pointage a été enregistré avec succès.

### Types de pointage

- **Entrée** : À utiliser en début de journée de travail
- **Sortie** : À utiliser en fin de journée de travail
- **Début de pause** : À utiliser au début d'une pause (déjeuner, etc.)
- **Fin de pause** : À utiliser à la fin d'une pause

### Codes personnels

Chaque agent dispose d'un code personnel à 4 chiffres qui lui est attribué par l'administrateur. Ce code permet d'identifier l'agent indépendamment de l'appareil utilisé pour le pointage, ce qui résout le problème des adresses IP partagées sur un même réseau WiFi.

## 2. Tableau de bord administrateur

### Accès au tableau de bord

1. Accédez à l'URL de l'application
2. Connectez-vous avec vos identifiants administrateur
3. Vous serez automatiquement redirigé vers le tableau de bord

### Fonctionnalités principales

#### Vue en temps réel

Le tableau de bord affiche en temps réel tous les pointages effectués par les agents. Chaque nouveau pointage apparaît instantanément sans nécessiter de rafraîchissement de la page.

#### Filtres disponibles

- **Type de vue** : Choisissez entre la vue journalière (tous les agents pour une date) ou la vue individuelle (un agent spécifique).
- **Date** : Sélectionnez une date spécifique pour afficher les pointages correspondants.
- **Agent** : En vue individuelle, sélectionnez un agent spécifique pour voir ses pointages.

#### Récapitulatif des heures

En vue individuelle, un récapitulatif des heures travaillées par jour est affiché, avec le total des heures pour la période sélectionnée. Les pauses sont automatiquement déduites du temps de travail.

#### Actions rapides

- **Détecter les anomalies** : Lance la détection automatique des anomalies (sorties manquantes, heures incohérentes, pauses manquantes).
- **Ajouter un pointage manuel** : Permet d'ajouter manuellement un pointage pour un agent (en cas d'oubli ou de problème technique).
- **Valider les feuilles d'heures** : Accède à l'interface de validation des feuilles d'heures.

### Navigation

Des liens vers les autres sections de l'application sont disponibles dans l'en-tête :
- Gestion des agents
- Gestion des QR codes
- Alertes
- Validation

## 3. Gestion des alertes

### Types d'alertes

L'application détecte automatiquement trois types d'anomalies :
1. **Sorties manquantes** : Lorsqu'un agent a pointé en entrée mais pas en sortie.
2. **Heures incohérentes** : Lorsque la séquence des pointages est incorrecte ou que les heures de travail sont excessives.
3. **Pauses manquantes** : Lorsqu'un agent a travaillé plus de 6 heures sans prendre de pause.

### Gestion des alertes

Pour chaque alerte, plusieurs actions sont possibles :
- **Résoudre** : Marquer l'alerte comme résolue après avoir pris les mesures nécessaires.
- **Ignorer** : Marquer l'alerte comme ignorée si elle n'est pas pertinente.
- **Ajouter un pointage manuel** : Pour les sorties ou pauses manquantes, vous pouvez directement ajouter le pointage manquant depuis l'interface d'alertes.

### Filtres et statistiques

- Filtrez les alertes par statut (en attente, résolues, ignorées) ou par type.
- Consultez les statistiques des alertes pour avoir une vue d'ensemble de la situation.

### Notifications par email

Un bouton permet d'envoyer des notifications par email pour les alertes en attente. Cette fonctionnalité est préparée pour une intégration avec un service d'envoi d'emails.

## 4. Gestion des QR codes

### Génération des QR codes

1. Sélectionnez une date pour laquelle vous souhaitez générer des QR codes.
2. Ajoutez une description optionnelle (ex: "Réunion spéciale", "Journée portes ouvertes").
3. Cliquez sur "Générer les QR codes".
4. Les QR codes pour l'entrée, la sortie, le début et la fin de pause sont générés.

### Affichage automatique

- Les QR codes de sortie s'affichent automatiquement à partir de 16h30 du lundi au jeudi, et à partir de 15h00 le vendredi.
- Les QR codes de pause s'affichent automatiquement entre 11h30 et 14h30.
- Vous pouvez modifier manuellement l'affichage des QR codes via les cases à cocher.

### Impression des QR codes

Cliquez sur "Imprimer les QR codes" pour passer en mode impression, puis utilisez la fonction d'impression de votre navigateur pour imprimer les QR codes.

### Historique des QR codes

- Tous les QR codes générés sont enregistrés dans l'historique.
- Vous pouvez filtrer l'historique par type (récents, futurs, passés).
- Pour chaque entrée de l'historique, vous pouvez afficher les QR codes correspondants ou supprimer l'entrée.

## 5. Validation et export des feuilles d'heures

### Génération des feuilles d'heures

1. Sélectionnez une période (jour, semaine, mois) et une date.
2. Cliquez sur "Générer les feuilles d'heures".
3. Les feuilles d'heures sont créées pour chaque agent ayant pointé pendant la période sélectionnée.

### Validation des feuilles d'heures

Pour chaque feuille d'heures, vous pouvez :
- **Valider** : Approuver les heures travaillées.
- **Rejeter** : Refuser les heures travaillées en ajoutant un commentaire explicatif.
- **Exporter en PDF** : Générer un document PDF de la feuille d'heures individuelle.

### Export des données

- **Export individuel en PDF** : Génère un PDF pour une feuille d'heures spécifique, incluant tous les pointages et le calcul des heures travaillées.
- **Export global en CSV** : Exporte toutes les feuilles d'heures filtrées au format CSV pour une utilisation dans un tableur.

### Filtres et statistiques

- Filtrez par période (jour, semaine, mois), date et statut (en attente, validé, rejeté).
- Consultez les statistiques de validation et le total des heures travaillées.

## 6. Gestion des agents

### Ajout d'un nouvel agent

1. Saisissez le nom de l'agent.
2. Attribuez un code personnel à 4 chiffres unique.
3. Cliquez sur "Ajouter un agent".

### Modification des agents existants

Pour chaque agent, vous pouvez :
- Modifier son nom
- Modifier son code personnel
- Supprimer l'agent (attention, cette action est irréversible)

### Association IP/nom

L'application associe automatiquement les adresses IP aux noms des agents grâce au système de codes personnels. Cela permet à plusieurs agents de pointer depuis le même réseau WiFi sans conflit.

## Conclusion

Cette application de pointage offre une solution complète pour la gestion des heures de travail des agents municipaux. Grâce à ses fonctionnalités avancées (affichage en temps réel, alertes intelligentes, gestion des QR codes, validation et export), elle simplifie considérablement le suivi des pointages et la gestion administrative associée.

Pour toute question ou assistance supplémentaire, n'hésitez pas à contacter le support technique.
