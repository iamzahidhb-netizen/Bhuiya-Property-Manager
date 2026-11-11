export function formatUserUid(uid: string): string {
  return uid.length > 10 ? `${uid.slice(0, 5)}...${uid.slice(-5)}` : uid;
}
