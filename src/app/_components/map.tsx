"use client";

import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { electionDistricts } from "./data/election-districts";
import { results } from "./data/results";

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapProps {
  center?: [number, number];
}

// Function to get election results for a precinct
function getPrecinctResults(electDist: number) {
  const result = results.precincts.find(
    (p) => p.item_id === electDist.toString()
  );
  if (!result) {
    console.log(`No results found for precinct ${electDist}`);
  }
  return result;
}

// Function to get the winning candidate for a precinct
function getWinningCandidate(precinctResults: any) {
  if (!precinctResults) return null;

  const candidates = Object.entries(precinctResults.results)
    .filter(([key]) => key !== "total_writeins")
    .sort(([, a], [, b]) => (b as number) - (a as number));

  return candidates[0]?.[0] || null;
}

// Function to style precincts based on election results
function stylePrecinct(feature: any) {
  const electDist = feature.properties.ElectDist;
  const precinctResults = getPrecinctResults(electDist);
  const winningCandidate = getWinningCandidate(precinctResults);

  // Log styling for debugging
  if (Math.random() < 0.01) {
    // Log ~1% of precincts to avoid spam
    console.log(`Styling precinct ${electDist}:`, {
      hasResults: !!precinctResults,
      winningCandidate,
      locality: precinctResults?.locality_name,
    });
  }

  // Color mapping for candidates (you can customize these colors)
  const candidateColors: { [key: string]: string } = {
    "cuomo-a": "#1f77b4", // Blue
    "lander-b": "#ff7f0e", // Orange
    "mamdani-z": "#2ca02c", // Green
    "ramos-j": "#d62728", // Red
    "stringer-s": "#9467bd", // Purple
    "blake-m": "#8c564b", // Brown
    "myrie-z": "#e377c2", // Pink
    "tilson-w": "#7f7f7f", // Gray
    "adams-a": "#bcbd22", // Olive
  };

  return {
    fillColor: winningCandidate
      ? candidateColors[winningCandidate] || "#cccccc"
      : "#cccccc",
    weight: 1,
    opacity: 1,
    color: "white",
    dashArray: "3",
    fillOpacity: 0.7,
  };
}

// Function to create popup content for precincts
function onEachPrecinct(feature: any, layer: any) {
  const electDist = feature.properties.ElectDist;
  const precinctResults = getPrecinctResults(electDist);

  if (precinctResults) {
    const winningCandidate = getWinningCandidate(precinctResults);
    const totalVotes = precinctResults.votes;

    // Format candidate names for display
    const candidateNames: { [key: string]: string } = {
      "cuomo-a": "Cuomo",
      "lander-b": "Lander",
      "mamdani-z": "Mamdani",
      "ramos-j": "Ramos",
      "stringer-s": "Stringer",
      "blake-m": "Blake",
      "myrie-z": "Myrie",
      "tilson-w": "Tilson",
      "adams-a": "Adams",
    };

    const popupContent = `
      <div style="font-family: Arial, sans-serif; min-width: 200px;">
        <h3 style="margin: 0 0 10px 0; color: #333;">Precinct ${electDist}</h3>
        <p style="margin: 5px 0;"><strong>Total Votes:</strong> ${totalVotes}</p>
        <p style="margin: 5px 0;"><strong>Winner:</strong> ${
          winningCandidate
            ? candidateNames[winningCandidate] || winningCandidate
            : "No data"
        }</p>
        <div style="margin-top: 10px;">
          <strong>Results:</strong>
          <ul style="margin: 5px 0; padding-left: 15px;">
            ${Object.entries(precinctResults.results)
              .filter(([key]) => key !== "total_writeins")
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(
                ([candidate, votes]) =>
                  `<li>${
                    candidateNames[candidate] || candidate
                  }: ${votes} votes</li>`
              )
              .join("")}
          </ul>
        </div>
      </div>
    `;

    layer.bindPopup(popupContent);
  }
}

export function Map({ center = [40.7128, -74.006] }: MapProps) {
  // Log data structure for debugging
  console.log("Election Districts data:", {
    type: electionDistricts.type,
    featuresCount: electionDistricts.features?.length,
    firstFeature: electionDistricts.features?.[0],
  });

  console.log("Results data:", {
    totalPrecincts: results.precincts.length,
    firstResult: results.precincts[0],
    sampleItemIds: results.precincts.slice(0, 10).map((p) => p.item_id),
  });

  // Log sample election district ElectDist values
  const sampleElectDists = electionDistricts.features
    ?.slice(0, 10)
    .map((f) => f.properties?.ElectDist);
  console.log(
    "Sample ElectDist values from election districts:",
    sampleElectDists
  );

  // Check matching statistics
  const totalElectionDistricts = electionDistricts.features?.length || 0;
  const totalResults = results.precincts.length;
  const matchedCount =
    electionDistricts.features?.filter((f) =>
      results.precincts.some(
        (r) => r.item_id === f.properties?.ElectDist?.toString()
      )
    ).length || 0;

  console.log("Matching statistics:", {
    totalElectionDistricts,
    totalResults,
    matchedCount,
    matchPercentage:
      totalElectionDistricts > 0
        ? ((matchedCount / totalElectionDistricts) * 100).toFixed(1) + "%"
        : "0%",
  });

  return (
    <div className="h-screen w-screen">
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          data={electionDistricts as any}
          style={stylePrecinct}
          onEachFeature={onEachPrecinct}
        />
      </MapContainer>
    </div>
  );
}
