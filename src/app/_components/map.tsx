"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { electionDistricts } from "./data/election-districts";
import { censusTracts } from "./data/census-tracts";
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

type ViewMode =
  | "election-results"
  | "voter-registration"
  | "turnout"
  | "age-demographics"
  | "zohran-support";

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

// Function to style precincts based on Zohran support (% of registered voters)
function stylePrecinctByZohranSupport(feature: any) {
  const electDist = feature.properties.ElectDist;
  const precinctResults = getPrecinctResults(electDist);
  const voterData = getVoterCounts(electDist);

  if (!precinctResults || !voterData || voterData.total === 0) {
    return {
      fillColor: "#cccccc",
      weight: 1,
      opacity: 1,
      color: "white",
      dashArray: "3",
      fillOpacity: 0.7,
    };
  }

  // Calculate Zohran votes
  const zohranVotes = precinctResults.results["mamdani-z"] || 0;

  // Calculate percentage of registered voters who voted for Zohran
  const zohranSupportPercentage = (zohranVotes / voterData.total) * 100;

  // Color scale from low support (light) to high support (dark green)
  // Using green to match Zohran's candidate color (#2ca02c)
  let fillColor = "#cccccc";

  if (zohranSupportPercentage >= 20) {
    fillColor = "#276419"; // Very high support - very dark green
  } else if (zohranSupportPercentage >= 15) {
    fillColor = "#4d9221"; // High support - dark green
  } else if (zohranSupportPercentage >= 10) {
    fillColor = "#7fbc41"; // Above average support - green
  } else if (zohranSupportPercentage >= 7.5) {
    fillColor = "#b8e186"; // Average support - light green
  } else if (zohranSupportPercentage >= 5) {
    fillColor = "#d9f0a3"; // Below average support - very light green
  } else if (zohranSupportPercentage >= 2.5) {
    fillColor = "#f1b6da"; // Low support - light pink
  } else if (zohranSupportPercentage > 0) {
    fillColor = "#de77ae"; // Very low support - pink
  } else {
    fillColor = "#c51b7d"; // No support - red
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

// Function to calculate Gen Z percentage from age groups
// Gen Z is typically defined as born 1997-2012, which in 2023 means ages 11-26
function calculateGenZPercentage(
  ageGroups: any,
  totalPopulation: number
): number | null {
  if (!ageGroups || !totalPopulation || totalPopulation === 0) {
    return null;
  }

  let genZCount = 0;

  // Gen Z age ranges (born 1997-2012, ages 11-26 in 2023)
  // We need to approximate since census data uses 5-year ranges
  for (const [ageRange, data] of Object.entries(ageGroups)) {
    if (data && typeof data === "object" && "total" in data) {
      const count = data.total as number;
      if (count !== null && count !== undefined && count > 0) {
        if (ageRange === "10 to 14 years") {
          // Ages 11-14 are Gen Z (4 out of 5 years)
          genZCount += count * 0.8;
        } else if (ageRange === "15 to 19 years") {
          // All ages 15-19 are Gen Z
          genZCount += count;
        } else if (ageRange === "20 to 24 years") {
          // All ages 20-24 are Gen Z
          genZCount += count;
        } else if (ageRange === "25 to 29 years") {
          // Ages 25-26 are Gen Z (2 out of 5 years)
          genZCount += count * 0.4;
        }
      }
    }
  }

  if (genZCount === 0) {
    return null;
  }

  return (genZCount / totalPopulation) * 100;
}

// Function to style census tracts based on Gen Z percentage
function styleCensusTract(feature: any, isPrimaryView: boolean = false) {
  const props = feature.properties;
  const totalPop = props?.totalPopulation;

  if (!totalPop || totalPop === 0) {
    return {
      fillColor: "#cccccc",
      weight: isPrimaryView ? 1 : 0.5,
      opacity: 1,
      color: isPrimaryView ? "#666666" : "#888888",
      fillOpacity: isPrimaryView ? 0.7 : 0.3,
    };
  }

  // Calculate Gen Z percentage
  const genZPercentage = calculateGenZPercentage(props?.ageGroups, totalPop);

  if (genZPercentage === null) {
    return {
      fillColor: "#cccccc",
      weight: isPrimaryView ? 1 : 0.5,
      opacity: 1,
      color: isPrimaryView ? "#666666" : "#888888",
      fillOpacity: isPrimaryView ? 0.7 : 0.3,
    };
  }

  // Color scale based on Gen Z percentage
  // Higher Gen Z percentage = darker/more vibrant colors
  let fillColor = "#cccccc";

  if (genZPercentage >= 30) {
    fillColor = "#276419"; // Very high Gen Z - very dark green
  } else if (genZPercentage >= 25) {
    fillColor = "#4d9221"; // High Gen Z - dark green
  } else if (genZPercentage >= 20) {
    fillColor = "#7fbc41"; // Above average Gen Z - green
  } else if (genZPercentage >= 15) {
    fillColor = "#b8e186"; // Average Gen Z - light green
  } else if (genZPercentage >= 10) {
    fillColor = "#f1b6da"; // Below average Gen Z - light pink
  } else if (genZPercentage >= 5) {
    fillColor = "#de77ae"; // Low Gen Z - pink
  } else {
    fillColor = "#c51b7d"; // Very low Gen Z - red
  }

  return {
    fillColor,
    weight: isPrimaryView ? 1 : 0.5,
    opacity: 1,
    color: isPrimaryView ? "#333333" : "#888888",
    fillOpacity: isPrimaryView ? 0.7 : 0.3,
    dashArray: isPrimaryView ? undefined : "2",
  };
}

// Function to create popup content for census tracts
function onEachCensusTract(feature: any, layer: any) {
  const props = feature.properties;
  const totalPop = props?.totalPopulation;
  const name = props?.NAME || props?.CTLabel || "Unknown";

  // Calculate Gen Z percentage
  const genZPercentage = calculateGenZPercentage(
    props?.ageGroups,
    totalPop || 0
  );

  let popupContent = `
    <div style="font-family: Arial, sans-serif; min-width: 250px;">
      <h3 style="margin: 0 0 10px 0; color: #333;">${name}</h3>
  `;

  if (totalPop !== null && totalPop !== undefined) {
    popupContent += `
      <div style="margin-bottom: 15px; padding: 10px; background-color: #f0f9f4; border-radius: 5px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Population Demographics</h4>
        <p style="margin: 5px 0;"><strong>Total Population:</strong> ${totalPop.toLocaleString()}</p>
    `;

    if (props?.totalPopulationMOE) {
      popupContent += `<p style="margin: 5px 0; color: #666; font-size: 12px;">Margin of Error: ±${props.totalPopulationMOE.toLocaleString()}</p>`;
    }

    if (genZPercentage !== null) {
      popupContent += `<p style="margin: 5px 0;"><strong>Gen Z (%):</strong> ${genZPercentage.toFixed(
        1
      )}%</p>`;
    }

    // Add age groups if available
    if (props?.ageGroups && Object.keys(props.ageGroups).length > 0) {
      popupContent += `
        <div style="margin-top: 10px;">
          <strong>Age Distribution:</strong>
          <ul style="margin: 5px 0; padding-left: 15px; font-size: 12px; max-height: 200px; overflow-y: auto;">
      `;

      // Show key age groups - iterate over all available age groups
      Object.keys(props.ageGroups).forEach((ageGroup) => {
        const data = props.ageGroups[ageGroup];
        if (data && data.total !== null && data.total !== undefined) {
          const percentage =
            totalPop > 0 ? ((data.total / totalPop) * 100).toFixed(1) : "0.0";
          popupContent += `<li>${ageGroup}: ${data.total.toLocaleString()} (${percentage}%)</li>`;
        }
      });

      popupContent += `</ul></div>`;
    }

    // Add selected age categories
    if (
      props?.selectedAgeCategories &&
      Object.keys(props.selectedAgeCategories).length > 0
    ) {
      popupContent += `
        <div style="margin-top: 10px;">
          <strong>Selected Categories:</strong>
          <ul style="margin: 5px 0; padding-left: 15px; font-size: 12px;">
      `;

      // Show all selected age categories
      Object.keys(props.selectedAgeCategories).forEach((category) => {
        const data = props.selectedAgeCategories[category];
        if (data && data.total !== null && data.total !== undefined) {
          const percentage =
            totalPop > 0 ? ((data.total / totalPop) * 100).toFixed(1) : "0.0";
          popupContent += `<li>${category}: ${data.total.toLocaleString()} (${percentage}%)</li>`;
        }
      });

      popupContent += `</ul></div>`;
    }

    popupContent += `</div>`;
  }

  popupContent += `</div>`;

  layer.bindPopup(popupContent);
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

    // Calculate Zohran support percentage (% of registered voters)
    let zohranSupportInfo = "";
    if (precinctResults && voterData && voterData.total > 0) {
      const zohranVotes = precinctResults.results["mamdani-z"] || 0;
      const zohranSupportPercentage = (
        (zohranVotes / voterData.total) *
        100
      ).toFixed(1);
      zohranSupportInfo = `<p style="margin: 5px 0; color: #2ca02c; font-weight: bold;"><strong>Zohran Support (% of Registered Voters):</strong> ${zohranSupportPercentage}% (${zohranVotes.toLocaleString()} of ${voterData.total.toLocaleString()} registered)</p>`;
    }

    popupContent += `
      <div style="margin-bottom: 15px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Election Results</h4>
        <p style="margin: 5px 0;"><strong>Total Votes:</strong> ${totalVotes.toLocaleString()}</p>
        ${turnoutInfo}
        ${demTurnoutInfo}
        ${viewMode === "zohran-support" ? zohranSupportInfo : ""}
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
      : viewMode === "zohran-support"
      ? stylePrecinctByZohranSupport
      : stylePrecinctByVoters;

  // Create wrapper for onEachFeature to pass viewMode
  const onEachFeatureWrapper = (feature: any, layer: any) => {
    onEachPrecinct(feature, layer, viewMode);
  };

  // Create wrapper for census tract styling to pass view mode
  const censusTractStyleWrapper = (feature: any) => {
    return styleCensusTract(feature, viewMode === "age-demographics");
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
          <label className="flex items-center text-black">
            <input
              type="radio"
              name="viewMode"
              value="age-demographics"
              checked={viewMode === "age-demographics"}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="mr-2"
            />
            Age Demographics
          </label>
          <label className="flex items-center text-black">
            <input
              type="radio"
              name="viewMode"
              value="zohran-support"
              checked={viewMode === "zohran-support"}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="mr-2"
            />
            Zohran Support (% of Registered Voters)
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

        {viewMode === "age-demographics" && (
          <div className="mt-4 pt-3 border-t">
            <h4 className="text-sm font-semibold mb-2 text-black">Gen Z %</h4>
            <div className="space-y-1 text-xs text-black">
              <div className="flex items-center">
                <div className="w-4 h-3 bg-red-500 mr-2"></div>
                <span>&lt; 5% (Very Low)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-pink-400 mr-2"></div>
                <span>5-10% (Low)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-pink-200 mr-2"></div>
                <span>10-15% (Below Average)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-green-200 mr-2"></div>
                <span>15-20% (Average)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-green-500 mr-2"></div>
                <span>20-25% (Above Average)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-green-700 mr-2"></div>
                <span>25-30% (High)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-green-900 mr-2"></div>
                <span>&gt; 30% (Very High)</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Percentage of population that is Gen Z (ages 11-26)
            </p>
          </div>
        )}

        {viewMode === "zohran-support" && (
          <div className="mt-4 pt-3 border-t">
            <h4 className="text-sm font-semibold mb-2 text-black">
              Zohran Support % of Registered Voters
            </h4>
            <div className="space-y-1 text-xs text-black">
              <div className="flex items-center">
                <div className="w-4 h-3 bg-green-900 mr-2"></div>
                <span>&gt;= 20% (Very High)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-green-700 mr-2"></div>
                <span>15-20% (High)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-green-500 mr-2"></div>
                <span>10-15% (Above Average)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-green-300 mr-2"></div>
                <span>7.5-10% (Average)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-green-100 mr-2"></div>
                <span>5-7.5% (Below Average)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-pink-200 mr-2"></div>
                <span>2.5-5% (Low)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-pink-400 mr-2"></div>
                <span>0-2.5% (Very Low)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 bg-red-500 mr-2"></div>
                <span>0% (No Support)</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Percentage of registered voters who voted for Zohran Mamdani
            </p>
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
        {viewMode === "age-demographics" ? (
          <GeoJSON
            key="census-tracts"
            data={censusTracts as any}
            style={censusTractStyleWrapper}
            onEachFeature={onEachCensusTract}
          />
        ) : (
          <GeoJSON
            key="election-districts"
            data={electionDistricts as any}
            style={styleFunction}
            onEachFeature={onEachFeatureWrapper}
          />
        )}
      </MapContainer>
    </div>
  );
}
