// Type declarations for voter-counts data
export interface VoterCounts {
  district: number;
  county: string;
  democrats: number;
  republicans: number;
  conservatives: number;
  working_families: number;
  other: number;
  blank: number;
  total: number;
}

export declare const voterCounts: { [key: number]: VoterCounts };

export declare function getVoterCounts(
  district: number
): VoterCounts | undefined;

export declare function getDistrictsByCounty(county: string): VoterCounts[];

export declare function getTotalVotersByParty(): {
  democrats: number;
  republicans: number;
  conservatives: number;
  working_families: number;
  other: number;
  blank: number;
  total: number;
};
