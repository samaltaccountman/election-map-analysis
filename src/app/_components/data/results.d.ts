// Type declarations for results data
export interface ResultMeta {
  dataLevel: string;
  totalVotes: number;
  precinctItemsTotal: number;
  precinctItemsReporting: number;
  geographiesTotal: number;
  geographiesReporting: number;
  countByVoteType: {
    all: number;
  };
  voteTypes: string;
  scraperType: string;
  scraped_at: string;
}

export interface PrecinctResult {
  item_id: string;
  scraped_item_id: string;
  geo_id: string;
  // Add other properties as needed
  [key: string]: any;
}

export interface Results {
  meta: ResultMeta;
  precincts: PrecinctResult[];
}

export declare const results: Results;
