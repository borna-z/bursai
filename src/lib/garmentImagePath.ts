export function buildOriginalGarmentImagePath(
  userId: string,
  garmentId: string,
  extension = 'jpg',
): string {
  const normalizedExtension = extension.replace(/^\.+/, '').toLowerCase() || 'jpg';
  return `${userId}/${garmentId}/original.${normalizedExtension}`;
}
