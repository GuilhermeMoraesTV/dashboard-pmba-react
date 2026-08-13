export const DEFAULT_COVER_POSITION = Object.freeze({ x: 50, y: 50 });

const clampPercentage = (value, fallback = 50) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(100, Math.max(0, numericValue));
};

export const normalizeCoverPosition = (position) => ({
  x: clampPercentage(position?.x),
  y: clampPercentage(position?.y),
});

export const coverPositionToStyle = (position) => {
  const normalized = normalizeCoverPosition(position);
  return `${normalized.x}% ${normalized.y}%`;
};

export const hasCoverPositionChanged = (position, reference) => {
  const current = normalizeCoverPosition(position);
  const saved = normalizeCoverPosition(reference);
  return Math.abs(current.x - saved.x) > 0.05 || Math.abs(current.y - saved.y) > 0.05;
};

export const moveCoverPosition = ({
  position,
  deltaX,
  deltaY,
  containerWidth,
  containerHeight,
  imageWidth,
  imageHeight,
}) => {
  const current = normalizeCoverPosition(position);
  const safeContainerWidth = Number(containerWidth);
  const safeContainerHeight = Number(containerHeight);
  const safeImageWidth = Number(imageWidth);
  const safeImageHeight = Number(imageHeight);

  if (
    safeContainerWidth <= 0
    || safeContainerHeight <= 0
    || safeImageWidth <= 0
    || safeImageHeight <= 0
  ) {
    return current;
  }

  const coverScale = Math.max(
    safeContainerWidth / safeImageWidth,
    safeContainerHeight / safeImageHeight,
  );
  const overflowX = Math.max(0, (safeImageWidth * coverScale) - safeContainerWidth);
  const overflowY = Math.max(0, (safeImageHeight * coverScale) - safeContainerHeight);

  return normalizeCoverPosition({
    x: overflowX > 0.5 ? current.x - ((Number(deltaX) || 0) / overflowX) * 100 : 50,
    y: overflowY > 0.5 ? current.y - ((Number(deltaY) || 0) / overflowY) * 100 : 50,
  });
};
