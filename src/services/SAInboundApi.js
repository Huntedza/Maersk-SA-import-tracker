// src/services/SAInboundApi.js
// SA Inbound/Export focused API service using the vessel schedule endpoint.

import { DatabaseService } from './DatabaseService';
import { ScheduleCache } from './ScheduleCache';
import { processVesselSchedule } from '../utils/VesselScheduleProcessor';

// API Configuration
const API_KEY = process.env.REACT_APP_MAERSK_API_KEY;
const API_BASE_URL = 'https://api.maersk.com/schedules';

const USE_MOCK_DATA = process.env.REACT_APP_USE_MOCK_DATA === 'true';
const CARRIER_CODE = 'MAEU';
const CACHE_KEY = 'SA_INBOUND';
const LOG_API_REQUESTS = process.env.REACT_APP_LOG_API_REQUESTS === 'true' || true;

// SA Port configurations
const SA_PORTS = {
  DURBAN: { name: 'Durban', UNLocationCode: 'ZADUR' },
  CAPE_TOWN: { name: 'Cape Town', UNLocationCode: 'ZACPT' },
  PORT_ELIZABETH: { name: 'Port Elizabeth', UNLocationCode: 'ZAPLZ' },
  PORT_COEGA: { name: 'Port Coega', UNLocationCode: 'ZAZBA' }
};

// SA Port codes for port-calls API
const SA_PORT_CONFIGS = [
  { cityName: 'Cape Town', countryCode: 'ZA' },
  { cityName: 'Durban', countryCode: 'ZA' },
  { cityName: 'Port Elizabeth', countryCode: 'ZA' },
  { cityName: 'Port Coega', countryCode: 'ZA' }
];

// Helper function to get all SA port codes
export const getSAPortCodes = () => ['ZACPT', 'ZADUR', 'ZAPLZ', 'ZAZBA'];

// Dynamic vessel discovery only - no hardcoded IMOs


const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const getStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 60);
  return date.toISOString().split('T')[0];
};

const fetchApiData = async (url, retryCount = 2) => {
  const headers = {
    'Consumer-Key': API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (LOG_API_REQUESTS) {
    console.log('--- API Request ---');
    console.log('URL:', url);
    console.log('-------------------');
  }
  
  try {
    const response = await fetch(url, { method: 'GET', headers });
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('--- API Error Response ---', { status: response.status, body: errorBody });
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (LOG_API_REQUESTS) {
      console.log('--- API Success ---');
    }
    
    return data;
  } catch (error) {
    console.error('API fetch error:', error);
    if (retryCount > 0) {
      console.log(`Retrying... ${retryCount} attempts left`);
      await delay(1000);
      return fetchApiData(url, retryCount - 1);
    }
    throw error;
  }
};

// Step 1: Fetch active vessels from SA ports (with future departures)
const fetchActiveVesselsFromSAPorts = async () => {
  const startDate = getStartDate();
  const dateRange = 'P17W';
  const activeVessels = new Map();

  for (const port of SA_PORT_CONFIGS) {
    const url = `${API_BASE_URL}/port-calls?countryCode=${port.countryCode}&cityName=${encodeURIComponent(port.cityName)}&carrierCodes=${CARRIER_CODE}&startDate=${startDate}&dateRange=${dateRange}`;
    
    try {
      const portData = await fetchApiData(url);
      
      if (portData?.portCalls) {
        portData.portCalls.forEach(portCall => {
          portCall.facilityCalls.forEach(facilityCall => {
            const transport = facilityCall.transport;
            if (transport?.vessel?.vesselIMONumber && transport?.vessel?.vesselName) {
              const imo = transport.vessel.vesselIMONumber;
              const name = transport.vessel.vesselName;
              
              if (!activeVessels.has(imo)) {
                activeVessels.set(imo, {
                  imo: imo,
                  name: name,
                  ports: new Set()
                });
              }
              activeVessels.get(imo).ports.add(port.cityName);
            }
          });
        });
      }
      
      await delay(200); // Rate limiting between port calls
    } catch (error) {
      console.error(`Error fetching port calls for ${port.cityName}:`, error);
    }
  }

  const vessels = Array.from(activeVessels.values()).map(v => ({
    ...v,
    ports: Array.from(v.ports)
  }));
  
  console.log(`Found ${vessels.length} active vessels across SA ports`);
  console.log('Sample vessels:', vessels.slice(0, 5).map(v => ({ name: v.name, imo: v.imo, ports: v.ports })));
  return vessels;
};

// Step 2: Fetch detailed vessel schedule
const fetchVesselSchedule = async (imo) => {
  const startDate = getStartDate();
  const url = `${API_BASE_URL}/vessel-schedules?vesselIMONumber=${imo.trim()}&carrierCodes=${CARRIER_CODE}&startDate=${startDate}&dateRange=P17W`;
  try {
    const response = await fetchApiData(url);
    if (response) {
      console.log(`✓ Found schedule data for IMO: ${imo}`);
      return response;
    }
    console.warn(`No vessel schedule found for IMO: ${imo}`);
    return null;
  } catch (error) {
    console.error(`Error fetching vessel schedule for IMO ${imo}:`, error);
    return null;
  }
};

const fetchSAInboundSchedules = async () => {
  try {
    console.log('=== fetchSAInboundSchedules (port-calls + vessel-schedules) ===');
    
    if (USE_MOCK_DATA) {
      console.log('Mock data is not applicable for this API strategy.');
      return { allImports: [] };
    }

    if (ScheduleCache.isCacheValid(CACHE_KEY)) {
      const cachedData = ScheduleCache.getCache(CACHE_KEY);
      if (cachedData) {
        console.log('Using memory cache for schedules');
        return cachedData;
      }
    }

    console.log('Fetching active vessels from SA ports...');
    const activeVessels = await fetchActiveVesselsFromSAPorts();
    
    if (activeVessels.length === 0) {
      console.warn('No active vessels found in SA ports');
      return { allImports: [] };
    }

    console.log(`Processing ${activeVessels.length} discovered vessels`);
    let allImports = [];
    const vessels = new Map();

    // Process all discovered vessels to capture all SAECS services
    const vesselsToProcess = activeVessels;

    for (const vessel of vesselsToProcess) {
      const vesselSchedule = await fetchVesselSchedule(vessel.imo);
      if (vesselSchedule) {
        vessels.set(vessel.imo, {
          name: vessel.name,
          imo: vessel.imo,
          ports: vessel.ports,
          schedule: vesselSchedule
        });
        
        try {
          const processedImports = processVesselSchedule(vesselSchedule);
          allImports.push(...processedImports);
        } catch (error) {
          console.log(`Could not process schedule for ${vessel.name}: ${error.message}`);
        }
      }
      await delay(500);
    }

    allImports.sort((a, b) => new Date(a.schedule.eta.rawDateTime || 0) - new Date(b.schedule.eta.rawDateTime || 0));

    const finalData = {
      current: {
        vessels: Array.from(vessels.values()),
        imports: allImports,
        exports: [],
        loadPorts: [],
      },
      summary: {
        totalImports: allImports.length,
        totalVessels: vessels.size,
        ports: Object.values(SA_PORTS),
      },
      allImports: allImports,
    };

    await DatabaseService.saveSchedules(finalData);
    console.log('Successfully saved schedules to database');

    ScheduleCache.setCache(CACHE_KEY, finalData);
    
    return finalData;

  } catch (error) {
    console.error('Error in fetchSAInboundSchedules:', error);
    try {
      console.log('Attempting to retrieve data from database as fallback...');
      const dbData = await DatabaseService.getLatestSchedules();
      if (dbData && Object.keys(dbData).length > 0) {
        console.log('Successfully retrieved fallback data from database');
        return dbData;
      }
    } catch (dbError) {
      console.error('Error retrieving fallback data from database:', dbError);
    }
    return { allImports: [] };
  }
};

export { fetchSAInboundSchedules, SA_PORTS };