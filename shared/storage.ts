export interface StorageStatus {
  configured: boolean;
  appId: string;
  cloudImages: number;
  localImages: number;
  pendingIds: string[];
}
