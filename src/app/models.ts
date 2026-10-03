export type Locale = 'es' | 'en' | 'pt';
export interface Identity { id: string; username: string; name: string; role: 'ADMIN' | 'STAFF'; }
export interface Translation { locale: Locale; displayName: string; description: string; services: string; }
export interface Hour { weekday: number; opensAt: string; closesAt: string; }
export interface Settings { version: string; defaultCapacity: number; phone: string; email: string; address: string; sinpeNumber: string; enabled: boolean; translations: Translation[]; hours: Hour[]; closedDates: {visitDate: string; reason: string}[]; capacityOverrides: {visitDate: string; capacity: number}[]; }
export interface Rate { id: string; adultPrice: string; childPrice: string; seniorPrice: string; parkingPrice: string; }
export interface Exchange { currency: 'USD' | 'BRL'; rate: string; updatedOn: string; }
export interface Snapshot { settings: Settings | null; ratePlan: Rate | null; exchangeRates: Exchange[]; serverDate: string; }
export interface PublicBusiness { configured: boolean; reservationsEnabled: boolean; serverDate: string; currency: 'CRC'; translations?: Translation[]; phone?: string; email?: string; address?: string; sinpeNumber?: string; hours?: Hour[]; ratePlan: Rate | null; exchangeRates: Exchange[]; }
export interface Dashboard { serverDate: string; pendingReservations: number; admittedPeople: number; hours: Hour[]; tasks: {title:string;status:string}[]; }
