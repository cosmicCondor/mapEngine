// alerts.js
const checkZBE = (position, zones) => {
  return zones.some(zone => 
    haversineDistance(position, zone.center) <= zone.radius + 500
  );
};
