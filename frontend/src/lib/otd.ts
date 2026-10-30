import { transit_realtime } from "gtfs-realtime-bindings";
import { STOPS_DB, haversineDistance } from "@/lib/transitData";
import { TransitStatusResponse } from "@/types/transit";

export function withLiveDelhiBusStatus(
  status: TransitStatusResponse,
  payload: Uint8Array
): TransitStatusResponse {
  const feed = transit_realtime.FeedMessage.decode(payload);
  const vehicles = feed.entity
    .filter((entity) => entity.vehicle)
    .map((entity) => entity.vehicle!);
  const congestedVehicles = vehicles.filter(
    (vehicle) =>
      vehicle.congestionLevel ===
        transit_realtime.VehiclePosition.CongestionLevel.CONGESTION ||
      vehicle.congestionLevel ===
        transit_realtime.VehiclePosition.CongestionLevel.SEVERE_CONGESTION
  ).length;
  const congestionRatio =
    vehicles.length > 0 ? congestedVehicles / vehicles.length : 0;
  const busCrowd =
    congestionRatio >= 0.3
      ? "High"
      : vehicles.length > 0
        ? "Medium"
        : status.crowdIndex.bus;
  const latestTimestamp = vehicles.reduce((latest, vehicle) => {
    const timestamp =
      typeof vehicle.timestamp === "number"
        ? vehicle.timestamp
        : vehicle.timestamp?.toNumber() || 0;
    return Math.max(latest, timestamp);
  }, 0);
  const knownStops = STOPS_DB.delhi;
  const liveVehicles = vehicles
    .map((vehicle, index) => {
      const position = vehicle.position;
      if (position?.latitude == null || position.longitude == null) return null;

      const nearestStop = knownStops.reduce<{
        name: string;
        distanceKm: number;
      } | null>((nearest, stop) => {
        const distanceKm = haversineDistance(
          { lat: position.latitude!, lng: position.longitude! },
          { lat: stop.lat, lng: stop.lng }
        );
        return !nearest || distanceKm < nearest.distanceKm
          ? { name: stop.name, distanceKm }
          : nearest;
      }, null);
      const vehicleId =
        vehicle.vehicle?.id || vehicle.vehicle?.label || `otd-${index + 1}`;
      const speedKph = 20;

      return {
        id: vehicleId,
        routeId: vehicle.trip?.routeId || undefined,
        lat: position.latitude,
        lng: position.longitude,
        nearestStop: nearestStop?.name,
        estimatedArrivalMinutes: nearestStop
          ? Math.max(1, Math.ceil((nearestStop.distanceKm / speedKph) * 60))
          : undefined,
      };
    })
    .filter((vehicle): vehicle is NonNullable<typeof vehicle> => vehicle !== null)
    .slice(0, 100);

  return {
    ...status,
    systemStatus:
      congestionRatio >= 0.3 ? "MODERATE_DELAYS" : status.systemStatus,
    alerts: [
      ...status.alerts,
      {
        id: "del_otd_live",
        severity: congestionRatio >= 0.3 ? "warning" : "info",
        mode: "bus",
        title: "Live DTC Vehicle Feed",
        message: `${vehicles.length} buses currently reporting positions through Delhi Open Transit Data.`,
      },
    ],
    crowdIndex: {
      ...status.crowdIndex,
      bus: busCrowd,
    },
    liveData: {
      source: "otd",
      vehicleCount: vehicles.length,
      updatedAt: new Date(
        (latestTimestamp || Math.floor(Date.now() / 1000)) * 1000
      ).toISOString(),
      vehicles: liveVehicles,
    },
  };
}
