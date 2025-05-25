import { useState } from 'react';
import { testRealtimeSync, testPostPointageRestriction } from '../utils/testUtils';

const TestSynchronisation = () => {
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [restrictionTestResult, setRestrictionTestResult] = useState<any>(null);

  const runSyncTest = () => {
    setLoading(true);
    testRealtimeSync((result) => {
      setTestResults(result);
      setLoading(false);
    });
  };

  const runRestrictionTest = () => {
    const result = testPostPointageRestriction();
    setRestrictionTestResult(result);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-blue-800 mb-6">
          Tests de Synchronisation Firebase
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-blue-700 mb-4">
            Test de Synchronisation Multi-Appareils
          </h2>
          
          <p className="mb-4 text-gray-700">
            Ce test vérifie que les données écrites dans Firebase sont bien accessibles en lecture,
            simulant ainsi l'utilisation depuis plusieurs appareils.
          </p>
          
          <button
            onClick={runSyncTest}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 mb-4"
          >
            {loading ? 'Test en cours...' : 'Lancer le test de synchronisation'}
          </button>
          
          {testResults && (
            <div className={`p-4 rounded-lg ${testResults.success ? 'bg-green-100' : 'bg-red-100'} mb-4`}>
              <p className={`font-bold ${testResults.success ? 'text-green-700' : 'text-red-700'}`}>
                {testResults.success ? 'Succès' : 'Échec'}
              </p>
              <p className="text-gray-700">{testResults.message}</p>
              <p className="text-gray-700 mt-2">Nombre de documents lus: {testResults.records.length}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-blue-700 mb-4">
            Test de Restriction Post-Pointage
          </h2>
          
          <p className="mb-4 text-gray-700">
            Ce test vérifie que la navigation est bien restreinte après un pointage.
          </p>
          
          <button
            onClick={runRestrictionTest}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 mb-4"
          >
            Tester la restriction post-pointage
          </button>
          
          {restrictionTestResult && (
            <div className={`p-4 rounded-lg ${restrictionTestResult.isRestricted ? 'bg-green-100' : 'bg-red-100'} mb-4`}>
              <p className={`font-bold ${restrictionTestResult.isRestricted ? 'text-green-700' : 'text-red-700'}`}>
                {restrictionTestResult.isRestricted ? 'Restriction active' : 'Restriction inactive'}
              </p>
              <p className="text-gray-700">Navigation arrière possible: {restrictionTestResult.canGoBack ? 'Oui' : 'Non'}</p>
              <p className="text-gray-700">Liens de navigation présents: {restrictionTestResult.hasNavigationLinks ? 'Oui' : 'Non'}</p>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-blue-600 hover:text-blue-800">
            Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  );
};

export default TestSynchronisation;
