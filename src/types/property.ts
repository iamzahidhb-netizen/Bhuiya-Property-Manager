import type { Timestamp } from 'firebase/firestore';

export type PropertyType = 'residential' | 'commercial' | 'mixed';
export type PropertyStatus = 'active' | 'archived';

export interface Property {
  id: string;
  workspaceId?: string;
  ownerUid: string;
  name: string;
  nameEn: string;
  code: string;
  type: PropertyType;
  address: string;
  totalFloors: number;
  description: string;
  status: PropertyStatus;
  isArchived: boolean;
  activeUnitNumbers?: Record<string, string>; // Normalized unitNumber -> unitId mapping
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type PropertyInput = Omit<Property, 'id' | 'createdAt' | 'updatedAt'>;

export type UnitType = 'flat' | 'shop' | 'room' | 'office' | 'warehouse' | 'other';
export type UnitStatus = 'vacant' | 'occupied' | 'under_maintenance' | 'archived';

export interface Unit {
  id: string;
  workspaceId?: string;
  ownerUid: string;
  propertyId: string;
  unitNumber: string;
  type: UnitType;
  floor: string | number;
  monthlyRent: number;
  serviceCharge: number;
  status: UnitStatus;
  currentTenantId: string | null;
  electricityMeterNumber: string;
  gasMeterNumber: string;
  notes: string;
  isArchived: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type UnitInput = Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>;
