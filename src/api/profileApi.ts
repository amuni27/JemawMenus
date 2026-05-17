import { updateRequest } from '../services/apiService';
import apiAuth from '../services/apiAuth';

export interface UpdateUserPayload {
  fullName?: string;
  phoneNumber?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateBusinessPayload {
  name?: string;
  businessPhone?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  logoUrl?: string;
}

export interface BusinessHourEntry {
  dayOfWeek: string;
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface UpdateBusinessHoursPayload {
  open24_7: boolean;
  businessHours: BusinessHourEntry[];
}

export const profileApi = {
  updateUser: (userId: string, payload: UpdateUserPayload) =>
    updateRequest(`/users/${userId}`, payload),

  changePassword: (payload: ChangePasswordPayload) =>
    apiAuth.post('/auth/change-password', payload),

  updateBusiness: (businessId: string, payload: UpdateBusinessPayload) =>
    updateRequest(`/business/${businessId}`, payload),

  getBusinessHours: (businessId: string) =>
    apiAuth.get(`/business/${businessId}/hours`),

  updateBusinessHours: (businessId: string, payload: UpdateBusinessHoursPayload) =>
    updateRequest(`/business/${businessId}/hours`, payload),
};
