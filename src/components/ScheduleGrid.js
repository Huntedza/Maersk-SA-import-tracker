import React from 'react';
import { Ship, MapPin, Anchor, Clock, AlertTriangle } from 'lucide-react';
import { getSAPortCodes } from '../services/SAInboundApi';

// Helper function to detect if a vessel arrival is delayed
const detectDelay = (schedules, eventType = 'ARRI') => {
  if (!schedules || schedules.length === 0) return null;
  
  // Find current estimated/planned arrival
  const currentSchedule = schedules.find(s => 
    s.transportEventTypeCode === eventType && 
    ['EST', 'PLN', 'ACT'].includes(s.eventClassifierCode)
  );
  
  if (!currentSchedule) return null;
  
  const now = new Date();
  const scheduledDate = new Date(currentSchedule.classifierDateTime);
  
  // Only check for delays on future dates
  if (scheduledDate <= now) return null;
  
  // Simple delay detection: if date was revised (look for multiple EST entries)
  const allEstimated = schedules.filter(s => 
    s.transportEventTypeCode === eventType && 
    s.eventClassifierCode === 'EST'
  );
  
  if (allEstimated.length > 1) {
    // Sort by when the estimate was made (assuming later entries are more recent)
    const sorted = allEstimated.sort((a, b) => new Date(a.classifierDateTime) - new Date(b.classifierDateTime));
    const original = new Date(sorted[0].classifierDateTime);
    const latest = new Date(sorted[sorted.length - 1].classifierDateTime);
    
    const delayHours = Math.round((latest - original) / (1000 * 60 * 60));
    
    if (delayHours > 6) { // Consider >6 hours as significant delay
      return {
        isDelayed: true,
        delayHours: delayHours,
        severity: delayHours > 24 ? 'major' : 'minor'
      };
    }
  }
  
  return { isDelayed: false };
};

const ScheduleDateCell = ({ dateInfo, schedules, eventType }) => {
  const delay = detectDelay(schedules, eventType);
  
  const getCellStyles = () => {
    let baseStyles = 'px-2 py-2 text-center border-r dark:border-gray-600 whitespace-nowrap relative ';
    
    if (dateInfo.type === 'ACT') {
      return baseStyles + 'text-green-600 dark:text-green-400 font-medium';
    }
    
    if (delay?.isDelayed) {
      if (delay.severity === 'major') {
        return baseStyles + 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 font-medium';
      } else {
        return baseStyles + 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 font-medium';
      }
    }
    
    return baseStyles + 'text-gray-900 dark:text-gray-100';
  };
  
  return (
    <td className={getCellStyles()}>
      <div className="flex items-center justify-center space-x-1">
        <span>{dateInfo.text}</span>
        {delay?.isDelayed && (
          <div className="flex items-center space-x-1">
            {delay.severity === 'major' ? (
              <AlertTriangle className="h-3 w-3 text-red-500" title={`Delayed ${delay.delayHours}h`} />
            ) : (
              <Clock className="h-3 w-3 text-orange-500" title={`Delayed ${delay.delayHours}h`} />
            )}
            <span className="text-xs">+{delay.delayHours}h</span>
          </div>
        )}
      </div>
    </td>
  );
};

const VesselHeader = ({ vessel, activeService }) => {
  // Extract voyage number from vessel schedule - get voyage that matches the displayed dates
  const getVoyageNumber = () => {
    if (!vessel.schedule?.vesselCalls) {
      return vessel.imo || 'N/A';
    }
    
    // Use the same target voyage logic as ScheduleGrid
    const now = new Date();
    
    // Find all SA arrivals with active service
    const saArrivals = vessel.schedule.vesselCalls
      .filter(call => getSAPortCodes().includes(call.facility?.UNLocationCode))
      .filter(call => call.transport?.inboundService?.carrierServiceName === activeService)
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

    if (targetVoyage) {
      console.log(`Vessel ${vessel.name} using target voyage: ${targetVoyage}`);
      return targetVoyage;
    }
    
    return vessel.imo || 'N/A';
  };

  return (
    <div>
      <div className="px-2 py-1 font-medium text-gray-900 dark:text-white">
        <div className="flex items-center justify-center mb-1">
          <span className="font-semibold">{vessel.name}</span>
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 text-center">{getVoyageNumber()}</div>
      </div>
      <div className="grid grid-cols-2 border-t dark:border-gray-600">
        <div className="px-2 py-1 border-r dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300">ETA</div>
        <div className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">ETD</div>
      </div>
    </div>
  );
};

const ScheduleGrid = ({ vessels, loadPorts, dischargePorts, activeService }) => {
  console.log(`🔍 ScheduleGrid - Active Service: ${activeService}`);
  console.log(`🔍 ScheduleGrid - Load Ports:`, loadPorts.map(p => `${p.name} (${p.code})`));
  console.log(`🔍 ScheduleGrid - Vessels:`, vessels.map(v => v.name));
  
  // Debug MESAWA port lookups specifically
  if (activeService === 'MESAWA') {
    console.log(`🔍 ScheduleGrid MESAWA - Will analyze ${loadPorts.length} ports for ${vessels.length} vessels`);
  }

  // Merge multiple records for the same vessel (by IMO number) while preserving order
  const mergeVesselRecords = (vesselList) => {
    const mergedVessels = {};
    const vesselOrder = []; // Track the order vessels first appear
    
    vesselList.forEach(vessel => {
      const key = vessel.imo || vessel.name;
      if (!mergedVessels[key]) {
        mergedVessels[key] = {
          ...vessel,
          schedule: {
            ...vessel.schedule,
            vesselCalls: [...vessel.schedule.vesselCalls]
          }
        };
        vesselOrder.push(key); // Remember the order
      } else {
        // Merge vessel calls from multiple records
        mergedVessels[key].schedule.vesselCalls.push(...vessel.schedule.vesselCalls);
      }
    });
    
    // Return vessels in the same order they appeared in the input array
    return vesselOrder.map(key => mergedVessels[key]);
  };

  const mergedVessels = vessels ? mergeVesselRecords(vessels) : [];

  if (!mergedVessels || mergedVessels.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Schedule</h2>
        <p className="text-gray-500 dark:text-gray-400">No vessels available</p>
      </div>
    );
  }

  // Helper function to get the target voyage for a vessel (same logic as VesselHeader)
  const getTargetVoyage = (vessel) => {
    if (!vessel.schedule?.vesselCalls) return null;
    
    const now = new Date();
    
    // Find all SA arrivals with active service
    const saArrivals = vessel.schedule.vesselCalls
      .filter(call => getSAPortCodes().includes(call.facility?.UNLocationCode))
      .filter(call => call.transport?.inboundService?.carrierServiceName === activeService)
      .map(call => ({
        call,
        voyage: call.transport.inboundService.carrierVoyageNumber,
        arrivalDate: call.callSchedules?.find(s => s.transportEventTypeCode === 'ARRI')?.classifierDateTime
      }))
      .filter(item => item.arrivalDate && item.voyage);

    console.log(`${vessel.name} SA arrivals:`, saArrivals.map(a => ({
      voyage: a.voyage,
      port: a.call.facility.UNLocationCode,
      date: a.arrivalDate,
      isFuture: new Date(a.arrivalDate) > now
    })));

    // Group by voyage and check if voyage has future arrivals
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

    console.log(`${vessel.name} target voyage: ${targetVoyage}`);
    return targetVoyage;
  };

  // Helper function to get schedule data for a vessel at a specific port
  const getPortSchedule = (vessel, portCode) => {
    console.log('Getting schedule for vessel:', vessel.name, 'port:', portCode);
    
    if (!vessel.schedule || !vessel.schedule.vesselCalls) {
      console.log('No vessel calls found for:', vessel.name);
      return null;
    }
    
    const targetVoyage = getTargetVoyage(vessel);
    if (!targetVoyage) {
      console.log('No target voyage found for:', vessel.name);
      return null;
    }
    
    console.log(`Using target voyage ${targetVoyage} for ${vessel.name} at ${portCode}`);
    
    const isSAPort = getSAPortCodes().includes(portCode);
    
    if (isSAPort) {
      // Find SA port call for the target voyage
      const targetCall = vessel.schedule.vesselCalls.find(call => 
        call.facility?.UNLocationCode === portCode &&
        call.transport?.inboundService?.carrierVoyageNumber === targetVoyage &&
        call.transport?.inboundService?.carrierServiceName === activeService
      );
      
      if (targetCall) {
        console.log(`Found SA call for ${vessel.name} at ${portCode} voyage ${targetVoyage}:`, targetCall.callSchedules);
        return targetCall.callSchedules;
      }
    } else {
      // For load ports, find the call with matching outbound voyage
      // Try both outbound and inbound service matching for MESAWA
      let loadPortCall = vessel.schedule.vesselCalls.find(call => 
        call.facility?.UNLocationCode === portCode &&
        call.transport?.outboundService?.carrierVoyageNumber === targetVoyage &&
        call.transport?.outboundService?.carrierServiceName === activeService
      );
      
      // If not found with outbound service, try inbound service for MESAWA
      if (!loadPortCall && activeService === 'MESAWA') {
        loadPortCall = vessel.schedule.vesselCalls.find(call => 
          call.facility?.UNLocationCode === portCode &&
          call.transport?.inboundService?.carrierVoyageNumber === targetVoyage &&
          call.transport?.inboundService?.carrierServiceName === activeService
        );
      }
      
      // CRITICAL: For MESAWA Middle East ports, ALWAYS use special logic to ensure correct inbound leg
      if (activeService === 'MESAWA' && ['AEJEA', 'INMUN', 'INNSA'].includes(portCode)) {
        // Clear any previous match - we need to override with correct Middle East logic
        loadPortCall = null;
        
        // For MESAWA, Middle East departure voyage leads to SA arrival voyage
        // Pattern: Middle East outbound 529W → SA inbound 533E
        // We need to find Middle East calls that depart BEFORE the target voyage SA arrivals
        
        const saArrival = vessel.schedule.vesselCalls.find(call => 
          getSAPortCodes().includes(call.facility?.UNLocationCode) &&
          call.transport?.inboundService?.carrierVoyageNumber === targetVoyage &&
          call.transport?.inboundService?.carrierServiceName === activeService
        );
        
        if (saArrival) {
          const saArrivalDate = saArrival.callSchedules?.find(s => s.transportEventTypeCode === 'ARRI')?.classifierDateTime;
          
          if (saArrivalDate) {
            // Find Middle East calls that depart BEFORE this SA arrival (correct import leg)
            const middleEastCalls = vessel.schedule.vesselCalls.filter(call => 
              call.facility?.UNLocationCode === portCode &&
              call.transport?.outboundService?.carrierServiceName === activeService
            );
            
            // Find the departure that's chronologically before SA arrival
            for (const call of middleEastCalls) {
              const departureDate = call.callSchedules?.find(s => s.transportEventTypeCode === 'DEPA')?.classifierDateTime;
              if (departureDate && new Date(departureDate) < new Date(saArrivalDate)) {
                const outVoyage = call.transport?.outboundService?.carrierVoyageNumber;
                console.log(`🔍 ${vessel.name} at ${portCode} - OVERRIDING with correct Middle East departure ${departureDate} (voyage ${outVoyage}) before SA arrival ${saArrivalDate} (voyage ${targetVoyage})`);
                loadPortCall = call;
                break;
              }
            }
            
            // If still no match, log for debugging
            if (!loadPortCall) {
              console.log(`❌ ${vessel.name} at ${portCode} - Could not find Middle East departure before SA arrival ${saArrivalDate} (voyage ${targetVoyage})`);
              const allMECalls = vessel.schedule.vesselCalls.filter(call => call.facility?.UNLocationCode === portCode);
              console.log(`Available ${portCode} calls for ${vessel.name}:`, allMECalls.map(call => ({
                outVoyage: call.transport?.outboundService?.carrierVoyageNumber,
                inVoyage: call.transport?.inboundService?.carrierVoyageNumber,
                depa: call.callSchedules?.find(s => s.transportEventTypeCode === 'DEPA')?.classifierDateTime
              })));
            }
          }
        } else {
          console.log(`❌ ${vessel.name} - Could not find SA arrival for voyage ${targetVoyage}`);
        }
      }
      
      if (loadPortCall) {
        console.log(`Found load port call for ${vessel.name} at ${portCode} voyage ${targetVoyage}:`, loadPortCall.callSchedules);
        return loadPortCall.callSchedules;
      } else {
        // Debug: Check what services are actually available for this port
        if (activeService === 'MESAWA' && ['CGPNR', 'GHTEM', 'NGAPP', 'AEJEA', 'INMUN', 'INNSA'].includes(portCode)) {
          const allCallsAtPort = vessel.schedule.vesselCalls.filter(call => 
            call.facility?.UNLocationCode === portCode
          );
          console.log(`🔍 ${vessel.name} at ${portCode} - Found ${allCallsAtPort.length} calls:`, 
            allCallsAtPort.map(call => ({
              outbound: call.transport?.outboundService?.carrierServiceName,
              voyage: call.transport?.outboundService?.carrierVoyageNumber,
              inbound: call.transport?.inboundService?.carrierServiceName,
              inVoyage: call.transport?.inboundService?.carrierVoyageNumber
            }))
          );
          console.log(`🔍 ${vessel.name} at ${portCode} - Looking for outbound service: MESAWA, voyage: ${targetVoyage}`);
        }
      }
    }
    
    console.log(`No schedule found for ${vessel.name} at ${portCode} for voyage ${targetVoyage}`);
    return null;
  };


  // Helper function to get schedule data for a vessel at a specific port using consistent voyage
  const getPortScheduleData = (vessel, portCode) => {
    // Debug MESAWA port lookups
    if (activeService === 'MESAWA' && ['CGPNR', 'GHTEM', 'NGAPP', 'AEJEA', 'INMUN', 'INNSA'].includes(portCode)) {
      console.log(`🔍 Getting schedule for ${vessel.name} at ${portCode}`);
    }
    
    const schedules = getPortSchedule(vessel, portCode);
    if (!schedules) {
      if (activeService === 'MESAWA' && ['CGPNR', 'GHTEM', 'NGAPP', 'AEJEA', 'INMUN', 'INNSA'].includes(portCode)) {
        console.log(`❌ No schedules found for ${vessel.name} at ${portCode}`);
      }
      return null;
    }
    
    const formatDate = (dateTimeString, eventType) => {
      if (!dateTimeString) return { text: '-', type: '' };
      try {
        const date = new Date(dateTimeString);
        const formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        return {
          text: formattedDate,
          type: eventType || 'EST'
        };
      } catch (error) {
        console.error('Date formatting error:', error);
        return { text: dateTimeString, type: eventType || 'EST' };
      }
    };
    
    // Look for both ARRI and DEPA events
    let etaSchedule = null;
    let etdSchedule = null;
    
    schedules.forEach(schedule => {
      if (schedule.transportEventTypeCode === 'ARRI') {
        etaSchedule = schedule;
      } else if (schedule.transportEventTypeCode === 'DEPA') {
        etdSchedule = schedule;
      }
    });
    
    return {
      eta: etaSchedule ? formatDate(etaSchedule.classifierDateTime, etaSchedule.eventClassifierCode) : { text: '-', type: '' },
      etd: etdSchedule ? formatDate(etdSchedule.classifierDateTime, etdSchedule.eventClassifierCode) : { text: '-', type: '' },
      schedules: schedules // Pass raw schedules for delay detection
    };
  };


  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse table-fixed">
          <colgroup>
            <col className="w-[120px]" />
            {mergedVessels.map((vessel) => (
              <React.Fragment key={vessel.imo || vessel.name}>
                <col className="w-[70px]" />
                <col className="w-[70px]" />
              </React.Fragment>
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="px-3 py-2 text-left border-b border-r dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-medium sticky left-0 text-gray-900 dark:text-gray-100">Ports</th>
              {mergedVessels.map((vessel, idx) => (
                <th key={vessel.imo || vessel.name} colSpan="2" className="text-center border-b border-r dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                  <VesselHeader vessel={vessel} activeService={activeService} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs">
            <tr>
              <td colSpan={mergedVessels.length * 2 + 1} className="px-3 py-2 text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-600">
                <div className="flex items-center justify-start space-x-2">
                  <MapPin className="h-4 w-4" />
                  <span>Load Ports</span>
                </div>
              </td>
            </tr>
            {loadPorts.map((port, portIdx) => (
              <tr key={port.name || portIdx} className="border-b dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-2 border-r dark:border-gray-600 font-medium sticky left-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{port.name}</td>
                {mergedVessels.map((vessel, vesselIdx) => {
                  const schedule = getPortScheduleData(vessel, port.code);
                  return (
                    <React.Fragment key={vessel.imo || vessel.name}>
                      <ScheduleDateCell 
                        dateInfo={schedule?.eta || { text: '-', type: '' }} 
                        schedules={schedule?.schedules || []}
                        eventType="ARRI"
                      />
                      <ScheduleDateCell 
                        dateInfo={schedule?.etd || { text: '-', type: '' }} 
                        schedules={schedule?.schedules || []}
                        eventType="DEPA"
                      />
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td colSpan={mergedVessels.length * 2 + 1} className="px-3 py-2 text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 border-b dark:border-gray-600">
                <div className="flex items-center justify-start space-x-2">
                  <Anchor className="h-4 w-4" />
                  <span>Discharge Ports</span>
                </div>
              </td>
            </tr>
            {dischargePorts.map((port, portIdx) => (
              <tr key={port.name || portIdx} className="border-b dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-2 border-r dark:border-gray-600 font-medium sticky left-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{port.name}</td>
                {mergedVessels.map((vessel, vesselIdx) => {
                  const schedule = getPortScheduleData(vessel, port.code);
                  return (
                    <React.Fragment key={vessel.imo || vessel.name}>
                      <ScheduleDateCell 
                        dateInfo={schedule?.eta || { text: '-', type: '' }} 
                        schedules={schedule?.schedules || []}
                        eventType="ARRI"
                      />
                      <ScheduleDateCell 
                        dateInfo={schedule?.etd || { text: '-', type: '' }} 
                        schedules={schedule?.schedules || []}
                        eventType="DEPA"
                      />
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleGrid;
