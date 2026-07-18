export function getStarSelectionValues(star: number) {
  return star === 1 ? [1] : [star - 0.5, star];
}
