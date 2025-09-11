// Example of how to integrate voter counts with precincts data
import { precincts } from "./precincts";
import { voterCounts, getVoterCounts, VoterCounts } from "./voter-counts";

// Type for a precinct feature with voter data
export interface PrecinctWithVoterData {
  type: "Feature";
  id: number;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: {
    OBJECTID: number;
    ElectDist: number;
    Shape__Area: number;
    Shape__Length: number;
    voterCounts?: VoterCounts;
  };
}

// Function to add voter data to precinct features
export function addVoterDataToPrecincts(): PrecinctWithVoterData[] {
  return precincts.features.map((feature) => {
    const electDist = feature.properties.ElectDist;
    const voterData = getVoterCounts(electDist);

    return {
      ...feature,
      properties: {
        ...feature.properties,
        voterCounts: voterData,
      },
    } as PrecinctWithVoterData;
  });
}

// Function to get precincts with voter data for a specific county
export function getPrecinctsByCountyWithVoterData(
  county: string
): PrecinctWithVoterData[] {
  return addVoterDataToPrecincts().filter(
    (precinct) => precinct.properties.voterCounts?.county === county
  );
}

// Function to get total voters by party for a specific county
export function getCountyVoterTotals(county: string): {
  democrats: number;
  republicans: number;
  conservatives: number;
  working_families: number;
  other: number;
  blank: number;
  total: number;
} {
  const countyPrecincts = getPrecinctsByCountyWithVoterData(county);

  return countyPrecincts.reduce(
    (totals, precinct) => {
      const voterData = precinct.properties.voterCounts;
      if (voterData) {
        totals.democrats += voterData.democrats;
        totals.republicans += voterData.republicans;
        totals.conservatives += voterData.conservatives;
        totals.working_families += voterData.working_families;
        totals.other += voterData.other;
        totals.blank += voterData.blank;
        totals.total += voterData.total;
      }
      return totals;
    },
    {
      democrats: 0,
      republicans: 0,
      conservatives: 0,
      working_families: 0,
      other: 0,
      blank: 0,
      total: 0,
    }
  );
}

// Example usage:
// const precinctsWithVoterData = addVoterDataToPrecincts();
// const queensPrecincts = getPrecinctsByCountyWithVoterData("Queens County");
// const queensTotals = getCountyVoterTotals("Queens County");
