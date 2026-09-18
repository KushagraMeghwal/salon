const ICONS: Record<string, string> = {
  Hair: 'content_cut',
  'Beard & Shave': 'face',
  'Facial & Skin': 'spa',
  'Spa & Massage': 'self_improvement',
  Coloring: 'palette',
};

export function serviceIcon(category: string): string {
  return ICONS[category] ?? 'content_cut';
}
