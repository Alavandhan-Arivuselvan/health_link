/**
 * StatsScreen.tsx – "Your Daily Pulse"
 * ─────────────────────────────────────
 * Wellness dashboard that fetches Fitbit insights from the backend:
 *   1. Body Battery Energy Forecast  (from wear.py → forecast_body_battery)
 *   2. Sleep Consistency Streaks     (from wear.py → calculate_sleep_streaks_and_nudges)
 *   3. Personalized Nudges           (from wear.py → generate_personalized_nudges)
 *
 * Backend endpoints used:
 *   GET  /api/fitbit-insights  → all 3 insights + last_sync
 *   POST /api/fitbit-refresh   → re-fetch from Google Fit API
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { BASE_URL } from '../../config/host';

// ─── Color palette for wellness cards ───────────────────────────
const COLORS = {
  teal: '#00C9A7',
  tealLight: 'rgba(0, 201, 167, 0.12)',
  purple: '#8b5cf6',
  purpleLight: 'rgba(139, 92, 246, 0.15)',
  amber: '#f59e0b',
  amberLight: 'rgba(245, 158, 11, 0.15)',
  green: '#22c55e',
  greenLight: 'rgba(34, 197, 94, 0.15)',
  red: '#ef4444',
  redLight: 'rgba(239, 68, 68, 0.15)',
  cardBg: '#161B22',
  cardBorder: 'rgba(48, 54, 61, 0.4)',
};

// ─── Types matching backend response ────────────────────────────

interface FactorDetail {
  value: number;
  unit: string;
  score: number;
}

interface EnergyForecast {
  date: string;
  forecast: string;
  nudge: string;
  energy_level: 'low' | 'high' | 'average';
  energy_score: number;
  factors: {
    sleep_efficiency: FactorDetail;
    sleep_duration: FactorDetail;
    deep_sleep: FactorDetail;
    steps: FactorDetail;
    resting_hr: FactorDetail;
    spo2: FactorDetail;
    active_zone_min: FactorDetail;
    calories: FactorDetail;
  };
}

interface SleepConsistency {
  current_streak: number;
  max_streak: number;
  late_nights_in_row: number;
  average_bedtime: string;
  average_sleep_hours: number;
  nudge: string;
}

interface StepConsistency {
  average_steps: number;
  total_days: number;
  current_streak: number;
  best_streak: number;
  best_day: { date: string; steps: number };
  worst_day: { date: string; steps: number };
  days_at_goal: number;
  goal: number;
  nudges: string[];
}

interface InsightsResponse {
  status: string;
  last_sync: string;
  energy_forecast: EnergyForecast;
  sleep_consistency: SleepConsistency;
  nudges: string[];
  step_consistency: StepConsistency;
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENTS
// ═══════════════════════════════════════════════════════════════

/** Section card wrapper with icon header */
const InsightCard = ({
  icon,
  iconFamily,
  iconColor,
  iconBg,
  title,
  children,
}: {
  icon: string;
  iconFamily: 'ionicons' | 'material' | 'feather';
  iconColor: string;
  iconBg: string;
  title: string;
  children: React.ReactNode;
}) => {
  const IconComponent =
    iconFamily === 'material'
      ? MaterialCommunityIcons
      : iconFamily === 'feather'
        ? Feather
        : Ionicons;

  return (
    <View style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <View style={[styles.insightIconCircle, { backgroundColor: iconBg }]}>
          <IconComponent name={icon as any} size={20} color={iconColor} />
        </View>
        <Text style={styles.insightTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
};

/** Small stat pill (used inside cards) */
const StatPill = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <View style={[styles.statPill, { borderColor: color + '30' }]}>
    <Text style={[styles.statPillValue, { color }]}>{value}</Text>
    <Text style={styles.statPillLabel}>{label}</Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════

const StatsScreen = () => {
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Backend insight data
  const [energyForecast, setEnergyForecast] = useState<EnergyForecast | null>(null);
  const [sleepConsistency, setSleepConsistency] = useState<SleepConsistency | null>(null);
  const [nudges, setNudges] = useState<string[]>([]);
  const [stepConsistency, setStepConsistency] = useState<StepConsistency | null>(null);

  // ── Fetch insights from backend ───────────────────────────────
  const fetchInsights = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${BASE_URL}/api/fitbit-insights`);

      if (res.status === 404) {
        // No data file yet — show connect screen
        setHasData(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data: InsightsResponse = await res.json();
      setEnergyForecast(data.energy_forecast);
      setSleepConsistency(data.sleep_consistency);
      setNudges(data.nudges);
      setStepConsistency(data.step_consistency);
      setLastSync(data.last_sync);
      setHasData(true);
    } catch (e: any) {
      setError('Failed to load data. Pull down to retry.');
      console.error('StatsScreen fetchInsights error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // ── Refresh: re-fetch data from Fitbit API via backend ────────
  const handleRefreshFromFitbit = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await fetch(`${BASE_URL}/api/fitbit-refresh`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Refresh failed: ${res.status}`);
      }
      // Now fetch the updated insights
      await fetchInsights();
    } catch (e: any) {
      setError(e.message || 'Failed to sync with Google Fit');
    } finally {
      setSyncing(false);
    }
  };

  // ── Pull-to-refresh ───────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInsights();
  }, [fetchInsights]);

  // ── Format last sync ─────────────────────────────────────────
  const formatSyncTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  // ── Energy level color helper ─────────────────────────────────
  const energyColor = (level: string) => {
    switch (level) {
      case 'high': return COLORS.green;
      case 'low': return COLORS.red;
      default: return COLORS.amber;
    }
  };
  const energyBg = (level: string) => {
    switch (level) {
      case 'high': return COLORS.greenLight;
      case 'low': return COLORS.redLight;
      default: return COLORS.amberLight;
    }
  };
  const energyIcon = (level: string) => {
    switch (level) {
      case 'high': return 'battery-full';
      case 'low': return 'battery-dead';
      default: return 'battery-half';
    }
  };

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════

  // Loading state
  if (loading) {
    return (
      <GradientBackground style={styles.container}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={COLORS.teal} />
          <Text style={styles.loadingText}>Loading your wellness data…</Text>
        </View>
      </GradientBackground>
    );
  }

  // No data file → show "Connect" / sync prompt
  if (!hasData) {
    return (
      <GradientBackground style={styles.container}>
        <ScrollView contentContainerStyle={styles.centeredContent} showsVerticalScrollIndicator={false}>
          {/* Decorative icon */}
          <View style={styles.connectIconWrapper}>
            <View
              style={styles.connectIconGradient}
            >
              <MaterialCommunityIcons name="watch" size={48} color={COLORS.teal} />
            </View>
          </View>

          <Text style={styles.connectTitle}>Connect Google Fit</Text>
          <Text style={styles.connectSubtitle}>
            Sync your Google Fit data to get personalized energy forecasts, sleep insights, and daily wellness nudges.
          </Text>

          {/* Feature pills */}
          <View style={styles.featurePills}>
            {[
              { icon: 'battery-charging', label: 'Energy Forecast', color: COLORS.amber },
              { icon: 'moon', label: 'Sleep Streaks', color: COLORS.purple },
              { icon: 'bulb', label: 'Smart Nudges', color: COLORS.teal },
            ].map((f) => (
              <View key={f.label} style={[styles.featurePill, { borderColor: f.color + '40' }]}>
                <Ionicons name={f.icon as any} size={16} color={f.color} />
                <Text style={[styles.featurePillText, { color: f.color }]}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Sync button — triggers backend to fetch from Fitbit API */}
          <TouchableOpacity onPress={handleRefreshFromFitbit} activeOpacity={0.85} disabled={syncing}>
            <View
              style={styles.connectButton}
            >
              {syncing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sync" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.connectButtonText}>Sync Google Fit Data</Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>
      </GradientBackground>
    );
  }

  // ── Has data — show insights ──────────────────────────────────
  return (
    <GradientBackground style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Your Daily Pulse</Text>
            {lastSync && (
              <Text style={styles.syncText}>
                Last sync: {formatSyncTime(lastSync)}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleRefreshFromFitbit}
            style={styles.refreshBtn}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={COLORS.teal} />
            ) : (
              <Ionicons name="sync" size={18} color={COLORS.teal} />
            )}
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={16} color={COLORS.red} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* ── Card 1: Body Battery Energy Forecast ── */}
        {energyForecast && (
          <InsightCard
            icon={energyIcon(energyForecast.energy_level)}
            iconFamily="ionicons"
            iconColor={energyColor(energyForecast.energy_level)}
            iconBg={energyBg(energyForecast.energy_level)}
            title="Energy Forecast"
          >
            <View style={[
              styles.forecastBadge,
              { backgroundColor: energyBg(energyForecast.energy_level) },
            ]}>
              <Text style={[styles.forecastLabel, { color: energyColor(energyForecast.energy_level) }]}>
                {energyForecast.forecast}  •  {energyForecast.energy_score}/100
              </Text>
            </View>
            <Text style={styles.forecastNudge}>{energyForecast.nudge}</Text>

            <View style={styles.statPillRow}>
              <StatPill
                label="Sleep"
                value={`${energyForecast.factors.sleep_duration.value}h`}
                color={COLORS.purple}
              />
              <StatPill
                label="Heart Rate"
                value={`${energyForecast.factors.resting_hr.value} bpm`}
                color={COLORS.red}
              />
              <StatPill
                label="SpO2"
                value={`${energyForecast.factors.spo2?.value ?? '—'}%`}
                color={COLORS.teal}
              />
            </View>
          </InsightCard>
        )}

        {/* ── Card 2: Sleep Consistency Streaks ── */}
        {sleepConsistency && (
          <InsightCard
            icon="bed"
            iconFamily="material"
            iconColor={COLORS.purple}
            iconBg={COLORS.purpleLight}
            title="Sleep Consistency"
          >
            {/* Streak counters */}
            <View style={styles.streakRow}>
              <View style={styles.streakItem}>
                <Text style={styles.streakNumber}>{sleepConsistency.current_streak}</Text>
                <Text style={styles.streakLabel}>Current</Text>
              </View>
              <View style={styles.streakDivider} />
              <View style={styles.streakItem}>
                <Text style={styles.streakNumber}>{sleepConsistency.max_streak}</Text>
                <Text style={styles.streakLabel}>Best</Text>
              </View>
              <View style={styles.streakDivider} />
              <View style={styles.streakItem}>
                <Text style={[styles.streakNumber, { fontSize: 18 }]}>
                  {sleepConsistency.average_bedtime}
                </Text>
                <Text style={styles.streakLabel}>Avg Bedtime</Text>
              </View>
              <View style={styles.streakDivider} />
              <View style={styles.streakItem}>
                <Text style={[styles.streakNumber, { fontSize: 18 }]}>
                  {sleepConsistency.average_sleep_hours}h
                </Text>
                <Text style={styles.streakLabel}>Avg Sleep</Text>
              </View>
            </View>

            {sleepConsistency.late_nights_in_row > 0 && (
              <View style={styles.lateNightBadge}>
                <Ionicons name="alert-circle" size={14} color={COLORS.amber} />
                <Text style={styles.lateNightText}>
                  {sleepConsistency.late_nights_in_row} recent late night
                  {sleepConsistency.late_nights_in_row > 1 ? 's' : ''}
                </Text>
              </View>
            )}

            <Text style={styles.consistencyMessage}>{sleepConsistency.nudge}</Text>
          </InsightCard>
        )}

        {/* ── Card 3: Step Consistency ── */}
        {stepConsistency && (
          <InsightCard
            icon="footsteps"
            iconFamily="ionicons"
            iconColor={COLORS.teal}
            iconBg={COLORS.tealLight}
            title="Step Consistency"
          >
            {/* Goal badge */}
            <View style={[styles.forecastBadge, { backgroundColor: COLORS.tealLight, marginBottom: 14 }]}>
              <Text style={[styles.forecastLabel, { color: COLORS.teal }]}>
                🎯 Goal: {stepConsistency.goal.toLocaleString()} steps
              </Text>
            </View>

            {/* Step stats row */}
            <View style={styles.streakRow}>
              <View style={styles.streakItem}>
                <Text style={styles.streakNumber}>{stepConsistency.average_steps.toLocaleString()}</Text>
                <Text style={styles.streakLabel}>Avg Steps</Text>
              </View>
              <View style={styles.streakDivider} />
              <View style={styles.streakItem}>
                <Text style={styles.streakNumber}>{stepConsistency.current_streak}</Text>
                <Text style={styles.streakLabel}>Streak</Text>
              </View>
              <View style={styles.streakDivider} />
              <View style={styles.streakItem}>
                <Text style={styles.streakNumber}>{stepConsistency.best_streak}</Text>
                <Text style={styles.streakLabel}>Best</Text>
              </View>
              <View style={styles.streakDivider} />
              <View style={styles.streakItem}>
                <Text style={styles.streakNumber}>{stepConsistency.days_at_goal}/{stepConsistency.total_days}</Text>
                <Text style={styles.streakLabel}>Goal Days</Text>
              </View>
            </View>

            {/* Best / Worst day pills */}
            <View style={styles.statPillRow}>
              <StatPill
                label={`Best (${stepConsistency.best_day.date.slice(5)})`}
                value={stepConsistency.best_day.steps.toLocaleString()}
                color={COLORS.green}
              />
              <StatPill
                label={`Low (${stepConsistency.worst_day.date.slice(5)})`}
                value={stepConsistency.worst_day.steps.toLocaleString()}
                color={COLORS.red}
              />
            </View>

            {/* Step nudges */}
            {stepConsistency.nudges.map((nudge, i) => (
              <View key={i} style={[styles.nudgeRow, { marginTop: i === 0 ? 12 : 0 }]}>
                <Text style={styles.nudgeText}>{nudge}</Text>
              </View>
            ))}
          </InsightCard>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </GradientBackground>
  );
};

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Centered (loading / not-connected) ────────────────────────
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.l,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.l,
    paddingTop: 80,
  },

  // ── Connect Screen ────────────────────────────────────────────
  connectIconWrapper: {
    marginBottom: 28,
  },
  connectIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  connectSubtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 10,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  featurePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 999,
    minWidth: 220,
    minHeight: 54,
    backgroundColor: COLORS.teal,
  },
  connectButtonText: {
    color: '#0D1117',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Connected Screen ──────────────────────────────────────────
  content: {
    padding: theme.spacing.m,
    paddingTop: 56,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  syncText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.tealLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },

  // ── Error ─────────────────────────────────────────────────────
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: COLORS.red,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.redLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 13,
    color: COLORS.red,
    flex: 1,
  },

  // ── Insight Card ──────────────────────────────────────────────
  insightCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: theme.borderRadius.m,
    padding: 20,
    marginBottom: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  insightIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },

  // ── Energy Forecast ───────────────────────────────────────────
  forecastBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 10,
  },
  forecastLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  forecastNudge: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },

  // ── Stat Pills ────────────────────────────────────────────────
  statPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  statPillValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statPillLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },

  // ── Sleep Consistency ─────────────────────────────────────────
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  streakItem: {
    flex: 1,
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  streakLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  streakDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.cardBorder,
  },
  lateNightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.amberLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 10,
    gap: 6,
    alignSelf: 'flex-start',
  },
  lateNightText: {
    fontSize: 13,
    color: COLORS.amber,
    fontWeight: '600',
  },
  consistencyMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },

  // ── Nudges ────────────────────────────────────────────────────
  nudgeRow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  nudgeText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});

export default StatsScreen;
