export interface TokenUsage {
  input: number;
  output: number;
}

export interface UsageSummary {
  today: TokenUsage;
  monthly: TokenUsage;
}
