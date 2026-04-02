import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Dimensions,
    ActivityIndicator,
    StatusBar,
    Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { visualAPI } from '../../services/api';
import { BASE_URL } from '../../config/host';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BODY_WIDTH = SCREEN_WIDTH * 0.55;
const BODY_HEIGHT = SCREEN_HEIGHT * 0.65;

// ═══════════════════════════════════════════════════════════════════
// Anatomy Region Definitions (matching the HTML viewer)
// ═══════════════════════════════════════════════════════════════════
interface AnatomyRegion {
    id: string;
    category: string;
    label: string;
    icon: string;
    color: string;
    queryName: string;
}

const ANATOMY_REGIONS: AnatomyRegion[] = [
    { id: 'cranium', category: 'Head & Neck', label: 'Cranium / Brain', icon: '🧠', color: '#A78BFA', queryName: 'Brain' },
    { id: 'face', category: 'Head & Neck', label: 'Face / Maxillofacial', icon: '👁️', color: '#C4B5FD', queryName: 'Face' },
    { id: 'neck', category: 'Head & Neck', label: 'Neck / Cervical', icon: '🦴', color: '#818CF8', queryName: 'Neck' },
    { id: 'heart', category: 'Cardiopulmonary', label: 'Heart', icon: '❤️', color: '#F87171', queryName: 'Heart' },
    { id: 'left_lung', category: 'Cardiopulmonary', label: 'Left Lung', icon: '🫁', color: '#60A5FA', queryName: 'Left Lung' },
    { id: 'right_lung', category: 'Cardiopulmonary', label: 'Right Lung', icon: '🫁', color: '#60A5FA', queryName: 'Right Lung' },
    { id: 'stomach', category: 'Digestive System', label: 'Stomach', icon: '🍽️', color: '#34D399', queryName: 'Stomach' },
    { id: 'liver', category: 'Digestive System', label: 'Liver', icon: '🩸', color: '#6EE7B7', queryName: 'Liver' },
    { id: 'intestines', category: 'Digestive System', label: 'Intestines / Pelvis', icon: '🔄', color: '#34D399', queryName: 'Intestines' },
    { id: 'pectorals', category: 'Musculoskeletal', label: 'Pectoralis Major', icon: '💪', color: '#FBBF24', queryName: 'Pectorals' },
    { id: 'abdominals', category: 'Musculoskeletal', label: 'Rectus Abdominis', icon: '🛡️', color: '#F59E0B', queryName: 'Abdominals' },
    { id: 'trapezius', category: 'Musculoskeletal', label: 'Trapezius', icon: '🦴', color: '#FBBF24', queryName: 'Trapezius' },
    { id: 'lats', category: 'Musculoskeletal', label: 'Latissimus Dorsi', icon: '🦴', color: '#F59E0B', queryName: 'Lats' },
    { id: 'glutes', category: 'Musculoskeletal', label: 'Gluteus Maximus', icon: '🦴', color: '#D97706', queryName: 'Glutes' },
    { id: 'left_shoulder', category: 'Upper Limbs', label: 'Left Deltoid', icon: '🦾', color: '#38BDF8', queryName: 'Left Shoulder' },
    { id: 'right_shoulder', category: 'Upper Limbs', label: 'Right Deltoid', icon: '🦾', color: '#38BDF8', queryName: 'Right Shoulder' },
    { id: 'left_arm', category: 'Upper Limbs', label: 'Left Bicep / Tricep', icon: '💪', color: '#0EA5E9', queryName: 'Left Arm' },
    { id: 'right_arm', category: 'Upper Limbs', label: 'Right Bicep / Tricep', icon: '💪', color: '#0EA5E9', queryName: 'Right Arm' },
    { id: 'left_forearm', category: 'Upper Limbs', label: 'Left Forearm', icon: '✋', color: '#7DD3FC', queryName: 'Left Forearm' },
    { id: 'right_forearm', category: 'Upper Limbs', label: 'Right Forearm', icon: '✋', color: '#7DD3FC', queryName: 'Right Forearm' },
    { id: 'left_thigh', category: 'Lower Limbs', label: 'Left Quadricep', icon: '🦵', color: '#A3E635', queryName: 'Left Thigh' },
    { id: 'right_thigh', category: 'Lower Limbs', label: 'Right Quadricep', icon: '🦵', color: '#A3E635', queryName: 'Right Thigh' },
    { id: 'left_calf', category: 'Lower Limbs', label: 'Left Calf / Shin', icon: '🦵', color: '#84CC16', queryName: 'Left Calf' },
    { id: 'right_calf', category: 'Lower Limbs', label: 'Right Calf / Shin', icon: '🦵', color: '#84CC16', queryName: 'Right Calf' },
    { id: 'left_foot', category: 'Lower Limbs', label: 'Left Foot / Ankle', icon: '👟', color: '#65A30D', queryName: 'Left Foot' },
    { id: 'right_foot', category: 'Lower Limbs', label: 'Right Foot / Ankle', icon: '👟', color: '#65A30D', queryName: 'Right Foot' },
];

// ═══════════════════════════════════════════════════════════════════
// SVG Body Map Zone Paths (front-view human silhouette hit areas)
// Each path defines a tappable region on the body silhouette.
// Coordinates are relative to a 200x500 viewBox.
// ═══════════════════════════════════════════════════════════════════
const ZONE_PATHS: Record<string, string> = {
    cranium:        'M85,8 Q100,0 115,8 Q122,18 118,30 L82,30 Q78,18 85,8 Z',
    face:           'M82,30 L118,30 Q120,42 115,50 L85,50 Q80,42 82,30 Z',
    neck:           'M90,50 L110,50 L112,62 L88,62 Z',

    left_shoulder:  'M88,62 L72,65 Q62,68 58,78 L72,78 L88,72 Z',
    right_shoulder: 'M112,62 L128,65 Q138,68 142,78 L128,78 L112,72 Z',
    heart:          'M92,72 L100,68 L108,72 L108,90 L100,94 L92,90 Z',
    left_lung:      'M78,72 L92,72 L92,95 L78,95 Z',
    right_lung:     'M108,72 L122,72 L122,95 L108,95 Z',
    pectorals:      'M78,72 L122,72 L122,95 L78,95 Z',

    left_arm:       'M58,78 L72,78 L68,130 L54,130 Z',
    right_arm:      'M128,78 L142,78 L146,130 L132,130 Z',

    stomach:        'M90,95 L110,95 L112,120 L88,120 Z',
    liver:          'M78,95 L92,95 L90,115 L78,115 Z',
    abdominals:     'M85,95 L115,95 L115,130 L85,130 Z',

    left_forearm:   'M54,130 L68,130 L65,180 L50,180 Z',
    right_forearm:  'M132,130 L146,130 L150,180 L135,180 Z',

    intestines:     'M85,120 L115,120 L118,148 L82,148 Z',
    glutes:         'M82,140 L118,140 L118,160 L82,160 Z',

    left_thigh:     'M82,155 L100,155 L96,240 L78,240 Z',
    right_thigh:    'M100,155 L118,155 L122,240 L104,240 Z',

    left_calf:      'M78,240 L96,240 L93,340 L80,340 Z',
    right_calf:     'M104,240 L122,240 L120,340 L107,340 Z',

    left_foot:      'M76,340 L93,340 L92,360 Q86,368 74,365 Q72,358 76,340 Z',
    right_foot:     'M107,340 L124,340 Q128,358 126,365 Q114,368 108,360 L107,340 Z',

    trapezius:      'M85,62 L115,62 L118,72 L82,72 Z',
    lats:           'M78,95 L85,95 L85,130 L78,130 Z',
};

// Silhouette outline for the body shape
const BODY_OUTLINE = `
  M100,5 
  Q120,0 125,15 Q128,30 120,48 L115,50 L112,62
  L128,65 Q145,70 148,85 L150,130 L155,180 L148,182
  L146,130 L142,78 L128,78 L122,72 L122,95 L118,148
  L118,160 L122,240 L124,340 Q130,360 126,368 Q112,372 107,360
  L107,340 L104,240 L100,155 L96,240 L93,340
  Q92,360 88,368 Q74,372 70,360 L76,340 L78,240
  L82,160 L82,148 L78,95 L78,72 L72,78 L58,78
  Q55,70 50,180 L45,182 L48,130 L52,85 Q55,70 72,65
  L88,62 L85,50 L80,48
  Q72,30 75,15 Q80,0 100,5 Z
`;

// ═══════════════════════════════════════════════════════════════════
// Clinical Data Types
// ═══════════════════════════════════════════════════════════════════
interface ClinicalData {
    medications?: string[];
    diagnostics?: string[];
    other?: string[];
}

type BodyData = Record<string, ClinicalData>;

// ═══════════════════════════════════════════════════════════════════
// Entity Group Component
// ═══════════════════════════════════════════════════════════════════
const EntityGroup = ({ title, icon, items }: { title: string; icon: string; items: string[] }) => {
    if (!items || items.length === 0) return null;
    return (
        <View style={styles.entityGroup}>
            <View style={styles.entityGroupHeader}>
                <Text style={styles.entityGroupIcon}>{icon}</Text>
                <Text style={styles.entityGroupTitle}>{title.toUpperCase()}</Text>
                <View style={styles.entityGroupCount}>
                    <Text style={styles.entityGroupCountText}>{items.length}</Text>
                </View>
            </View>
            {items.map((name, idx) => (
                <View key={idx} style={styles.entityCard}>
                    <View style={styles.entityMain}>
                        <Text style={styles.entityName}>{name}</Text>
                        <View style={styles.entityMeta}>
                            <View style={styles.entityStatus}>
                                <Text style={styles.entityStatusText}>ACTIVE</Text>
                            </View>
                            <Text style={styles.entityDate}>Current</Text>
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Main Visualize Screen
// ═══════════════════════════════════════════════════════════════════
const VisualizeScreen = ({ navigation }: any) => {
    const webViewRef = useRef<any>(null);
    const [activeZone, setActiveZone] = useState<string | null>(null);
    const [showPanel, setShowPanel] = useState(false);
    const [showDirectory, setShowDirectory] = useState(true);
    const [bodyData, setBodyData] = useState<BodyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [zoneData, setZoneData] = useState<ClinicalData | null>(null);

    // Hide HTML overlay UI in the WebView and fix canvas container spacing
    const injectJS = `
        const style = document.createElement('style');
        style.innerHTML = 'header, #btn-chat, #chat-overlay, #overlay-panel, #hint { display: none !important; } #canvas-container { top: 0 !important; height: 100vh !important; } .zone-tooltip { transform: scale(1.5); }';
        document.head.appendChild(style);
        document.body.style.backgroundColor = 'transparent';
        true;
    `;

    const onWebViewMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'ZONE_CLICK' && data.zoneId) {
                selectZone(data.zoneId);
            }
        } catch (e) {
            console.log('WebView message parse error:', e);
        }
    };

    // Animations
    const panelAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fabAnim = useRef(new Animated.Value(1)).current;

    // Fetch body map data
    useEffect(() => {
        fetchBodyData();
    }, []);

    const fetchBodyData = async () => {
        try {
            const res = await visualAPI.getBodyData();
            setBodyData(res.data);
        } catch (e) {
            console.log('Failed to fetch body data:', e);
            // Fallback data
            setBodyData({
                Heart: { medications: ['Telmisartan', 'Atorvastatin'], diagnostics: ['Systemic Hypertension', 'Blood Pressure', 'LDL Cholesterol'], other: [] },
                Stomach: { medications: ['Metformin'], diagnostics: [], other: ['Increased thirst', 'Frequent urination'] },
                Intestines: { medications: [], diagnostics: ['Type 2 Diabetes Mellitus', 'Fasting Blood Glucose', 'Postprandial Glucose', 'HbA1c'], other: ['Polyuria', 'Polydipsia'] },
                Liver: { medications: ['Metformin', 'Atorvastatin'], diagnostics: ['Type 2 Diabetes Mellitus', 'HbA1c', 'Fasting Blood Glucose', 'Postprandial Glucose', 'LDL Cholesterol'], other: ['Fatigue', 'Unintentional weight loss'] },
            });
        } finally {
            setLoading(false);
        }
    };

    // Pulse animation for active zone
    useEffect(() => {
        if (activeZone) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [activeZone]);

    const openPanel = useCallback(() => {
        setShowPanel(true);
        Animated.spring(panelAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
        Animated.timing(fabAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }, [panelAnim, fabAnim]);

    const closePanel = useCallback(() => {
        Animated.timing(panelAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
            setShowPanel(false);
            setShowDirectory(true);
            setActiveZone(null);
            setZoneData(null);
            if (Platform.OS === 'web') {
                try {
                    // @ts-ignore
                    webViewRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'CLEAR_HIGHLIGHT' }), '*');
                } catch (e) {}
            } else {
                webViewRef.current?.injectJavaScript(`if(window.clearHighlight) window.clearHighlight(); if(window.controls) window.controls.autoRotate = true; window.activeZone = null; true;`);
            }
        });
        Animated.timing(fabAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }, [panelAnim, fabAnim]);

    const selectZone = useCallback((zoneId: string) => {
        setActiveZone(zoneId);
        const region = ANATOMY_REGIONS.find(r => r.id === zoneId);
        if (region && bodyData) {
            setZoneData(bodyData[region.queryName] || null);
        }
        setShowDirectory(false);
        openPanel();
    }, [bodyData, openPanel]);

    const selectZoneFromDirectory = useCallback((zoneId: string) => {
        selectZone(zoneId);
        if (Platform.OS === 'web') {
            try {
                // @ts-ignore
                webViewRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'SELECT_ZONE', zoneId }), '*');
            } catch (e) {}
        } else {
            webViewRef.current?.injectJavaScript(`if(window.selectZone) window.selectZone('${zoneId}'); true;`);
        }
    }, [selectZone]);

    const goBackToDirectory = useCallback(() => {
        setShowDirectory(true);
        setActiveZone(null);
        setZoneData(null);
    }, []);

    const getRegionInfo = (zoneId: string) => ANATOMY_REGIONS.find(r => r.id === zoneId);

    // Has data indicator
    const hasData = (zoneId: string): boolean => {
        const region = ANATOMY_REGIONS.find(r => r.id === zoneId);
        if (!region || !bodyData) return false;
        const data = bodyData[region.queryName];
        if (!data) return false;
        return (data.medications?.length || 0) + (data.diagnostics?.length || 0) + (data.other?.length || 0) > 0;
    };

    // Panel translate
    const panelTranslate = panelAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [SCREEN_HEIGHT * 0.55, 0],
    });

    // Group regions by category
    const categorized = ANATOMY_REGIONS.reduce<Record<string, AnatomyRegion[]>>((acc, r) => {
        if (!acc[r.category]) acc[r.category] = [];
        acc[r.category].push(r);
        return acc;
    }, {});

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <StatusBar barStyle="light-content" />
                <View style={styles.loadingInner}>
                    <View style={styles.loadingPulse}>
                        <Ionicons name="heart" size={36} color={theme.colors.accent} />
                    </View>
                    <Text style={styles.loadingTitle}>HealthLink</Text>
                    <Text style={styles.loadingSub}>Loading anatomical model...</Text>
                    <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 16 }} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* ── HEADER ────────────────────────────────────── */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity 
                        style={styles.logoIcon}
                        onPress={() => {
                            try {
                                navigation.navigate('Home', { screen: 'Chat' });
                            } catch {
                                console.log("Could not navigate to Chat.");
                            }
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chatbubbles" size={20} color={theme.colors.accent} />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.brandText}>HealthLink</Text>
                        <Text style={styles.taglineText}>Dynamic Health Canvas</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        style={[styles.headerBtn, activeZone ? styles.headerBtnActive : null]}
                        onPress={() => { setActiveZone(null); closePanel(); }}
                    >
                        <Ionicons name="refresh" size={18} color={activeZone ? theme.colors.accent : theme.colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={openPanel}
                    >
                        <Ionicons name="list" size={18} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── BODY MAP (3D Model via WebView) ──────────────────────────────────── */}
            <View style={styles.bodyContainer}>
                {Platform.OS === 'web' ? (
                    // @ts-ignore
                    <iframe
                        ref={webViewRef}
                        src={`${BASE_URL}/viewer?source=rnweb`}
                        style={{ flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: theme.colors.bgDark }}
                        onLoad={(e: any) => {
                            setLoading(false);
                            // Set up listener for messages from iframe
                            window.addEventListener('message', (event) => {
                                try {
                                    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                                    if (data.type === 'ZONE_CLICK' && data.zoneId) {
                                        selectZone(data.zoneId);
                                    }
                                } catch (err) {}
                            });
                            // Inject CSS into iframe if same origin
                            try {
                                const iframeDoc = e.target.contentDocument || e.target.contentWindow.document;
                                const style = iframeDoc.createElement('style');
                                style.innerHTML = 'header, #btn-chat, #chat-overlay, #overlay-panel, #hint { display: none !important; } #canvas-container { top: 0 !important; height: 100vh !important; } .zone-tooltip { transform: scale(1.5); }';
                                iframeDoc.head.appendChild(style);
                                iframeDoc.body.style.backgroundColor = 'transparent';
                            } catch (err) {
                                // Ignore CORS errors if cross-origin
                            }
                        }}
                    />
                ) : (
                    <WebView
                        ref={webViewRef}
                        source={{ uri: `${BASE_URL}/viewer` }}
                        style={{ flex: 1, width: SCREEN_WIDTH, backgroundColor: theme.colors.bgDark }}
                        injectedJavaScript={injectJS}
                        onMessage={onWebViewMessage}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        bounces={false}
                        scrollEnabled={false}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        onLoadEnd={() => setLoading(false)}
                    />
                )}

                {/* Active zone label (overlay native) */}
                {activeZone && (
                    <View style={styles.zoneLabelContainer} pointerEvents="none">
                        <View style={[styles.zoneLabel, { borderColor: getRegionInfo(activeZone)?.color + '60' }]}>
                            <Text style={styles.zoneLabelIcon}>{getRegionInfo(activeZone)?.icon}</Text>
                            <Text style={[styles.zoneLabelText, { color: getRegionInfo(activeZone)?.color }]}>
                                {getRegionInfo(activeZone)?.label}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Hint */}
                {!activeZone && (
                    <View style={styles.hintContainer} pointerEvents="none">
                        <Text style={styles.hintText}>👆 Tap a 3D region to explore health data</Text>
                    </View>
                )}
            </View>

            {/* ── ANATOMY PANEL (Bottom Sheet) ──────────────── */}
            {showPanel && (
                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={closePanel}
                >
                    <View />
                </TouchableOpacity>
            )}

            {showPanel && (
                <Animated.View
                    style={[
                        styles.panel,
                        { transform: [{ translateY: panelTranslate }] },
                    ]}
                >
                    {/* Panel handle */}
                    <View style={styles.panelHandle}>
                        <View style={styles.panelHandleBar} />
                    </View>

                    {/* Close button */}
                    <TouchableOpacity style={styles.panelClose} onPress={closePanel}>
                        <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                    </TouchableOpacity>

                    <ScrollView
                        style={styles.panelScroll}
                        contentContainerStyle={styles.panelScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {showDirectory ? (
                            /* ── Directory View ────────────────── */
                            <View>
                                <Text style={styles.panelTitle}>Anatomical Directory</Text>
                                <Text style={styles.panelSubtitle}>Select a specific organ, muscle, or region</Text>

                                {Object.entries(categorized).map(([category, regions]) => (
                                    <View key={category} style={styles.dirCategory}>
                                        <Text style={styles.dirCategoryTitle}>{category}</Text>
                                        {regions.map(region => (
                                            <TouchableOpacity
                                                key={region.id}
                                                style={[
                                                    styles.dirItem,
                                                    hasData(region.id) && styles.dirItemWithData,
                                                ]}
                                                onPress={() => selectZoneFromDirectory(region.id)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.dirItemIcon}>{region.icon}</Text>
                                                <Text style={[styles.dirItemLabel, { color: region.color }]}>
                                                    {region.label}
                                                </Text>
                                                {hasData(region.id) && (
                                                    <View style={[styles.dataDot, { backgroundColor: region.color }]} />
                                                )}
                                                <Ionicons name="chevron-forward" size={16} color={theme.colors.gray} />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ))}
                                <View style={{ height: 40 }} />
                            </View>
                        ) : (
                            /* ── Zone Detail View ──────────────── */
                            <View>
                                {/* Back button */}
                                <TouchableOpacity style={styles.backRow} onPress={goBackToDirectory}>
                                    <Ionicons name="arrow-back" size={18} color={theme.colors.textMuted} />
                                    <Text style={styles.backText}>Back to Directory</Text>
                                </TouchableOpacity>

                                {activeZone && getRegionInfo(activeZone) && (
                                    <View>
                                        {/* Zone header */}
                                        <View style={styles.detailHeader}>
                                            <Text style={styles.detailIcon}>{getRegionInfo(activeZone)!.icon}</Text>
                                            <View>
                                                <Text style={styles.detailCategory}>{getRegionInfo(activeZone)!.category}</Text>
                                                <Text style={[styles.detailName, { color: getRegionInfo(activeZone)!.color }]}>
                                                    {getRegionInfo(activeZone)!.label}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Clinical data */}
                                        {zoneData ? (
                                            <View style={styles.entityContainer}>
                                                <View style={styles.sectionLabel}>
                                                    <Text style={styles.sectionLabelText}>🔗 Clinical Data Map</Text>
                                                </View>
                                                <EntityGroup title="Diagnostics" icon="🩺" items={zoneData.diagnostics || []} />
                                                <EntityGroup title="Medications" icon="💊" items={zoneData.medications || []} />
                                                <EntityGroup title="Other Records" icon="📋" items={zoneData.other || []} />
                                            </View>
                                        ) : (
                                            <View style={styles.noDataContainer}>
                                                <Ionicons name="document-text-outline" size={40} color={theme.colors.gray} />
                                                <Text style={styles.noDataText}>No clinical records found for this region.</Text>
                                                <Text style={styles.noDataSub}>Upload medical reports to see data mapped to body regions.</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                                <View style={{ height: 40 }} />
                            </View>
                        )}
                    </ScrollView>
                </Animated.View>
            )}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bgDark,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingInner: {
        alignItems: 'center',
    },
    loadingPulse: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,201,167,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    loadingTitle: {
        ...theme.typography.h2,
        marginBottom: 6,
    },
    loadingSub: {
        fontSize: 14,
        color: theme.colors.textMuted,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 56 : 42,
        paddingHorizontal: 16,
        paddingBottom: 10,
        backgroundColor: theme.colors.bgDark,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(0,201,167,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    brandText: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
    } as any,
    taglineText: {
        fontSize: 11,
        color: theme.colors.textMuted,
        letterSpacing: 0.3,
    },
    headerRight: {
        flexDirection: 'row',
        gap: 8,
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: theme.colors.bgCard,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerBtnActive: {
        backgroundColor: 'rgba(0,201,167,0.12)',
    },

    // Body Map
    bodyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bodySvg: {
        // SVG styles handled by viewBox
    },
    zoneLabelContainer: {
        position: 'absolute',
        top: 12,
        alignSelf: 'center',
    },
    zoneLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.bgCard,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadow.card,
    },
    zoneLabelIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    zoneLabelText: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.text,
    } as any,
    hintContainer: {
        position: 'absolute',
        bottom: 90,
        alignSelf: 'center',
    },
    hintText: {
        fontSize: 13,
        color: theme.colors.textMuted,
        textAlign: 'center',
        backgroundColor: theme.colors.bgCard + 'CC',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
    },

    // Chat FAB
    chatFab: {
        position: 'absolute',
        bottom: 100,
        right: 20,
        zIndex: 50,
    },
    chatFabBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.accent,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 28,
        ...theme.shadow.glow,
    },
    chatFabText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0D1117',
        marginLeft: 8,
    } as any,

    // Overlay
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 90,
    },

    // Panel
    panel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.55,
        backgroundColor: theme.colors.bgCard,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        zIndex: 100,
        ...theme.shadow.card,
    },
    panelHandle: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    panelHandleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.colors.gray,
    },
    panelClose: {
        position: 'absolute',
        top: 12,
        right: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.colors.bgDark,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    panelScroll: {
        flex: 1,
    },
    panelScrollContent: {
        padding: 20,
        paddingTop: 8,
    },

    // Directory
    panelTitle: {
        ...theme.typography.h2,
        marginBottom: 4,
    },
    panelSubtitle: {
        fontSize: 13,
        color: theme.colors.textMuted,
        marginBottom: 20,
    },
    dirCategory: {
        marginBottom: 16,
    },
    dirCategoryTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.colors.textMuted,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 8,
        paddingLeft: 4,
    } as any,
    dirItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 4,
        backgroundColor: theme.colors.bgDark,
    },
    dirItemWithData: {
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.accent,
    },
    dirItemIcon: {
        fontSize: 20,
        marginRight: 12,
        width: 28,
        textAlign: 'center',
    },
    dirItemLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: theme.colors.text,
    } as any,
    dataDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },

    // Detail
    backRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backText: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginLeft: 8,
    },
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    detailIcon: {
        fontSize: 36,
        marginRight: 14,
    },
    detailCategory: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.textMuted,
        letterSpacing: 1,
        textTransform: 'uppercase',
    } as any,
    detailName: {
        fontSize: 22,
        fontWeight: '700',
        color: theme.colors.text,
        marginTop: 2,
    } as any,

    // Entity groups
    entityContainer: {
        marginTop: 4,
    },
    sectionLabel: {
        marginBottom: 14,
    },
    sectionLabelText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.textMuted,
        letterSpacing: 0.3,
    } as any,
    entityGroup: {
        marginBottom: 18,
    },
    entityGroupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    entityGroupIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    entityGroupTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.colors.textMuted,
        letterSpacing: 1.2,
        flex: 1,
    } as any,
    entityGroupCount: {
        backgroundColor: 'rgba(0,201,167,0.12)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    entityGroupCountText: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.colors.accent,
    } as any,
    entityCard: {
        backgroundColor: theme.colors.bgDark,
        borderRadius: 12,
        padding: 14,
        marginBottom: 6,
    },
    entityMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    entityName: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.colors.text,
        flex: 1,
    } as any,
    entityMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    entityStatus: {
        backgroundColor: 'rgba(0,201,167,0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    entityStatusText: {
        fontSize: 9,
        fontWeight: '800',
        color: theme.colors.accent,
        letterSpacing: 0.5,
    } as any,
    entityDate: {
        fontSize: 11,
        color: theme.colors.textMuted,
    },

    // No data
    noDataContainer: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    noDataText: {
        fontSize: 15,
        color: theme.colors.textMuted,
        marginTop: 12,
        textAlign: 'center',
    },
    noDataSub: {
        fontSize: 12,
        color: theme.colors.gray,
        marginTop: 6,
        textAlign: 'center',
    },
});

export default VisualizeScreen;
