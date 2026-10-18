import { updateRequest } from '../services/apiService';
import apiAuth from '../services/apiAuth';
import { storeToken } from '../services/session';

export interface UpdateUserPayload {
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  /** Required by the backend when the email changes (AGF-S1-07) */
  currentPassword?: string;
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
  // An email change returns a new token (the email is the token subject, PO-6): keep the session valid
  updateUser: async (payload: UpdateUserPayload) => {
    const res = await updateRequest(`/user`, payload);
    if (res?.data?.token) storeToken(res.data.token);
    return res;
  },

  changePassword: (payload: ChangePasswordPayload) =>
    apiAuth.post('/auth/change-password', payload),

  updateBusiness: (businessId: string, payload: UpdateBusinessPayload) =>
    updateRequest(`/business/${businessId}`, payload),

  getBusinessHours: (businessId: string) =>
    apiAuth.get(`/business/${businessId}/hours`),

  updateBusinessHours: (businessId: string, payload: UpdateBusinessHoursPayload) =>
    updateRequest(`/business/${businessId}/hours`, payload),
};
