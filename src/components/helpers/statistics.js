export function normalDistribution(mean, stdDev, numPoints) {
  const points = [];
  const step = 100 / (numPoints - 1);
  
  for (let i = 0; i < numPoints; i++) {
    const x = i * step;
    const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * 
              Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
    points.push({ x, y });
  }
  
  return points;
} 