import React, { useState, useEffect } from 'react';
import { openDB } from 'idb';

const DB_NAME = 'sa-inbound-tracker-db';
const DB_VERSION = 1;
const SCHEDULE_STORE = 'vessel-schedules';
const PORT_STORE = 'ports';
const VESSEL_STORE = 'vessels';

const DatabaseInspector = () => {
  const [dbStatus, setDbStatus] = useState('Checking database...');
  const [storeData, setStoreData] = useState({
    schedules: { count: 0, sample: null },
    ports: { count: 0, sample: null },
    vessels: { count: 0, sample: null }
  });
  const [selectedStore, setSelectedStore] = useState('schedules');
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if database exists and get basic info
  useEffect(() => {
    const checkDatabase = async () => {
      try {
        setIsLoading(true);
        const db = await openDB(DB_NAME, DB_VERSION);
        
        // Check if stores exist
        const storeNames = db.objectStoreNames;
        
        setDbStatus(`Database found with stores: ${Array.from(storeNames).join(', ')}`);
        
        // Get counts and samples from each store
        const data = {
          schedules: await getStoreInfo(db, SCHEDULE_STORE),
          ports: await getStoreInfo(db, PORT_STORE),
          vessels: await getStoreInfo(db, VESSEL_STORE)
        };
        
        setStoreData(data);
        
        // Load records from the initially selected store
        await loadRecords(db, selectedStore);
        
        db.close();
      } catch (err) {
        console.error('Error inspecting database:', err);
        setError(`Database error: ${err.message}`);
        setDbStatus('Database not found or error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkDatabase();
  }, [selectedStore]);
  
  // Get basic info about a store (count and sample)
  const getStoreInfo = async (db, storeName) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        return { count: 0, sample: null };
      }
      
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      
      // Get count
      const count = await store.count();
      
      // Get a sample record
      const sample = count > 0 ? await store.getAll(null, 1) : null;
      
      await tx.done;
      
      return {
        count,
        sample: sample && sample.length > 0 ? sample[0] : null
      };
    } catch (err) {
      console.error(`Error getting info for store ${storeName}:`, err);
      return { count: 0, sample: null, error: err.message };
    }
  };
  
  // Load all records from a specific store
  const loadRecords = async (dbInstance, storeName) => {
    try {
      setIsLoading(true);
      
      const db = dbInstance || await openDB(DB_NAME, DB_VERSION);
      
      if (!db.objectStoreNames.contains(storeName)) {
        setRecords([]);
        setError(`Store "${storeName}" does not exist`);
        return;
      }
      
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      
      const allRecords = await store.getAll();
      
      setRecords(allRecords);
      setError(null);
      
      await tx.done;
      
      if (!dbInstance) {
        db.close();
      }
    } catch (err) {
      console.error(`Error loading records from ${storeName}:`, err);
      setError(`Failed to load records: ${err.message}`);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle store selection change
  const handleStoreChange = async (e) => {
    const newStore = e.target.value;
    setSelectedStore(newStore);
    
    try {
      const db = await openDB(DB_NAME, DB_VERSION);
      await loadRecords(db, newStore);
      db.close();
    } catch (err) {
      setError(`Failed to switch store: ${err.message}`);
    }
  };
  
  // Clear all data from the database
  const handleClearDatabase = async () => {
    if (!window.confirm('Are you sure you want to clear all database data? This cannot be undone.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      const db = await openDB(DB_NAME, DB_VERSION);
      
      // Clear all stores
      const tx = db.transaction([SCHEDULE_STORE, PORT_STORE, VESSEL_STORE], 'readwrite');
      await tx.objectStore(SCHEDULE_STORE).clear();
      await tx.objectStore(PORT_STORE).clear();
      await tx.objectStore(VESSEL_STORE).clear();
      
      await tx.done;
      db.close();
      
      // Refresh data
      const refreshDb = await openDB(DB_NAME, DB_VERSION);
      
      const data = {
        schedules: await getStoreInfo(refreshDb, SCHEDULE_STORE),
        ports: await getStoreInfo(refreshDb, PORT_STORE),
        vessels: await getStoreInfo(refreshDb, VESSEL_STORE)
      };
      
      setStoreData(data);
      await loadRecords(refreshDb, selectedStore);
      
      refreshDb.close();
      
      setDbStatus('Database cleared successfully');
    } catch (err) {
      console.error('Error clearing database:', err);
      setError(`Failed to clear database: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format JSON for display
  const formatJson = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (err) {
      return 'Error formatting JSON';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Database Inspector</h2>
      
      <div className="mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800">Database Status</h3>
          <p className="text-blue-700">{dbStatus}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold">Schedules</h3>
          <p>Count: {storeData.schedules.count}</p>
          {storeData.schedules.count > 0 && (
            <p className="text-sm text-gray-500">Last updated: {storeData.schedules.sample?.fetchDate ? new Date(storeData.schedules.sample.fetchDate).toLocaleString() : 'Unknown'}</p>
          )}
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold">Ports</h3>
          <p>Count: {storeData.ports.count}</p>
          {storeData.ports.count > 0 && (
            <p className="text-sm text-gray-500">Sample: {storeData.ports.sample?.name || 'N/A'} ({storeData.ports.sample?.code || 'N/A'})</p>
          )}
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold">Vessels</h3>
          <p>Count: {storeData.vessels.count}</p>
          {storeData.vessels.count > 0 && (
            <p className="text-sm text-gray-500">Sample: {storeData.vessels.sample?.name || 'N/A'} (IMO: {storeData.vessels.sample?.imo || 'N/A'})</p>
          )}
        </div>
      </div>
      
      <div className="mb-4 flex justify-between items-center">
        <div>
          <label htmlFor="storeSelect" className="mr-2 font-medium">View Records:</label>
          <select
            id="storeSelect"
            value={selectedStore}
            onChange={handleStoreChange}
            className="border rounded px-2 py-1"
            disabled={isLoading}
          >
            <option value="schedules">Vessel Schedules</option>
            <option value="ports">Ports</option>
            <option value="vessels">Vessels</option>
          </select>
        </div>
        
        <button
          onClick={handleClearDatabase}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          disabled={isLoading}
        >
          Clear Database
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : (
        <div>
          <h3 className="font-semibold mb-2">Records ({records.length})</h3>
          
          {records.length === 0 ? (
            <p className="text-gray-500">No records found in this store</p>
          ) : (
            <div className="overflow-auto max-h-96 border rounded-lg">
              <pre className="p-4 text-sm">{formatJson(records)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DatabaseInspector;
