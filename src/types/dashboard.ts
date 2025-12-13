export type QrStatus = 'ACTIVE' | 'PAUSED' | 'TRASH';

export interface QrEntry {
  id: string;
  tenantId: string;
  name: string;
  shortLink: string;
  type: 'Menu' | 'Deal' | 'Ad';
  projectName?: string;
  status: QrStatus;
  updatedAt: string;
  qrImageUrl?: string;
  menuId?: string;
}
