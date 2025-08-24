// src/utils/VesselScheduleProcessor.js
// Utility to extract POL/POD data from complete vessel schedules

// Processes the new, detailed vessel schedule format from the API
const processVesselSchedule = (schedule) => {
  if (!schedule || !schedule.vesselCalls || !schedule.vessel) {
    return [];
  }

  const imports = [];
  const vesselInfo = {
    name: schedule.vessel.vesselName,
    imo: schedule.vessel.vesselIMONumber,
    vesselName: schedule.vessel.vesselName,
  };

  // Find the Port of Loading (POL) - typically the first port with an outbound service
  let pol = null;

  for (const call of schedule.vesselCalls) {
    const port = {
      name: call.facility.portName,
      code: call.facility.UNLocationCode,
    };

    const service = call.transport?.inboundService || call.transport?.outboundService;
    if (!service) continue;

    const serviceInfo = {
      name: service.carrierServiceName,
      code: service.carrierServiceCode,
    };

    const arrival = call.callSchedules.find(cs => cs.transportEventTypeCode === 'ARRI');
    const departure = call.callSchedules.find(cs => cs.transportEventTypeCode === 'DEPA');

    const scheduleInfo = {
      eta: {
        text: arrival?.classifierDateTime,
        isActual: arrival?.eventClassifierCode === 'ACT',
        rawDateTime: arrival?.classifierDateTime,
      },
      etd: {
        text: departure?.classifierDateTime,
        isActual: departure?.eventClassifierCode === 'ACT',
        rawDateTime: departure?.classifierDateTime,
      },
    };

    // Heuristic: If we haven't found a POL and this port has an outbound service,
    // it's likely a POL for subsequent ports.
    if (!pol && call.transport?.outboundService) {
        pol = {
            name: port.name,
            code: port.code,
            schedule: scheduleInfo
        };
    }

    // Create an import record for this port call, but only for South African ports
    if (call.facility.countryCode === 'ZA') {
      imports.push({
        vessel: vesselInfo,
        service: serviceInfo,
        port: port,
        schedule: scheduleInfo,
        pol: pol, // Assign the determined POL
        voyage: service.carrierVoyageNumber || 'N/A',
        direction: 'IMPORT',
      });
    }
  }

  return imports;
};

// Extract Port of Loading (POL) data from vessel schedule
const extractPortsOfLoading = (vesselSchedule, serviceCode) => {
  if (!vesselSchedule?.vesselCalls) return [];
  
  const loadPorts = [];
  
  for (const vesselCall of vesselSchedule.vesselCalls) {
    // Note: The structure from the new API is different. This function may need updates
    // if it's still used.
    const transport = vesselCall.transport;
      
    // Look for outbound services (departures from load ports)
    if (transport?.outboundService?.carrierServiceCode === serviceCode) {
      const port = {
        name: vesselCall.facility?.portName || 'Unknown',
        code: vesselCall.facility?.UNLocationCode || 'N/A',
        country: vesselCall.facility?.countryName || 'Unknown'
      };
      
      // Avoid duplicates
      if (!loadPorts.find(p => p.code === port.code)) {
        loadPorts.push(port);
      }
    }
  }
  
  return loadPorts;
};

// Get service-specific POL based on actual vessel schedules and research findings
const getServiceLoadPorts = (serviceName, vesselSchedules = []) => {
  // Fallback to research-based service rotations
  switch (serviceName) {
    case 'SAECS':
      return [
        { name: 'Rotterdam', code: 'NLRTM' },
        { name: 'London Gateway', code: 'GBLGP' },
        { name: 'Bremerhaven', code: 'DEBRV' },
        { name: 'Algeciras - ML', code: 'ESALG' }
      ];
      
    case 'SAFARI':
      return [
        { name: 'Shanghai', code: 'CNSHA' },
        { name: 'Tanjung Pelepas', code: 'MYTPP' }
      ];
      
    case 'MESAWA':
      return [
        { name: 'Jeddah', code: 'SAJED' },
        { name: 'Djibouti', code: 'DJJIB' },
        { name: 'Sokhna', code: 'EGSKH' }
      ];
      
    case 'PROTEA':
      return [
        { name: 'Shanghai', code: 'CNSHA' },
        { name: 'Ningbo', code: 'CNNGB' },
        { name: 'Hong Kong', code: 'HKHKG' },
        { name: 'Singapore', code: 'SGSIN' },
        { name: 'Tanjung Pelepas', code: 'MYTPP' }
      ];
      
    default:
      return [];
  }
};

// Helper to get service code from name
const getServiceCode = (serviceName) => {
  const serviceCodes = {
    'SAECS': '278', 
    'SAFARI': '160', 
    'MESAWA': 'MW1',
    'PROTEA': '130'
  };
  return serviceCodes[serviceName] || '';
};

export {
  processVesselSchedule,
  extractPortsOfLoading,
  getServiceLoadPorts,
  getServiceCode
};