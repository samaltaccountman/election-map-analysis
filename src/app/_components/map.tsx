"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { electionDistricts } from "./data/election-districts";
import { results } from "./data/results";
import { getVoterCounts, type VoterCounts } from "./data/voter-counts";

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

type ViewMode = "election-results" | "voter-registration" | "turnout";

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
function stylePrecinctByResults(feature: any) {
  const electDist = feature.properties.ElectDist;
  const precinctResults = getPrecinctResults(electDist);
  const winningCandidate = getWinningCandidate(precinctResults);

  if (!precinctResults || !winningCandidate) {
    return {
      fillColor: "#cccccc",
      weight: 1,
      opacity: 1,
      color: "white",
      dashArray: "3",
      fillOpacity: 0.7,
    };
  }

  // Calculate win percentage
  const totalVotes = precinctResults.votes;
  const winningVotes = precinctResults.results[winningCandidate] as number;
  const winPercentage = totalVotes > 0 ? (winningVotes / totalVotes) * 100 : 0;

  // Base colors for candidates
  const candidateBaseColors: { [key: string]: string } = {
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

  const baseColor = candidateBaseColors[winningCandidate] || "#cccccc";

  // Create color gradations based on win percentage
  let fillColor = baseColor;

  if (winPercentage >= 80) {
    // Very strong win - use darker shade
    fillColor = darkenColor(baseColor, 0.3);
  } else if (winPercentage >= 60) {
    // Strong win - use slightly darker shade
    fillColor = darkenColor(baseColor, 0.2);
  } else if (winPercentage >= 50) {
    // Moderate win - use base color
    fillColor = baseColor;
  } else if (winPercentage >= 40) {
    // Weak win - use lighter shade
    fillColor = lightenColor(baseColor, 0.2);
  } else {
    // Very weak win - use much lighter shade
    fillColor = lightenColor(baseColor, 0.4);
  }

  return {
    fillColor,
    weight: 1,
    opacity: 1,
    color: "white",
    dashArray: "3",
    fillOpacity: 0.7,
  };
}

// Helper function to darken a color
function darkenColor(color: string, amount: number): string {
  // Convert hex to RGB
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Darken by reducing RGB values
  const newR = Math.max(0, Math.floor(r * (1 - amount)));
  const newG = Math.max(0, Math.floor(g * (1 - amount)));
  const newB = Math.max(0, Math.floor(b * (1 - amount)));

  // Convert back to hex
  return `#${newR.toString(16).padStart(2, "0")}${newG
    .toString(16)
    .padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

// Helper function to lighten a color
function lightenColor(color: string, amount: number): string {
  // Convert hex to RGB
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Lighten by increasing RGB values
  const newR = Math.min(255, Math.floor(r + (255 - r) * amount));
  const newG = Math.min(255, Math.floor(g + (255 - g) * amount));
  const newB = Math.min(255, Math.floor(b + (255 - b) * amount));

  // Convert back to hex
  return `#${newR.toString(16).padStart(2, "0")}${newG
    .toString(16)
    .padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

// Function to style precincts based on Democratic voter turnout
function stylePrecinctByTurnout(feature: any) {
  const electDist = feature.properties.ElectDist;
  const precinctResults = getPrecinctResults(electDist);
  const voterData = getVoterCounts(electDist);

  if (!precinctResults || !voterData || voterData.democrats === 0) {
    return {
      fillColor: "#cccccc",
      weight: 1,
      opacity: 1,
      color: "white",
      dashArray: "3",
      fillOpacity: 0.7,
    };
  }

  // Calculate Democratic turnout percentage
  const demTurnoutPercentage =
    (precinctResults.votes / voterData.democrats) * 100;

  // Color scale from low Democratic turnout (light) to high Democratic turnout (dark)
  let fillColor = "#cccccc";

  if (demTurnoutPercentage >= 60) {
    fillColor = "#1a365d"; // Very high Democratic turnout - dark blue
  } else if (demTurnoutPercentage >= 50) {
    fillColor = "#2c5282"; // High Democratic turnout - blue
  } else if (demTurnoutPercentage >= 40) {
    fillColor = "#3182ce"; // Moderate Democratic turnout - medium blue
  } else if (demTurnoutPercentage >= 30) {
    fillColor = "#63b3ed"; // Low Democratic turnout - light blue
  } else if (demTurnoutPercentage >= 20) {
    fillColor = "#90cdf4"; // Very low Democratic turnout - very light blue
  } else {
    fillColor = "#bee3f8"; // Extremely low Democratic turnout - pale blue
  }

  return {
    fillColor,
    weight: 1,
    opacity: 1,
    color: "white",
    dashArray: "3",
    fillOpacity: 0.7,
  };
}

// Function to style precincts based on voter registration data
function stylePrecinctByVoters(feature: any) {
  const electDist = feature.properties.ElectDist;
  const voterData = getVoterCounts(electDist);

  if (!voterData) {
    return {
      fillColor: "#cccccc",
      weight: 1,
      opacity: 1,
      color: "white",
      dashArray: "3",
      fillOpacity: 0.7,
    };
  }

  // Calculate Democratic percentage
  const demPercentage =
    voterData.total > 0 ? (voterData.democrats / voterData.total) * 100 : 0;

  // Color scale from red (Republican) to blue (Democratic)
  // 0% Democratic = red, 50% = white, 100% Democratic = blue
  let fillColor = "#cccccc";
  if (demPercentage < 30) {
    fillColor = "#d62728"; // Red
  } else if (demPercentage < 40) {
    fillColor = "#ff7f0e"; // Orange-red
  } else if (demPercentage < 50) {
    fillColor = "#ffbb78"; // Light orange
  } else if (demPercentage < 60) {
    fillColor = "#aec7e8"; // Light blue
  } else if (demPercentage < 70) {
    fillColor = "#1f77b4"; // Blue
  } else {
    fillColor = "#0d47a1"; // Dark blue
  }

  return {
    fillColor,
    weight: 1,
    opacity: 1,
    color: "white",
    dashArray: "3",
    fillOpacity: 0.7,
  };
}

// Function to create popup content for precincts
function onEachPrecinct(feature: any, layer: any, viewMode: ViewMode) {
  const electDist = feature.properties.ElectDist;
  const precinctResults = getPrecinctResults(electDist);
  const voterData = getVoterCounts(electDist);

  let popupContent = `
    <div style="font-family: Arial, sans-serif; min-width: 250px;">
      <h3 style="margin: 0 0 10px 0; color: #333;">Precinct ${electDist}</h3>
  `;

  // Add election results section
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

    // Calculate turnout percentage if we have voter data
    let turnoutInfo = "";
    if (voterData && voterData.total > 0) {
      const turnoutPercentage = ((totalVotes / voterData.total) * 100).toFixed(
        1
      );
      turnoutInfo = `<p style="margin: 5px 0;"><strong>Overall Turnout:</strong> ${turnoutPercentage}% (${totalVotes.toLocaleString()} of ${voterData.total.toLocaleString()} registered)</p>`;
    }

    // Calculate Democratic turnout percentage
    let demTurnoutInfo = "";
    if (voterData && voterData.democrats > 0) {
      const demTurnoutPercentage = (
        (totalVotes / voterData.democrats) *
        100
      ).toFixed(1);
      demTurnoutInfo = `<p style="margin: 5px 0; color: #1f77b4;"><strong>Democratic Turnout:</strong> ${demTurnoutPercentage}% (${totalVotes.toLocaleString()} of ${voterData.democrats.toLocaleString()} registered Democrats)</p>`;
    }

    popupContent += `
      <div style="margin-bottom: 15px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Election Results</h4>
        <p style="margin: 5px 0;"><strong>Total Votes:</strong> ${totalVotes.toLocaleString()}</p>
        ${turnoutInfo}
        ${demTurnoutInfo}
        <p style="margin: 5px 0;"><strong>Winner:</strong> ${
          winningCandidate
            ? candidateNames[winningCandidate] || winningCandidate
            : "No data"
        }</p>
        <div style="margin-top: 8px;">
          <strong>Results:</strong>
          <ul style="margin: 5px 0; padding-left: 15px; font-size: 12px;">
            ${Object.entries(precinctResults.results)
              .filter(([key]) => key !== "total_writeins")
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([candidate, votes]) => {
                const votePercentage =
                  totalVotes > 0
                    ? (((votes as number) / totalVotes) * 100).toFixed(1)
                    : "0.0";
                return `<li>${candidateNames[candidate] || candidate}: ${(
                  votes as number
                ).toLocaleString()} votes (${votePercentage}%)</li>`;
              })
              .join("")}
          </ul>
        </div>
      </div>
    `;
  }

  // Add voter registration section
  if (voterData) {
    const demPercentage =
      voterData.total > 0
        ? ((voterData.democrats / voterData.total) * 100).toFixed(1)
        : "0";
    const repPercentage =
      voterData.total > 0
        ? ((voterData.republicans / voterData.total) * 100).toFixed(1)
        : "0";

    // Calculate turnout percentage if we have election results
    let turnoutInfo = "";
    if (precinctResults && precinctResults.votes > 0) {
      const turnoutPercentage = (
        (precinctResults.votes / voterData.total) *
        100
      ).toFixed(1);
      turnoutInfo = `<p style="margin: 5px 0; color: #2c5aa0;"><strong>Overall Turnout:</strong> ${turnoutPercentage}%</p>`;
    }

    // Calculate Democratic turnout percentage
    let demTurnoutInfo = "";
    if (
      precinctResults &&
      precinctResults.votes > 0 &&
      voterData.democrats > 0
    ) {
      const demTurnoutPercentage = (
        (precinctResults.votes / voterData.democrats) *
        100
      ).toFixed(1);
      demTurnoutInfo = `<p style="margin: 5px 0; color: #1f77b4;"><strong>Democratic Turnout:</strong> ${demTurnoutPercentage}%</p>`;
    }

    popupContent += `
      <div style="padding: 10px; background-color: #e8f4f8; border-radius: 5px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Voter Registration</h4>
        <p style="margin: 5px 0;"><strong>County:</strong> ${
          voterData.county
        }</p>
        <p style="margin: 5px 0;"><strong>Total Registered:</strong> ${voterData.total.toLocaleString()}</p>
        ${turnoutInfo}
        ${demTurnoutInfo}
        <div style="margin-top: 8px;">
          <strong>Party Breakdown:</strong>
          <ul style="margin: 5px 0; padding-left: 15px; font-size: 12px;">
            <li style="color: #1f77b4;"><strong>Democrats:</strong> ${voterData.democrats.toLocaleString()} (${demPercentage}%)</li>
            <li style="color: #d62728;"><strong>Republicans:</strong> ${voterData.republicans.toLocaleString()} (${repPercentage}%)</li>
            <li><strong>Conservatives:</strong> ${voterData.conservatives.toLocaleString()}</li>
            <li><strong>Working Families:</strong> ${voterData.working_families.toLocaleString()}</li>
            <li><strong>Other:</strong> ${voterData.other.toLocaleString()}</li>
            <li><strong>No Party:</strong> ${voterData.blank.toLocaleString()}</li>
          </ul>
        </div>
      </div>
    `;
  }

  popupContent += `</div>`;

  layer.bindPopup(popupContent);
}

export function Map({ center = [40.7128, -74.006] }: MapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("election-results");

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

  // Choose styling function based on view mode
  const styleFunction =
    viewMode === "election-results"
      ? stylePrecinctByResults
      : viewMode === "turnout"
      ? stylePrecinctByTurnout
      : stylePrecinctByVoters;

  // Create wrapper for onEachFeature to pass viewMode
  const onEachFeatureWrapper = (feature: any, layer: any) => {
    onEachPrecinct(feature, layer, viewMode);
  };

  return (
    <div className="h-screen w-screen relative">
      {/* View Mode Controls */}
      <div className="absolute top-4 left-4 z-[1000] bg-white p-4 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-3 text-black">Map View</h3>
        <div className="space-y-2">
          <label className="flex items-center text-black">
            <input
              type="radio"
              name="viewMode"
              value="election-results"
              checked={viewMode === "election-results"}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="mr-2"
            />
            Election Results
          </label>
          <label className="flex items-center text-black">
            <input
              type="radio"
              name="viewMode"
              value="voter-registration"
              checked={viewMode === "voter-registration"}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="mr-2"
            />
            Voter Registration
          </label>
          <label className="flex items-center text-black">
            <input
              type="radio"
              name="viewMode"
              value="turnout"
              checked={viewMode === "turnout"}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="mr-2"
            />
            Voter Turnout
          </label>
        </div>

        {/* Legend */}
        {viewMode === "election-results" && (
          <div className="mt-4 pt-3 border-t">
            <h4 className="text-sm font-semibold mb-2 text-black">Win Rate</h4>
            <div className="space-y-1 text-xs text-black">
              <div className="flex items-center">
                <div className="w-4 h-3 bg-gray-400 mr-2"></div>
                <span>&lt; 40% (Very Weak)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-gray-500 mr-2"></div>
                <span>40-50% (Weak)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-gray-600 mr-2"></div>
                <span>50-60% (Moderate)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-gray-700 mr-2"></div>
                <span>60-80% (Strong)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-gray-800 mr-2"></div>
                <span>&gt; 80% (Very Strong)</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Colors vary by candidate, intensity shows win margin
            </p>
          </div>
        )}

        {viewMode === "turnout" && (
          <div className="mt-4 pt-3 border-t">
            <h4 className="text-sm font-semibold mb-2 text-black">
              Democratic Turnout %
            </h4>
            <div className="space-y-1 text-xs text-black">
              <div className="flex items-center">
                <div className="w-4 h-3 bg-blue-100 mr-2"></div>
                <span>&lt; 20% (Very Low)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-blue-200 mr-2"></div>
                <span>20-30% (Low)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-blue-300 mr-2"></div>
                <span>30-40% (Below Average)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-blue-500 mr-2"></div>
                <span>40-50% (Average)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-blue-700 mr-2"></div>
                <span>50-60% (High)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-blue-900 mr-2"></div>
                <span>&gt; 60% (Very High)</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Percentage of registered Democrats who voted
            </p>
          </div>
        )}

        {viewMode === "voter-registration" && (
          <div className="mt-4 pt-3 border-t">
            <h4 className="text-sm font-semibold mb-2 text-black">
              Democratic %
            </h4>
            <div className="space-y-1 text-xs text-black">
              <div className="flex items-center">
                <div className="w-4 h-3 bg-red-600 mr-2"></div>
                <span>&lt; 30%</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-orange-500 mr-2"></div>
                <span>30-40%</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-orange-300 mr-2"></div>
                <span>40-50%</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-blue-300 mr-2"></div>
                <span>50-60%</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-blue-600 mr-2"></div>
                <span>60-70%</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-blue-900 mr-2"></div>
                <span>&gt; 70%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <MapContainer
        center={center}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          data={electionDistricts as any}
          style={styleFunction}
          onEachFeature={onEachFeatureWrapper}
        />
      </MapContainer>
    </div>
  );
}
