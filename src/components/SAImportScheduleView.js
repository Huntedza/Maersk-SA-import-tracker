import React, { useState, useEffect } from 'react';
import { Sun, Moon, Ship, Anchor, AlertTriangle, Clock, ChevronDown } from 'lucide-react';
import { fetchSAInboundSchedules, getSAPortCodes } from '../services/SAInboundApi';
import { DatabaseService } from '../services/DatabaseService';
import { backgroundRefreshService } from '../services/BackgroundRefreshService';
import LoadingIndicator from './LoadingIndicator';
import ExportDropdown from './ExportDropdown';
import ScheduleGrid from './ScheduleGrid';
import RefreshButton from './RefreshButton';

const VESSELS_PER_GRID = 5;
const MAX_TOTAL_VESSELS = 16; // 2 grids of 8 vessels each




const SAImportScheduleView = () => {
  const [scheduleData, setScheduleData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeService, setActiveService] = useState('SAECS');
  const [showDelayedOnly, setShowDelayedOnly] = useState(false);
  const [backgroundStatus, setBackgroundStatus] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('color-theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      // Default to dark mode if no preference is saved
      return true;
    }
    return true; // Default to dark mode
  });

  // Theme toggle effect
  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (isDark) {
      root.classList.add('dark');
      body.classList.add('dark');
      localStorage.setItem('color-theme', 'dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      localStorage.setItem('color-theme', 'light');
    }
  }, [isDark]);

  // Fast cache refresh - just reload from database
  const refreshFromCache = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await DatabaseService.getLatestSchedules();
      
      if (data) {
        setScheduleData(data);
        setLastRefreshTime(new Date());
        console.log('✅ Fast refresh from cache completed');
      } else {
        throw new Error('No cached data available');
      }
    } catch (error) {
      console.error('Error refreshing from cache:', error);
      setError(`Cache refresh failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Legacy function - force API refresh (slow)
  const forceApiRefresh = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setScheduleData(null); // Clear to show progress
      
      const data = await fetchSAInboundSchedules();
      if (data) {
        await DatabaseService.saveSchedules(data);
        setScheduleData(data);
        setLastRefreshTime(new Date());
        console.log('✅ Force API refresh completed');
      } else {
        throw new Error('No data received from API');
      }
    } catch (error) {
      console.error('Error in force API refresh:', error);
      setError(`API refresh failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Main load function - tries cache first, API if needed
  const loadScheduleData = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (forceRefresh) {
        setScheduleData(null);
      }

      let data = await DatabaseService.getLatestSchedules();

      if (!data || forceRefresh) {
        data = await fetchSAInboundSchedules();
        if (data) {
          await DatabaseService.saveSchedules(data);
        }
      }

      if (data) {
        setScheduleData(data);
        setLastRefreshTime(new Date());
      }
    } catch (error) {
      console.error('Error loading schedule data:', error);
      setError('Failed to load schedule data. Please try again.');
      setScheduleData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    loadScheduleData(false);
  }, []);

  // Set up background refresh service listeners
  useEffect(() => {
    const handleBackgroundRefresh = (event, data) => {
      switch (event) {
        case 'refresh_started':
          setBackgroundStatus('Updating data in background...');
          break;
        case 'refresh_completed':
          setBackgroundStatus(null);
          // Silently reload from cache to get fresh data
          refreshFromCache();
          break;
        case 'refresh_failed':
        case 'refresh_error':
          setBackgroundStatus(null);
          console.warn('Background refresh failed:', data);
          break;
      }
    };

    // Add listener
    backgroundRefreshService.addListener(handleBackgroundRefresh);

    // Cleanup listener on unmount
    return () => {
      backgroundRefreshService.removeListener(handleBackgroundRefresh);
    };
  }, []);

  if (isLoading) return <LoadingIndicator />;
  if (error) return (
    <div className="flex justify-center items-center h-64">
      <div className="text-red-600 dark:text-red-400">{error}</div>
    </div>
  );
  if (!scheduleData) return (
    <div className="flex justify-center items-center h-64">
      <div className="text-gray-600 dark:text-gray-300">No schedule data available</div>
    </div>
  );

  // Extract unique service names from actual data
  const getUniqueServices = () => {
    if (!scheduleData?.current?.vessels) return [];
    
    // Collect services with their SA arrival counts
    const serviceStats = {};
    
    scheduleData.current.vessels.forEach(vessel => {
      if (vessel.schedule?.vesselCalls) {
        vessel.schedule.vesselCalls.forEach(call => {
          const serviceName = call.transport?.inboundService?.carrierServiceName;
          if (serviceName) {
            if (!serviceStats[serviceName]) {
              serviceStats[serviceName] = {
                vessels: new Set(),
                saArrivals: 0
              };
            }
            
            serviceStats[serviceName].vessels.add(vessel.name);
            
            // Count SA arrivals for this service
            if (getSAPortCodes().includes(call.facility?.UNLocationCode)) {
              serviceStats[serviceName].saArrivals++;
            }
          }
        });
      }
    });
    
    // Define services to exclude (problematic/test services)
    const EXCLUDED_SERVICES = [
      // Extraloader services (special operations)
      'EMPTY EXTRALOADER (APA)',
      'AC EXTRALOADER',
      'EUROPE/FAR EAST EXTRALOADER',
      'EXTRALOADER (WCA)',
      
      // Shuttle services (short-haul)
      'SHUTTLE A6',
      'SHUTTLE E10',
      'SHUTTLE E15',
      'TEMA-DAKAR SHUTTLE',
      
      // Feeder services (regional)
      'ZAPLZ - ZADUR OACL FEEDER',
      
      // Cryptic/test codes
      'FEW3',
      'FEW5',
      'AE15',
      'NEOASAS',
      'SAFINA'
    ];

    // Filter out services with no SA arrivals and excluded services
    const servicesWithSAData = Object.entries(serviceStats)
      .filter(([name, stats]) => stats.saArrivals > 0)
      .filter(([name]) => !EXCLUDED_SERVICES.includes(name))
      .map(([name, stats]) => ({
        name: name,
        vesselCount: stats.vessels.size,
        saArrivals: stats.saArrivals,
        label: getServiceLabel(name)
      }));
    
    // Define priority order
    const priorityOrder = [
      'SAECS',
      'MESAWA', 
      'SAFARI I SERVICE',
      'PROTEA',
      'WAF7',
      'WAFEX'
    ];
    
    // Sort: priority services first, then others by vessel count
    const priorityServices = priorityOrder
      .map(priorityName => servicesWithSAData.find(s => s.name === priorityName))
      .filter(Boolean); // Remove undefined entries
    
    const otherServices = servicesWithSAData
      .filter(service => !priorityOrder.includes(service.name))
      .sort((a, b) => b.vesselCount - a.vesselCount);
    
    return [...priorityServices, ...otherServices];
  };
  
  const getServiceLabel = (name) => {
    const labelMap = {
      'SAECS': 'SAECS Service',
      'MESAWA': 'MESAWA Service',
      'SAFARI I SERVICE': 'Safari Service',
      'PROTEA': 'Protea Service',
      'WAF7': 'WAF7 Service',
      'WAFEX': 'WAFEX Service',
      'AMERICAN EXPRESS SERVICE - SCL': 'American Express',
      'PORT LOUIS - TOAMASINA FDR': 'Port Louis Service',
      'ZAPLZ - ZADUR OACL FEEDER': 'Local Feeder'
    };
    
    return labelMap[name] || name;
  };

  const services = getUniqueServices();

  // Helper function to get the last POD (Port of Discharge) date for a vessel
  const getLastPODDate = (vessel) => {
    if (!vessel.schedule?.vesselCalls) return null;
    
    const saPortCodes = getSAPortCodes(); // South African discharge ports
    let lastPODDate = null;
    
    vessel.schedule.vesselCalls.forEach((call, index) => {
      if (saPortCodes.includes(call.facility?.UNLocationCode)) {
        call.callSchedules?.forEach((schedule, schedIndex) => {
          if (schedule.transportEventTypeCode === 'DEPT' || schedule.transportEventTypeCode === 'DEPA') { // Departure from SA port (estimated or actual)
            const scheduleDate = new Date(schedule.classifierDateTime);
            if (!lastPODDate || scheduleDate > lastPODDate) {
              lastPODDate = scheduleDate;
            }
          }
        });
      }
    });
    
    return lastPODDate;
  };

  // Check if vessel should be filtered out - keep if has future SA arrivals OR within service drop-off period
  const isVesselActive = (vessel) => {
    if (!vessel.schedule?.vesselCalls) return false;
    
    const now = new Date();
    const saPortCodes = getSAPortCodes();
    
    // Define service-specific drop-off periods (days after last POD departure)
    const dropOffPeriods = {
      'SAECS': 5,           // 5 days for SAECS
      'MESAWA': 7,          // 7 days for MESAWA (longer cycle)
      'SAFARI I SERVICE': 5, // 5 days for Safari
      'PROTEA': 5,          // 5 days for Protea
      'WAF7': 7,            // 7 days for WAF7 (West Africa)
      'WAFEX': 7,           // 7 days for WAFEX
      'AMERICAN EXPRESS SERVICE - SCL': 5 // 5 days for American Express
    };
    
    const dropOffDays = dropOffPeriods[activeService] || 5; // Default 5 days
    
    // Check for future SA arrivals with the active service - must be STRICT
    const hasFutureSAArrivals = vessel.schedule.vesselCalls.some(call => {
      // Must be SA port
      if (!saPortCodes.includes(call.facility?.UNLocationCode)) return false;
      // Must have inbound service matching active service
      if (call.transport?.inboundService?.carrierServiceName !== activeService) return false;
      
      const arrivalSchedule = call.callSchedules?.find(schedule => 
        schedule.transportEventTypeCode === 'ARRI'
      );
      
      if (arrivalSchedule) {
        const arrivalDate = new Date(arrivalSchedule.classifierDateTime);
        const isFuture = arrivalDate > now;
        
        
        return isFuture;
      }
      return false;
    });
    
    if (hasFutureSAArrivals) {
      return true;
    }
    
    // Fallback: Check if sailed within service drop-off period from last POD
    const lastPODDate = getLastPODDate(vessel);
    if (!lastPODDate) {
      return true; // Default to active if no POD date found
    }
    
    const daysSinceLastPOD = (now - lastPODDate) / (1000 * 60 * 60 * 24);
    return daysSinceLastPOD <= dropOffDays;
  };

  // Helper function to detect if a vessel has any delays
  const hasVesselDelays = (vessel) => {
    if (!vessel.schedule?.vesselCalls) return false;
    
    // Check all vessel calls for delays
    return vessel.schedule.vesselCalls.some(call => {
      if (!call.callSchedules) return false;
      
      // Group schedules by event type
      const schedulesByEvent = {};
      call.callSchedules.forEach(schedule => {
        const eventType = schedule.transportEventTypeCode;
        if (!schedulesByEvent[eventType]) {
          schedulesByEvent[eventType] = [];
        }
        schedulesByEvent[eventType].push(schedule);
      });
      
      // Check for delays in arrival events
      ['ARRI', 'DEPA'].forEach(eventType => {
        const schedules = schedulesByEvent[eventType] || [];
        const estimates = schedules.filter(s => s.eventClassifierCode === 'EST');
        
        if (estimates.length > 1) {
          // Multiple estimates suggest date changes (potential delays)
          const sorted = estimates.sort((a, b) => new Date(a.classifierDateTime) - new Date(b.classifierDateTime));
          const original = new Date(sorted[0].classifierDateTime);
          const latest = new Date(sorted[sorted.length - 1].classifierDateTime);
          const delayHours = Math.round((latest - original) / (1000 * 60 * 60));
          
          if (delayHours > 6) { // Consider >6 hours as significant delay
            return true;
          }
        }
      });
      
      return false;
    });
  };

  // Get vessels for the active service - merge multiple records for same vessel
  const getVesselsForService = () => {
    if (!scheduleData?.current?.vessels || !activeService) return [];
    
    
    const serviceVessels = scheduleData.current.vessels.filter(vessel => {
      if (!vessel.schedule?.vesselCalls) return false;
      
      // Exclude SANTA URSULA as it's a special SAECS loader, not part of standard rotation
      if (vessel.name === 'SANTA URSULA') return false;
      
      // Check if any vessel call has the active service
      const hasService = vessel.schedule.vesselCalls.some(call => 
        call.transport?.inboundService?.carrierServiceName === activeService ||
        call.transport?.outboundService?.carrierServiceName === activeService
      );
      
      if (hasService) {
        console.log(`✅ Found vessel for ${activeService}: ${vessel.name}`);
      }
      
      return hasService;
    });
    
    console.log(`🚢 Found ${serviceVessels.length} vessels for ${activeService}`);

    // REMOVED: Special SANTA CLARA handling that was causing drop-off issues
    // The vessel filtering and drop-off logic should handle all vessels consistently
    // without special exceptions that bypass proper timeline filtering

    // Merge multiple records for the same vessel (by IMO number)
    const mergedVessels = {};
    serviceVessels.forEach(vessel => {
      const key = vessel.imo || vessel.name;
      if (!mergedVessels[key]) {
        mergedVessels[key] = {
          ...vessel,
          schedule: {
            ...vessel.schedule,
            vesselCalls: [...vessel.schedule.vesselCalls]
          }
        };
      } else {
        // Merge vessel calls from multiple records
        mergedVessels[key].schedule.vesselCalls.push(...vessel.schedule.vesselCalls);
      }
    });

    const uniqueVessels = Object.values(mergedVessels);

    // Filter out vessels that have sailed beyond service drop-off period
    console.log(`🔍 Filtering ${uniqueVessels.length} vessels for ${activeService} service activity...`);
    let filteredVessels = uniqueVessels.filter(vessel => {
      const isActive = isVesselActive(vessel);
      console.log(`🔍 ${vessel.name}: Active = ${isActive}`);
      return isActive;
    });
    
    // Apply delay filter if enabled
    if (showDelayedOnly) {
      filteredVessels = filteredVessels.filter(vessel => {
        const hasDelays = hasVesselDelays(vessel);
        console.log(`🚨 ${vessel.name}: Has delays = ${hasDelays}`);
        return hasDelays;
      });
    }
    
    // Limit to maximum 16 vessels (2 grids of 8 each)
    return filteredVessels.slice(0, MAX_TOTAL_VESSELS);
  };

  const serviceVessels = getVesselsForService();

  // Sort vessels by voyage number for MESAWA, departure date for others
  const sortedVessels = serviceVessels.sort((a, b) => {
    // Special sorting for MESAWA - use voyage number instead of departure dates
    if (activeService === 'MESAWA') {
      const getTargetVoyageNumber = (vessel) => {
        if (!vessel.schedule?.vesselCalls) return null;
        
        const now = new Date();
        
        // Find SA arrivals for MESAWA - ONLY consider INBOUND voyages ending in 'E'
        const saArrivals = vessel.schedule.vesselCalls
          .filter(call => getSAPortCodes().includes(call.facility?.UNLocationCode))
          .filter(call => call.transport?.inboundService?.carrierServiceName === 'MESAWA')
          .map(call => ({
            call,
            voyage: call.transport.inboundService.carrierVoyageNumber,
            arrivalDate: call.callSchedules?.find(s => s.transportEventTypeCode === 'ARRI')?.classifierDateTime
          }))
          .filter(item => item.arrivalDate && item.voyage)
          // Filter to only INBOUND voyages (ending in 'E' for MESAWA)
          .filter(item => item.voyage && item.voyage.endsWith('E'));

        console.log(`🔍 MESAWA ${vessel.name} - Found inbound voyages:`, saArrivals.map(a => a.voyage));

        // Group by voyage and find voyage with future arrivals
        const voyageGroups = {};
        saArrivals.forEach(arrival => {
          if (!voyageGroups[arrival.voyage]) {
            voyageGroups[arrival.voyage] = [];
          }
          voyageGroups[arrival.voyage].push(arrival);
        });

        // Find voyage with future arrivals, prefer earliest future arrival
        let targetVoyage = null;
        let earliestFutureDate = null;

        for (const [voyage, arrivals] of Object.entries(voyageGroups)) {
          const futureArrivals = arrivals.filter(a => new Date(a.arrivalDate) > now);
          if (futureArrivals.length > 0) {
            const earliestInVoyage = futureArrivals.sort((a, b) => new Date(a.arrivalDate) - new Date(b.arrivalDate))[0];
            if (!earliestFutureDate || new Date(earliestInVoyage.arrivalDate) < earliestFutureDate) {
              targetVoyage = voyage;
              earliestFutureDate = new Date(earliestInVoyage.arrivalDate);
            }
          }
        }

        // Fallback to most recent past voyage if no future arrivals
        if (!targetVoyage) {
          const pastArrivals = saArrivals
            .filter(a => new Date(a.arrivalDate) <= now)
            .sort((a, b) => new Date(b.arrivalDate) - new Date(a.arrivalDate));
          
          if (pastArrivals.length > 0) {
            targetVoyage = pastArrivals[0].voyage;
          }
        }

        console.log(`🎯 MESAWA ${vessel.name} - Target inbound voyage: ${targetVoyage}`);
        return targetVoyage;
      };

      const voyageA = getTargetVoyageNumber(a);
      const voyageB = getTargetVoyageNumber(b);
      
      console.log(`🔄 MESAWA Sorting: ${a.name} voyage ${voyageA} vs ${b.name} voyage ${voyageB}`);
      
      // Sort by voyage number numerically if both have voyages
      if (voyageA && voyageB) {
        // Extract numeric part from voyage numbers (e.g., "MW124" -> 124)
        const extractNumber = (voyage) => {
          const match = voyage.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        };
        
        const numA = extractNumber(voyageA);
        const numB = extractNumber(voyageB);
        
        const result = numA - numB;
        console.log(`📊 MESAWA Voyage comparison: ${voyageA} (${numA}) vs ${voyageB} (${numB}) = ${result < 0 ? 'A first' : 'B first'}`);
        return result;
      }
      
      // If only one has voyage, prioritize it
      if (voyageA && !voyageB) return -1;
      if (!voyageA && voyageB) return 1;
      
      // Fallback to name sorting
      return (a.name || '').localeCompare(b.name || '');
    }

    // Original logic for other services (SAECS, etc.)
    const getTargetVoyage = (vessel) => {
      if (!vessel.schedule?.vesselCalls) return null;
      
      const now = new Date();
      
      // Find all SA arrivals - keep SAECS logic unchanged, add others
      let saArrivals;
      if (activeService === 'SAECS') {
        // Keep existing SAECS logic exactly as-is
        saArrivals = vessel.schedule.vesselCalls
          .filter(call => getSAPortCodes().includes(call.facility?.UNLocationCode))
          .filter(call => call.transport?.inboundService?.carrierServiceName === 'SAECS')
      } else {
        // New logic for other services
        saArrivals = vessel.schedule.vesselCalls
          .filter(call => getSAPortCodes().includes(call.facility?.UNLocationCode))
          .filter(call => call.transport?.inboundService?.carrierServiceName === activeService)
      }
      saArrivals = saArrivals
        .map(call => ({
          call,
          voyage: call.transport.inboundService.carrierVoyageNumber,
          arrivalDate: call.callSchedules?.find(s => s.transportEventTypeCode === 'ARRI')?.classifierDateTime
        }))
        .filter(item => item.arrivalDate && item.voyage);

      // Group by voyage and find voyage with future arrivals
      const voyageGroups = {};
      saArrivals.forEach(arrival => {
        if (!voyageGroups[arrival.voyage]) {
          voyageGroups[arrival.voyage] = [];
        }
        voyageGroups[arrival.voyage].push(arrival);
      });

      // Find voyage with future arrivals, prefer earliest future arrival
      let targetVoyage = null;
      let earliestFutureDate = null;

      for (const [voyage, arrivals] of Object.entries(voyageGroups)) {
        const futureArrivals = arrivals.filter(a => new Date(a.arrivalDate) > now);
        if (futureArrivals.length > 0) {
          const earliestInVoyage = futureArrivals.sort((a, b) => new Date(a.arrivalDate) - new Date(b.arrivalDate))[0];
          if (!earliestFutureDate || new Date(earliestInVoyage.arrivalDate) < earliestFutureDate) {
            targetVoyage = voyage;
            earliestFutureDate = new Date(earliestInVoyage.arrivalDate);
          }
        }
      }

      // Fallback to most recent past voyage if no future arrivals
      if (!targetVoyage) {
        const pastArrivals = saArrivals
          .filter(a => new Date(a.arrivalDate) <= now)
          .sort((a, b) => new Date(b.arrivalDate) - new Date(a.arrivalDate));
        
        if (pastArrivals.length > 0) {
          targetVoyage = pastArrivals[0].voyage;
        }
      }

      return targetVoyage;
    };

    const getLoadPortsForService = (serviceName) => {
      switch (serviceName) {
        case 'SAECS':
          return ['GBLGP', 'NLRTM', 'DEBRV', 'ESALG']; // London Gateway, Rotterdam, Bremerhaven, Algeciras
        case 'SAFARI I SERVICE':
          return ['MYTPP', 'MUPLU', 'HKHKG', 'CNSHA', 'CNNGB', 'CNSHK']; // Tanjung Pelepas, Port Louis, Hong Kong, Shanghai, Ningbo, Shekou
        case 'MESAWA':
          return ['AEJEA', 'INMUN', 'INNSA', 'CGPNR', 'GHTEM', 'NGAPP']; // Middle East/India first, then West Africa
        case 'PROTEA':
          return ['AEJEA', 'INMUN', 'INNSA']; // Jebel Ali, Mundra, Jawaharlal Nehru
        case 'WAF7':
          return ['MAPTM', 'GNCKY', 'ESALG', 'SLFNA', 'BJCOO']; // Port Tangier, Conakry, Algeciras, Freetown, Cotonou
        case 'WAFEX':
          return ['BRSSZ', 'BRPNG', 'BRITJ']; // Santos, Paranagua, Itajai
        case 'AMERICAN EXPRESS SERVICE - SCL':
          return ['USEWR', 'BSFPO', 'USCHS', 'USORF', 'USBAL', 'USPHL']; // Newark, Freeport, Charleston, Norfolk, Baltimore, Philadelphia
        case 'PORT LOUIS - TOAMASINA FDR':
          return ['MUPLU', 'MGTSN']; // Port Louis (Mauritius), Toamasina (Madagascar)
        default:
          return ['GBLGP', 'NLRTM', 'DEBRV']; // Default to European ports
      }
    };

    const getServiceDepartureDate = (vessel) => {
      if (!vessel.schedule?.vesselCalls) return null;
      
      const targetVoyage = getTargetVoyage(vessel);
      if (!targetVoyage) return null;
      
      // Define optimal departure ports for each service
      const servicePorts = {
        'SAECS': ['GBLGP', 'NLRTM', 'DEBRV', 'ESALG'], // European ports
        'SAFARI I SERVICE': ['MYTPP', 'MUPLU', 'HKHKG', 'CNSHA', 'CNNGB', 'CNSHK'], // Asia/Indian Ocean ports
        'MESAWA': ['AEJEA', 'INMUN', 'INNSA', 'CGPNR', 'GHTEM', 'NGAPP'], // Middle East/India first, then West Africa ports
        'PROTEA': ['AEJEA', 'INMUN', 'INNSA'], // Middle East/India ports
        'WAF7': ['MAPTM', 'GNCKY', 'ESALG', 'SLFNA', 'BJCOO'], // West Africa ports
        'WAFEX': ['BRSSZ', 'BRPNG', 'BRITJ'], // Brazil ports
        'AMERICAN EXPRESS SERVICE - SCL': ['USEWR', 'BSFPO', 'USCHS', 'USORF', 'USBAL', 'USPHL'], // US East Coast ports
        'PORT LOUIS - TOAMASINA FDR': ['MUPLU', 'MGTSN'] // Port Louis (Mauritius), Toamasina (Madagascar)
      };
      
      const departurePorts = servicePorts[activeService] || [];
      
      for (const portCode of departurePorts) {
        const departureCall = vessel.schedule.vesselCalls.find(call => 
          call.facility?.UNLocationCode === portCode &&
          call.transport?.outboundService?.carrierServiceName === activeService &&
          call.transport?.outboundService?.carrierVoyageNumber === targetVoyage &&
          call.callSchedules?.length > 0
        );
        
        if (departureCall) {
          const departureSchedule = departureCall.callSchedules.find(schedule => 
            schedule.transportEventTypeCode === 'DEPA'
          );
          if (departureSchedule) {
            const departureDate = new Date(departureSchedule.classifierDateTime);
            console.log(`🚢 ${vessel.name} voyage ${targetVoyage} departed ${portCode} on ${departureDate.toLocaleDateString()}`);
            return departureDate;
          }
        }
      }
      console.log(`⚠️ ${vessel.name} voyage ${targetVoyage} - No ${activeService} departure found`);
      return null;
    };
    
    const dateA = getServiceDepartureDate(a);
    const dateB = getServiceDepartureDate(b);
    
    // If both have departure dates, sort by date
    if (dateA && dateB) {
      const result = dateA - dateB; // Earliest departure first
      console.log(`📅 Sorting: ${a.name} (${dateA.toLocaleDateString()}) vs ${b.name} (${dateB.toLocaleDateString()}) = ${result < 0 ? 'A first' : 'B first'}`);
      return result;
    }
    
    // If only one has departure date, prioritize it
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    
    // Fallback to name sorting if no departure dates found
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB);
  });
  const primaryVessels = sortedVessels.slice(0, VESSELS_PER_GRID);
  const extendedVessels = sortedVessels.slice(VESSELS_PER_GRID, MAX_TOTAL_VESSELS);
  
  console.log(`📊 Primary vessels for ${activeService}: ${primaryVessels.length}`, primaryVessels.map(v => v.name));
  console.log(`📊 Extended vessels for ${activeService}: ${extendedVessels.length}`, extendedVessels.map(v => v.name));

  // Get load ports dynamically based on the active service
  const getLoadPortsForService = () => {
    if (!scheduleData?.current?.vessels || !activeService) return [];
    
    const serviceVessels = scheduleData.current.vessels.filter(vessel => {
      if (!vessel.schedule?.vesselCalls) return false;
      return vessel.schedule.vesselCalls.some(call => 
        call.transport?.inboundService?.carrierServiceName === activeService
      );
    });

    const loadPortsSet = new Set();
    
    // Define allowed POL ports for each service (based on actual database port codes)
    const allowedPortsByService = {
      'SAECS': ['GBLGP', 'NLRTM', 'DEBRV', 'ESALG'], // European ports
      'SAFARI I SERVICE': ['MYTPP', 'MUPLU', 'HKHKG', 'CNSHA', 'CNNGB', 'CNSHK'], // Asia/Indian Ocean ports
      'MESAWA': ['AEJEA', 'INMUN', 'INNSA', 'CGPNR', 'GHTEM', 'NGAPP'], // Middle East/India first, then West Africa ports
      'PROTEA': ['AEJEA', 'INMUN', 'INNSA'], // Middle East/India ports
      'WAF7': ['MAPTM', 'GNCKY', 'ESALG', 'SLFNA', 'BJCOO'], // West Africa ports
      'WAFEX': ['BRSSZ', 'BRPNG', 'BRITJ'], // Brazil ports
      'AMERICAN EXPRESS SERVICE - SCL': ['USEWR', 'BSFPO', 'USCHS', 'USORF', 'USBAL', 'USPHL'], // US East Coast ports
      'PORT LOUIS - TOAMASINA FDR': ['MUPLU', 'MGTSN'] // Port Louis (Mauritius), Toamasina (Madagascar)
    };
    
    const allowedPorts = allowedPortsByService[activeService] || [];
    
    serviceVessels.forEach(vessel => {
      if (vessel.schedule?.vesselCalls) {
        vessel.schedule.vesselCalls.forEach(call => {
          const facility = call.facility;
          if (facility && facility.UNLocationCode) {
            // Check if this is a load port (not a South African discharge port)
            const isSAPort = getSAPortCodes().includes(facility.UNLocationCode);
            
            if (!isSAPort && allowedPorts.includes(facility.UNLocationCode)) {
              loadPortsSet.add(JSON.stringify({
                name: facility.cityName || facility.portName || facility.locationName,
                code: facility.UNLocationCode
              }));
            }
          }
        });
      }
    });

    const ports = Array.from(loadPortsSet).map(portStr => JSON.parse(portStr));
    
    // Define service-specific port rotation orders
    const servicePortOrders = {
      'SAECS': ['GBLGP', 'NLRTM', 'DEBRV', 'ESALG'],
      'SAFARI I SERVICE': ['MYTPP', 'MUPLU', 'HKHKG', 'CNSHA', 'CNNGB', 'CNSHK'], // Tanjung Pelepas, Port Louis, Hong Kong, Shanghai, Ningbo, Shekou
      'MESAWA': ['AEJEA', 'INMUN', 'INNSA', 'CGPNR', 'GHTEM', 'NGAPP'], // Middle East/India first, then West Africa - correct import rotation
      'PROTEA': ['AEJEA', 'INMUN', 'INNSA'], // Jebel Ali, Mundra, Jawaharlal Nehru
      'WAF7': ['MAPTM', 'GNCKY', 'ESALG', 'SLFNA', 'BJCOO'], // Port Tangier, Conakry, Algeciras, Freetown, Cotonou
      'WAFEX': ['BRSSZ', 'BRPNG', 'BRITJ'], // Santos, Paranagua, Itajai
      'AMERICAN EXPRESS SERVICE - SCL': ['USEWR', 'BSFPO', 'USCHS', 'USORF', 'USBAL', 'USPHL'], // Newark, Freeport, Charleston, Norfolk, Baltimore, Philadelphia
      'PORT LOUIS - TOAMASINA FDR': ['MUPLU', 'MGTSN'] // Port Louis (Mauritius), Toamasina (Madagascar)
    };
    
    const portOrder = servicePortOrders[activeService] || [];
    
    // Sort ports according to service-specific rotation order
    return ports.sort((a, b) => {
      const indexA = portOrder.indexOf(a.code);
      const indexB = portOrder.indexOf(b.code);
      
      // If both ports are in the rotation order, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only one is in the rotation, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // If neither is in the rotation, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  };

  const loadPorts = getLoadPortsForService();
  
  // Debug logging to show which ports are displayed for each service
  console.log(`Load ports for ${activeService}:`, loadPorts.map(p => `${p.name} (${p.code})`));
  
  // Additional debug logging for MESAWA
  if (activeService === 'MESAWA' && scheduleData?.current?.vessels) {
    const serviceVessels = scheduleData.current.vessels.filter(vessel => {
      if (!vessel.schedule?.vesselCalls) return false;
      return vessel.schedule.vesselCalls.some(call => 
        call.transport?.inboundService?.carrierServiceName === activeService
      );
    });
    
    console.log(`🔍 MESAWA Debug - Service vessels found: ${serviceVessels.length}`);
    console.log(`🔍 MESAWA Debug - Expected ports: AEJEA, INMUN, INNSA, CGPNR, GHTEM, NGAPP`);
    
    // Check what ports are actually in MESAWA vessels
    const allMesawaPorts = new Set();
    serviceVessels.forEach(vessel => {
      vessel.schedule?.vesselCalls?.forEach(call => {
        if (call.facility?.UNLocationCode && !getSAPortCodes().includes(call.facility.UNLocationCode)) {
          allMesawaPorts.add(`${call.facility.UNLocationCode} - ${call.facility.cityName || call.facility.portName}`);
        }
      });
    });
    console.log(`🔍 MESAWA Debug - All ports in MESAWA vessels:`, Array.from(allMesawaPorts));
  }

  const getDischargePortsForService = (serviceName) => {
    switch (serviceName) {
      case 'MESAWA':
        // MESAWA rotation: Only Cape Town and Port Elizabeth (actual service rotation)
        return [
          { name: 'Cape Town', code: 'ZACPT' },
          { name: 'Port Elizabeth', code: 'ZAPLZ' }
        ];
      case 'SAFARI I SERVICE':
        // Safari service: Only Durban (actual service rotation)
        return [
          { name: 'Durban', code: 'ZADUR' }
        ];
      case 'PROTEA':
        // Protea service: Only Durban (actual service rotation)
        return [
          { name: 'Durban', code: 'ZADUR' }
        ];
      default:
        // Standard rotation for all other services
        return [
          { name: 'Port Elizabeth', code: 'ZAPLZ' },
          { name: 'Port Coega', code: 'ZAZBA' },
          { name: 'Durban', code: 'ZADUR' },
          { name: 'Cape Town', code: 'ZACPT' }
        ];
    }
  };

  const dischargePorts = getDischargePortsForService(activeService);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      {/* Fixed Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                <Ship className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                <span>SA Import Schedule</span>
              </h1>
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label="Toggle dark mode"
                data-testid="dark-mode-toggle"
              >
                {isDark ? (
                  <Sun className="h-5 w-5 text-yellow-500" />
                ) : (
                  <Moon className="h-5 w-5 text-gray-600" />
                )}
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              <ExportDropdown 
                data={scheduleData} 
                filename="sa-import-schedule" 
                activeService={activeService}
                showDelayedOnly={showDelayedOnly}
              />
              <RefreshButton 
                onRefresh={refreshFromCache}
                onForceRefresh={forceApiRefresh}
                isLoading={isLoading}
                backgroundStatus={backgroundStatus}
                lastRefreshTime={lastRefreshTime}
              />
            </div>
          </div>

          {/* Service Navigation */}
          <div className="mt-4 flex flex-wrap gap-2">
            {services.map((service) => (
              <button
                key={service.name}
                onClick={() => setActiveService(service.name)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeService === service.name
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Ship className="h-4 w-4 inline mr-2" />
                {service.label}
              </button>
            ))}
          </div>
          
          {/* Delay Filter Button */}
          <div className="mt-4">
            <button
              onClick={() => setShowDelayedOnly(!showDelayedOnly)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showDelayedOnly
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              {showDelayedOnly ? 'Show All Vessels' : 'Show Delayed Only'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 pt-8">
        <div className="space-y-8">
          {/* Primary Schedule Grid */}
          {primaryVessels.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Primary Schedule - {activeService}
              </h2>
              <ScheduleGrid 
                vessels={primaryVessels}
                loadPorts={loadPorts}
                dischargePorts={dischargePorts}
                activeService={activeService}
                scheduleData={scheduleData}
              />
            </div>
          )}

          {/* Extended Schedule Grid - Shows additional vessels beyond the first 8 */}
          {extendedVessels.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Extended Schedule - {activeService}
              </h2>
              <ScheduleGrid 
                vessels={extendedVessels}
                loadPorts={loadPorts}
                dischargePorts={dischargePorts}
                activeService={activeService}
                scheduleData={scheduleData}
              />
            </div>
          )}

          {/* Vessel count summary */}
          {sortedVessels.length > 0 && (
            <div className="text-center py-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {sortedVessels.length} vessels
                {showDelayedOnly && (
                  <span className="ml-2 px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-xs">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    Delayed vessels only
                  </span>
                )}
              </div>
            </div>
          )}

          {/* No vessels message */}
          {primaryVessels.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 dark:text-gray-400">
                {showDelayedOnly 
                  ? `No delayed vessels found for ${activeService} service`
                  : `No vessels found for ${activeService} service`
                }
              </div>
              {showDelayedOnly && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowDelayedOnly(false)}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Show all vessels
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SAImportScheduleView;