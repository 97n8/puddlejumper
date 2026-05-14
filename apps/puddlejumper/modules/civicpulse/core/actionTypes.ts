export enum ActionType {
  BOARD_VOTE            = 'board_vote',
  CONTRACT_AWARD        = 'contract_award',
  PROCUREMENT_ACTION    = 'procurement_action',
  BUDGET_TRANSFER       = 'budget_transfer',
  FREE_CASH_ALLOCATION  = 'free_cash_allocation',
  WARRANT_ARTICLE       = 'warrant_article',
  PUBLIC_HEARING        = 'public_hearing',
  ZBA_FILING            = 'zba_filing',
  CAPITAL_MILESTONE     = 'capital_milestone',
  DEBT_ISSUANCE         = 'debt_issuance',
  EMERGENCY_DECLARATION = 'emergency_declaration',
  POLICY_ADOPTION       = 'policy_adoption',
  POLICY_AMENDMENT      = 'policy_amendment',
}

export interface VaultRecord {
  id: string;
  actionType: ActionType;
  date: string;
  department: string;
  governingBody: string;
  responsibleParty: string;
  voteOutcome?: string;
  voteMargin?: string;
  financialAmount?: number;
  fundingSource?: string;
  timeline?: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
