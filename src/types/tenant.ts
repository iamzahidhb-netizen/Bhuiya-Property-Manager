import type { Timestamp } from 'firebase/firestore';

export type TenantStatus = 'active' | 'vacated';

export interface Tenant {
  id: string;
  workspaceId?: string;
  ownerUid: string;
  propertyId: string;
  unitId: string;
  name: string;
  mobile: string;
  nid?: string;
  address?: string;
  monthlyRent: number;
  gasCharge: number;
  waterCharge: number;
  advanceDeposit: number;
  moveInDate: string; // YYYY-MM-DD
  vacatingDate?: string | null;
  status: TenantStatus;
  notes?: string;
  finalDamageDeductions?: number;
  finalRefundAmount?: number;
  settlementNotes?: string;
  settledAt?: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface TenantFormData {
  propertyId: string;
  unitId: string;
  name: string;
  mobile: string;
  nid?: string;
  address?: string;
  monthlyRent: number;
  gasCharge: number;
  waterCharge: number;
  advanceDeposit: number;
  moveInDate: string;
  notes?: string;
}

export interface VacateTenantFormData {
  tenantId: string;
  vacatingDate: string;
  damageDeductions: number;
  refundAmount: number;
  settlementNotes?: string;
  depositId?: string;
}
