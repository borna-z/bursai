export type MannequinPresentation = 'male' | 'female' | 'mixed';

export function normalizeMannequinPresentation(value: unknown): MannequinPresentation {
  if (value === 'male' || value === 'female' || value === 'mixed') {
    return value;
  }

  return 'mixed';
}

/**
 * Ghost-mannequin presentation instruction for wearables (tops / bottoms /
 * dresses / outerwear). Enriched in Wave 3-B F5 from a single anemic sentence
 * to body-shape-specific guidance so Gemini produces the right silhouette,
 * shoulder width, neckline height, and hip/waist curve for the garment's
 * intended wearer.
 *
 * Non-wearable categories (shoes, bags, accessories, jewelry) don't call
 * through this helper — their category-branch prompts in render_garment_image
 * skip mannequin framing entirely.
 */
export function mannequinPresentationInstruction(value: MannequinPresentation): string {
  switch (value) {
    case 'male':
      return [
        'Use a MALE ghost / shadow mannequin presentation.',
        'Silhouette proportions: broader shoulders, straighter waist, narrower hips, longer torso relative to the female presentation.',
        'Neckline sits at a higher position; sleeves fall along a straighter arm line.',
        'The mannequin body itself is INVISIBLE — only use these proportions as shape cues for how the garment drapes.',
      ].join(' ');
    case 'female':
      return [
        'Use a FEMALE ghost / shadow mannequin presentation.',
        'Silhouette proportions: narrower shoulders, defined waist, curved hipline, shorter torso relative to the male presentation.',
        'Neckline sits at a slightly lower position on the chest; bustline adds subtle front volume; sleeves follow a slightly tapered arm line.',
        'The mannequin body itself is INVISIBLE — only use these proportions as shape cues for how the garment drapes.',
      ].join(' ');
    case 'mixed':
    default:
      return [
        'Use a NEUTRAL ghost / shadow mannequin presentation.',
        'Silhouette proportions: balanced shoulder width, subtle waist definition, average hip curve — neither overtly masculine nor feminine.',
        'Drape and structure should be the focus, not the underlying body form.',
        'The mannequin body itself is INVISIBLE — only use these proportions as shape cues for how the garment drapes.',
      ].join(' ');
  }
}
