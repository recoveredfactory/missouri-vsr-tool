// Ordinary least squares + Student's t hypothesis testing, hand-rolled to
// avoid pulling in scipy or any large stats library. All inputs are arrays
// of finite numbers of equal length; callers are responsible for filtering
// out NaN/null before passing in.

export interface LinearRegression {
  slope: number;
  intercept: number;
  /** Standard error of the slope estimate. */
  se_slope: number;
  /** Two-sided t statistic for H0: slope = 0. */
  t_stat: number;
  /** Degrees of freedom (n - 2). */
  df: number;
  /** Two-sided p-value from the Student's t distribution. */
  p_value: number;
  /** 95% CI half-width (slope ± this). Uses the t-critical value at df. */
  ci95_half: number;
  /** R^2 coefficient of determination. */
  r_squared: number;
  /** Mean of x values (years, typically). */
  mean_x: number;
  /** Mean of y values (rates, typically). */
  mean_y: number;
}

export const linreg = (xs: number[], ys: number[]): LinearRegression | null => {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  let sse = 0;
  for (let i = 0; i < n; i += 1) {
    const residual = ys[i] - (intercept + slope * xs[i]);
    sse += residual * residual;
  }
  const df = n - 2;
  if (df < 1) return null;
  const mse = sse / df;
  const seSlope = Math.sqrt(mse / sxx);
  const tStat = seSlope === 0 ? 0 : slope / seSlope;

  const pValue = studentTTwoSidedP(tStat, df);
  const tCrit = studentTCritical975(df);
  const ci95Half = tCrit * seSlope;
  const rSquared = syy === 0 ? 1 : 1 - sse / syy;

  return {
    slope,
    intercept,
    se_slope: seSlope,
    t_stat: tStat,
    df,
    p_value: pValue,
    ci95_half: ci95Half,
    r_squared: rSquared,
    mean_x: meanX,
    mean_y: meanY,
  };
};

// Lookup table of the 0.975 quantile of Student's t for df 1..30, then a
// piecewise transition to the normal approximation (1.96) for df > 30.
const T_CRIT_975: Record<number, number> = {
  1: 12.706,
  2: 4.303,
  3: 3.182,
  4: 2.776,
  5: 2.571,
  6: 2.447,
  7: 2.365,
  8: 2.306,
  9: 2.262,
  10: 2.228,
  11: 2.201,
  12: 2.179,
  13: 2.16,
  14: 2.145,
  15: 2.131,
  16: 2.12,
  17: 2.11,
  18: 2.101,
  19: 2.093,
  20: 2.086,
  21: 2.08,
  22: 2.074,
  23: 2.069,
  24: 2.064,
  25: 2.06,
  26: 2.056,
  27: 2.052,
  28: 2.048,
  29: 2.045,
  30: 2.042,
};

export const studentTCritical975 = (df: number): number => {
  if (df <= 0) return Number.NaN;
  if (df <= 30) return T_CRIT_975[df] ?? T_CRIT_975[30];
  return 1.96 + (T_CRIT_975[30] - 1.96) * (30 / df);
};

// Two-sided p-value for Student's t: p = I(df/(df+t^2), df/2, 1/2) where I
// is the regularized incomplete beta. This is the standard closed form
// (see e.g. Numerical Recipes ch. 6).
export const studentTTwoSidedP = (t: number, df: number): number => {
  if (!Number.isFinite(t) || df <= 0) return Number.NaN;
  const x = df / (df + t * t);
  return regularizedIncompleteBeta(x, df / 2, 0.5);
};

// Lentz's continued-fraction evaluation of the regularized incomplete beta
// function I_x(a, b). Adapted from Numerical Recipes 6.4.
const regularizedIncompleteBeta = (x: number, a: number, b: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const lnBeta =
    logGamma(a + b) - logGamma(a) - logGamma(b);
  const front =
    Math.exp(lnBeta + a * Math.log(x) + b * Math.log(1 - x));

  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(x, a, b)) / a;
  }
  return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
};

const betaContinuedFraction = (x: number, a: number, b: number): number => {
  const EPS = 3.0e-7;
  const MAX_ITER = 200;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) return h;
  }
  return h;
};

// Lanczos approximation of log Gamma.
const LANCZOS = [
  76.18009172947146,
  -86.50532032941677,
  24.01409824083091,
  -1.231739572450155,
  0.1208650973866179e-2,
  -0.5395239384953e-5,
];

const logGamma = (x: number): number => {
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j += 1) {
    y += 1;
    ser += LANCZOS[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
};
