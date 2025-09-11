// Type declarations for results-with-districts data
import type { Results } from "./results";

export declare const results: Results;

export interface ResultsWithDistricts {
  meta: Results["meta"];
  precincts: Results["precincts"];
}

export declare const resultsWithDistricts: ResultsWithDistricts;
