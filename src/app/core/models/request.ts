export type ApprovedBy = {
  role: 'ADMIN';
  approvedAt: string;
  username: string;
};

export type RejectedBy = {
  role: 'ADMIN';
  rejectedAt: string;
  username: string;
};

export type UnredactRequest = {
  requestId: string;
  createdAt: string;
  approvalRequired: boolean;
  reason: string;
  paths: string[];
  approvedBy?: ApprovedBy[];
};

export type UnredactRequestViewModel = UnredactRequest & {
  showDetails?: boolean;
};

export type EntityRequest = {
  gsiAllPk: string;
  gsiAllSk: string;
  gsiPendingPk: string;
  gsiPendingSk: string;
  pk: string;
  sk: string;
  accountId: string;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  issueKey: string;
  requestId: string;
  duration: number;
  region: string;
  table: string;
  userId: string;
  targetPk: string;
  targetSk: string;
  comment?: string | null;
  rejectedBy?: RejectedBy;
  approvedBy?: ApprovedBy[];
  unredactRequests?: UnredactRequestViewModel[];
};

export type EntityRequestViewModel = EntityRequest & {
  adminApprovedBy?: string;
  adminApprovedAt?: string;
};

export type EntityRequestsResponse<T extends EntityRequest = EntityRequest> = {
  count: number;
  items: T[];
};

export type UserEntityRequest = EntityRequest & {
  isAvailable: boolean;
};

export type UserEntityRequestsResponse = EntityRequestsResponse<UserEntityRequest> & {
  userId: string;
};

export type CreateEntityRequestPayload = {
  duration: number;
  table: string;
  targetPk: string;
  targetSk?: string;
  reason: string;
  issueKey: string;
  accountId: string;
  region: string;
};

export type RequestDecisionResponse = EntityRequest;
