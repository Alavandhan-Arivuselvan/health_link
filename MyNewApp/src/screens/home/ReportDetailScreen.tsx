import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    Dimensions,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { BASE_URL } from '../../config/host';
import Svg, { Path, Circle, Line, Rect, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── TYPES ──────────────────────────────────────────────────────────

interface LabResult {
    test_name: string;
    value: string;
    unit: string | null;
    category: string;
    loinc_code: string | null;
    loinc_name: string | null;
    loinc_score: number | null;
}

interface OntologyData {
    patient: { name: string | null; age: string | null; sex: string | null; address: string | null } | null;
    visit: {
        admission_date: string | null; discharge_date: string | null;
        consultant: string | null; department: string | null;
    } | null;
    diagnosis: string | null;
    clinical_summary: string | null;
    course_in_hospital: string | null;
    vitals: { blood_pressure?: string; pulse_rate?: string; spo2_percent?: string };
    lab_results: LabResult[];
    medications: { name: string; form: string; dosage_schedule?: any; volume?: string }[];
    billing: { bill_no?: string; total?: number; items?: any[] } | null;
    advice: string | null;
}

// ─── REFERENCE RANGES for common lab tests ──────────────────────────
interface RefRange {
    min: number; max: number; normalLow: number; normalHigh: number;
    icon: keyof typeof Ionicons.glyphMap; iconColor: string;
    desc?: string; danger?: string;
}

const REF_RANGES: Record<string, RefRange> = {
    // ─── Haematology ───
    'haemoglobin': { min: 5, max: 20, normalLow: 12, normalHigh: 17.5, icon: 'water', iconColor: '#EF5350' },
    'hemoglobin': { min: 5, max: 20, normalLow: 12, normalHigh: 17.5, icon: 'water', iconColor: '#EF5350' },
    'hb': { min: 5, max: 20, normalLow: 12, normalHigh: 17.5, icon: 'water', iconColor: '#EF5350' },
    'wbc': { min: 2000, max: 15000, normalLow: 4000, normalHigh: 11000, icon: 'ellipse-outline', iconColor: '#42A5F5' },
    'total wbc count': { min: 2000, max: 15000, normalLow: 4000, normalHigh: 11000, icon: 'ellipse-outline', iconColor: '#42A5F5' },
    'neutrophils': { min: 0, max: 100, normalLow: 40, normalHigh: 70, icon: 'ellipse', iconColor: '#66BB6A' },
    'lymphocyte': { min: 0, max: 100, normalLow: 20, normalHigh: 40, icon: 'ellipse', iconColor: '#AB47BC' },
    'lymphocytes': { min: 0, max: 100, normalLow: 20, normalHigh: 40, icon: 'ellipse', iconColor: '#AB47BC' },
    'eosinophils': { min: 0, max: 20, normalLow: 1, normalHigh: 6, icon: 'ellipse', iconColor: '#26A69A' },
    'monocytes': { min: 0, max: 15, normalLow: 2, normalHigh: 10, icon: 'ellipse', iconColor: '#78909C' },
    'basophils': { min: 0, max: 3, normalLow: 0, normalHigh: 1, icon: 'ellipse', iconColor: '#90A4AE' },
    'rbc': { min: 2, max: 7, normalLow: 4.0, normalHigh: 5.5, icon: 'ellipse', iconColor: '#EF5350' },
    'rbc count': { min: 2, max: 7, normalLow: 4.0, normalHigh: 5.5, icon: 'ellipse', iconColor: '#EF5350' },
    'platelet': { min: 50000, max: 500000, normalLow: 150000, normalHigh: 400000, icon: 'grid', iconColor: '#AB47BC' },
    'platelets': { min: 50000, max: 500000, normalLow: 150000, normalHigh: 400000, icon: 'grid', iconColor: '#AB47BC' },
    'pcv': { min: 20, max: 60, normalLow: 36, normalHigh: 50, icon: 'analytics', iconColor: '#5C6BC0' },
    'hematocrit': { min: 20, max: 60, normalLow: 36, normalHigh: 50, icon: 'analytics', iconColor: '#5C6BC0' },
    'mcv': { min: 50, max: 110, normalLow: 80, normalHigh: 100, icon: 'analytics', iconColor: '#7E57C2' },
    'mch': { min: 15, max: 40, normalLow: 27, normalHigh: 33, icon: 'analytics', iconColor: '#26C6DA' },
    'mchc': { min: 25, max: 40, normalLow: 32, normalHigh: 36, icon: 'analytics', iconColor: '#8D6E63' },
    'esr': { min: 0, max: 50, normalLow: 0, normalHigh: 20, icon: 'timer', iconColor: '#78909C' },
    // ─── Liver ───
    'bilirubin': { min: 0, max: 3, normalLow: 0.1, normalHigh: 1.0, icon: 'flask', iconColor: '#FFA726' },
    'total bilirubin': { min: 0, max: 3, normalLow: 0.1, normalHigh: 1.0, icon: 'flask', iconColor: '#FFA726' },
    'direct bilirubin': { min: 0, max: 1.5, normalLow: 0, normalHigh: 0.3, icon: 'flask', iconColor: '#FFA726' },
    'sgot': { min: 0, max: 100, normalLow: 5, normalHigh: 40, icon: 'flask', iconColor: '#78909C' },
    'scot': { min: 0, max: 100, normalLow: 5, normalHigh: 40, icon: 'flask', iconColor: '#78909C' },
    'ast': { min: 0, max: 100, normalLow: 5, normalHigh: 40, icon: 'flask', iconColor: '#78909C' },
    'sgpt': { min: 0, max: 100, normalLow: 7, normalHigh: 56, icon: 'flask', iconColor: '#78909C' },
    'alt': { min: 0, max: 100, normalLow: 7, normalHigh: 56, icon: 'flask', iconColor: '#78909C' },
    'alkaline phosphatase': { min: 20, max: 200, normalLow: 44, normalHigh: 147, icon: 'flask', iconColor: '#A1887F' },
    'alk phosphatase': { min: 20, max: 200, normalLow: 44, normalHigh: 147, icon: 'flask', iconColor: '#A1887F' },
    'ggt': { min: 0, max: 100, normalLow: 0, normalHigh: 45, icon: 'flask', iconColor: '#A1887F' },
    // ─── Protein ───
    'total protein': { min: 3, max: 10, normalLow: 6.0, normalHigh: 8.3, icon: 'nutrition', iconColor: '#4DB6AC' },
    'albumin': { min: 1, max: 6, normalLow: 3.5, normalHigh: 5.5, icon: 'nutrition', iconColor: '#4DB6AC' },
    'globulin': { min: 1, max: 5, normalLow: 2.0, normalHigh: 3.5, icon: 'nutrition', iconColor: '#4DB6AC' },
    // ─── Renal ───
    'creatinine': { min: 0.2, max: 5, normalLow: 0.7, normalHigh: 1.3, icon: 'flask', iconColor: '#7E57C2' },
    'urea': { min: 5, max: 80, normalLow: 7, normalHigh: 20, icon: 'flask', iconColor: '#5C6BC0' },
    'blood urea': { min: 5, max: 80, normalLow: 7, normalHigh: 20, icon: 'flask', iconColor: '#5C6BC0' },
    'bun': { min: 2, max: 40, normalLow: 6, normalHigh: 20, icon: 'flask', iconColor: '#5C6BC0' },
    'uric acid': { min: 1, max: 12, normalLow: 3.4, normalHigh: 7.0, icon: 'flask', iconColor: '#8D6E63' },
    // ─── Diabetic ───
    'fbs': { min: 40, max: 300, normalLow: 70, normalHigh: 100, icon: 'water', iconColor: '#4FC3F7' },
    'fasting glucose': { min: 40, max: 300, normalLow: 70, normalHigh: 100, icon: 'water', iconColor: '#4FC3F7' },
    'fasting blood sugar': { min: 40, max: 300, normalLow: 70, normalHigh: 100, icon: 'water', iconColor: '#4FC3F7' },
    'ppbs': { min: 40, max: 400, normalLow: 70, normalHigh: 140, icon: 'water', iconColor: '#4FC3F7' },
    'random blood sugar': { min: 40, max: 400, normalLow: 70, normalHigh: 200, icon: 'water', iconColor: '#4FC3F7' },
    'hba1c': { min: 3, max: 15, normalLow: 4, normalHigh: 5.7, icon: 'pulse', iconColor: '#EF5350' },
    'glycated hemoglobin': { min: 3, max: 15, normalLow: 4, normalHigh: 5.7, icon: 'pulse', iconColor: '#EF5350' },
    // ─── Lipid ───
    'cholesterol': { min: 100, max: 350, normalLow: 125, normalHigh: 200, icon: 'pulse', iconColor: '#FFB74D' },
    'total cholesterol': { min: 100, max: 350, normalLow: 125, normalHigh: 200, icon: 'pulse', iconColor: '#FFB74D' },
    'hdl': { min: 20, max: 100, normalLow: 40, normalHigh: 60, icon: 'pulse', iconColor: '#66BB6A' },
    'ldl': { min: 40, max: 250, normalLow: 0, normalHigh: 100, icon: 'pulse', iconColor: '#EF5350' },
    'vldl': { min: 5, max: 60, normalLow: 2, normalHigh: 30, icon: 'pulse', iconColor: '#FFA726' },
    'triglycerides': { min: 30, max: 400, normalLow: 0, normalHigh: 150, icon: 'pulse', iconColor: '#FF7043' },
    // ─── Thyroid ───
    'tsh': { min: 0, max: 15, normalLow: 0.4, normalHigh: 4.0, icon: 'fitness', iconColor: '#26A69A' },
    't3': { min: 40, max: 300, normalLow: 80, normalHigh: 200, icon: 'fitness', iconColor: '#26A69A' },
    't4': { min: 2, max: 20, normalLow: 5, normalHigh: 12, icon: 'fitness', iconColor: '#26A69A' },
    // ─── Electrolytes ───
    'sodium': { min: 120, max: 160, normalLow: 136, normalHigh: 145, icon: 'water', iconColor: '#42A5F5' },
    'potassium': { min: 2, max: 7, normalLow: 3.5, normalHigh: 5.0, icon: 'water', iconColor: '#FFA726' },
    'calcium': { min: 6, max: 14, normalLow: 8.5, normalHigh: 10.5, icon: 'water', iconColor: '#66BB6A' },
    'chloride': { min: 80, max: 120, normalLow: 98, normalHigh: 106, icon: 'water', iconColor: '#26C6DA' },
    // ─── Other ───
    'spo2': { min: 80, max: 100, normalLow: 95, normalHigh: 100, icon: 'pulse', iconColor: '#42A5F5' },
    'pulse': { min: 40, max: 150, normalLow: 60, normalHigh: 100, icon: 'heart', iconColor: '#EF5350' },
    'iron': { min: 10, max: 300, normalLow: 60, normalHigh: 170, icon: 'flask', iconColor: '#8D6E63' },
    'ferritin': { min: 5, max: 500, normalLow: 20, normalHigh: 200, icon: 'flask', iconColor: '#8D6E63' },
    'vitamin d': { min: 5, max: 100, normalLow: 20, normalHigh: 50, icon: 'sunny', iconColor: '#FFA726' },
    'vitamin b12': { min: 100, max: 1000, normalLow: 200, normalHigh: 900, icon: 'flask', iconColor: '#EF5350' },
    'crp': { min: 0, max: 20, normalLow: 0, normalHigh: 3, icon: 'flask', iconColor: '#FF7043' },
};

// ─── Fuzzy matcher: finds ref range even for names like "Serum Creatinine" ──
function findRefRange(testName: string): RefRange | null {
    const key = testName.toLowerCase().trim();
    if (REF_RANGES[key]) return REF_RANGES[key];
    for (const [refKey, refVal] of Object.entries(REF_RANGES)) {
        if (key.includes(refKey) || refKey.includes(key)) return refVal;
    }
    const words = key.split(/[\s,\-\/]+/);
    for (const word of words) {
        if (word.length >= 3 && REF_RANGES[word]) return REF_RANGES[word];
    }
    return null;
}

// ─── Test descriptions & danger levels ──────────────────────────────
const TEST_INFO: Record<string, { desc: string; danger: string }> = {
    haemoglobin: { desc: 'A substance in your red blood cells that carries oxygen from your lungs to the rest of your body.', danger: 'Low: You may feel tired, weak, or short of breath (low blood). High: Your blood may become too thick, raising clot risk.' },
    hemoglobin: { desc: 'A substance in your red blood cells that carries oxygen from your lungs to the rest of your body.', danger: 'Low: You may feel tired, weak, or short of breath. High: Blood may become too thick.' },
    hb: { desc: 'Short for Hemoglobin — it carries oxygen in your blood.', danger: 'Low: Tiredness, weakness. High: Blood too thick.' },
    wbc: { desc: 'White blood cells are your body\'s soldiers — they fight off germs and infections.', danger: 'Low: Your body struggles to fight infections. High: Could mean an infection, swelling, or a blood disorder.' },
    neutrophils: { desc: 'The most common type of white blood cell. They rush to fight bacteria when you get sick.', danger: 'Low: Higher chance of catching infections. High: Usually means your body is fighting a bacterial infection.' },
    lymphocytes: { desc: 'White blood cells that remember past germs and fight viruses.', danger: 'Low: Weaker defence against illness. High: Could mean a viral infection or a blood-related issue.' },
    eosinophils: { desc: 'White blood cells that help with allergies and fight parasites (like worms).', danger: 'High: May point to allergies, asthma, or a parasitic infection.' },
    monocytes: { desc: 'Large white blood cells that clean up dead cells and germs in your body.', danger: 'High: Could mean a long-term infection or your immune system attacking your own body.' },
    basophils: { desc: 'The rarest white blood cell. They help trigger allergy responses.', danger: 'High: May indicate allergies or long-term swelling/inflammation.' },
    rbc: { desc: 'Red blood cells pick up oxygen in your lungs and deliver it to every part of your body.', danger: 'Low: You may feel tired and weak (low blood). High: Could mean you\'re dehydrated or have too many red cells.' },
    platelets: { desc: 'Tiny cell pieces that help your blood clot (stop bleeding) when you get a cut.', danger: 'Low: You may bleed or bruise easily. High: Risk of unwanted blood clots or stroke.' },
    pcv: { desc: 'Shows what percentage of your blood is made up of red blood cells.', danger: 'Low: Could mean low blood. High: Could mean dehydration or lung problems.' },
    hematocrit: { desc: 'Measures how much of your blood is red blood cells versus liquid.', danger: 'Low: Could mean low blood. High: May mean dehydration.' },
    mcv: { desc: 'Measures the average size of your red blood cells.', danger: 'Low: Could mean low iron. High: Could mean you\'re low on Vitamin B12 or folate.' },
    mch: { desc: 'Measures the average amount of oxygen-carrying substance in each red blood cell.', danger: 'Low: May mean iron deficiency. High: May mean larger-than-normal red cells.' },
    mchc: { desc: 'Measures how packed the oxygen-carrying substance is inside your red blood cells.', danger: 'Low: Red cells are paler than normal (low iron). High: Could indicate a red blood cell shape problem.' },
    esr: { desc: 'A simple test that checks how much swelling or inflammation is happening in your body.', danger: 'High: Could mean infection, an immune problem, or needs further checkup.' },
    bilirubin: { desc: 'A yellow substance your body makes when old red blood cells break down. Your liver cleans it out.', danger: 'High: Can cause yellowing of skin/eyes (jaundice), and may point to liver or bile duct problems.' },
    sgot: { desc: 'A chemical released into your blood when your liver or heart is stressed or damaged. Also called AST.', danger: 'High: Could mean liver damage, heart issues, or muscle injury.' },
    ast: { desc: 'A chemical that leaks into your blood when your liver or heart cells are hurt. Same as SGOT.', danger: 'High: Could mean liver or heart problems.' },
    sgpt: { desc: 'A chemical mainly found in your liver. When liver cells are damaged, it leaks into the blood. Also called ALT.', danger: 'High: Could mean liver swelling, fatty liver, or liver scarring.' },
    alt: { desc: 'A chemical from your liver. High levels mean your liver may be inflamed or damaged. Same as SGPT.', danger: 'High: Could mean liver inflammation or damage.' },
    'alkaline phosphatase': { desc: 'A chemical found in your liver, bones, and digestive system. Helps check liver and bone health.', danger: 'High: Could mean liver problems or bone disorders.' },
    ggt: { desc: 'A liver chemical that goes up when there are bile (digestive fluid) problems or heavy alcohol use.', danger: 'High: Could mean liver damage from alcohol or bile duct issues.' },
    albumin: { desc: 'An important protein made by your liver. It keeps the right amount of fluid in your blood vessels.', danger: 'Low: Could mean liver trouble, kidney issues, or poor nutrition.' },
    globulin: { desc: 'Proteins in your blood that include antibodies — your body\'s germ-fighting tools.', danger: 'Low: Weak defences against germs. High: Could mean long-term swelling in the body.' },
    creatinine: { desc: 'A waste product from your muscles. Your kidneys filter it out. Used to check if your kidneys are working well.', danger: 'High: Could mean your kidneys aren\'t filtering properly, or you\'re dehydrated.' },
    urea: { desc: 'A waste substance made when your body breaks down protein. Your kidneys remove it.', danger: 'High: Could mean kidney problems, dehydration, or a very high-protein diet.' },
    bun: { desc: 'Measures a waste product in your blood to check how well your kidneys are working.', danger: 'High: Could mean kidney problems or internal bleeding. Low: Could mean liver issues.' },
    'uric acid': { desc: 'A waste product your body makes when digesting certain foods. Your kidneys flush it out.', danger: 'High: Can cause joint pain (gout), kidney stones, or kidney problems.' },
    fbs: { desc: 'Your blood sugar level after not eating for 8 or more hours. Used to check for diabetes.', danger: 'High (>126): Likely diabetes. 100-125: At risk of diabetes. Low: Blood sugar dropped too much.' },
    ppbs: { desc: 'Your blood sugar level checked 2 hours after eating a meal.', danger: 'High (>200): Likely diabetes. 140-200: At risk of diabetes.' },
    hba1c: { desc: 'Shows your average blood sugar over the last 3 months. Great for tracking diabetes control.', danger: '>5.7%: At risk of diabetes. >6.5%: Likely diabetes. Diabetics should aim for <7%.' },
    cholesterol: { desc: 'A fatty substance in your blood. Your body needs some, but too much can block your blood vessels.', danger: 'High (>240): Much higher risk of heart problems.' },
    hdl: { desc: '"Good" cholesterol — it helps remove bad cholesterol from your blood vessels and keeps them clean.', danger: 'Low (<40): Higher risk of heart disease. Higher is better!' },
    ldl: { desc: '"Bad" cholesterol — too much of it sticks to the walls of your blood vessels and can block them.', danger: 'High (>130): Can clog blood vessels, raising heart attack risk.' },
    vldl: { desc: 'A type of "bad" cholesterol that carries fat through your blood.', danger: 'High: Increases your risk of heart disease.' },
    triglycerides: { desc: 'A type of fat in your blood that comes from food. Your body stores it for energy.', danger: 'High (>200): Can lead to heart disease or cause belly-area organ inflammation.' },
    tsh: { desc: 'A hormone from your brain that tells your thyroid gland (in your neck) how fast to work.', danger: 'High: Thyroid is too slow (you may feel tired, cold, gain weight). Low: Thyroid is too fast (you may feel anxious, lose weight).' },
    t3: { desc: 'A hormone made by your thyroid gland that controls how fast your body burns energy.', danger: 'High: Thyroid is overactive. Low: Thyroid is underactive.' },
    t4: { desc: 'A hormone from your thyroid that gets converted into the active form (T3) to control your energy.', danger: 'High: Thyroid is overactive. Low: Thyroid is underactive.' },
    sodium: { desc: 'A mineral in your blood that helps your nerves and muscles work properly and keeps fluid levels balanced.', danger: 'Low: Can cause confusion or seizures. High: Could mean dehydration or high blood pressure.' },
    potassium: { desc: 'A mineral that keeps your heart beating steadily and helps your muscles work.', danger: 'Low: Weakness, cramps, irregular heartbeat. High: Can be dangerous for your heart.' },
    calcium: { desc: 'A mineral that keeps your bones and teeth strong, and helps your muscles and nerves work.', danger: 'Low: Numbness, muscle cramps. High: Kidney stones, confusion.' },
    chloride: { desc: 'A mineral that helps keep the right amount of fluid in your body and keeps your blood\'s chemistry balanced.', danger: 'Abnormal: May point to dehydration, kidney problems, or body chemistry issues.' },
    iron: { desc: 'A mineral your body needs to carry oxygen in your blood. Without enough, you feel tired.', danger: 'Low: Tiredness and weakness from low iron. High: Can damage your organs over time.' },
    ferritin: { desc: 'A protein that stores iron in your body. It shows how much iron your body has saved up.', danger: 'Low: Running low on iron. High: Too much iron stored, or swelling in the body.' },
    'vitamin d': { desc: 'The "sunshine vitamin." It keeps your bones strong, boosts your immune system, and helps your mood.', danger: 'Low (<20): Weak bones, tiredness, feeling down.' },
    'vitamin b12': { desc: 'A vitamin your body needs for healthy nerves and to make red blood cells.', danger: 'Low: Can cause nerve tingling, weakness, and extreme tiredness.' },
    crp: { desc: 'A substance your liver makes when there is swelling or inflammation somewhere in your body.', danger: 'High: Could mean infection, immune system issues, or higher heart risk.' },
    spo2: { desc: 'Shows how much oxygen your blood is carrying. A healthy person usually has 95-100%.', danger: 'Below 95%: Not enough oxygen. Below 90%: Needs immediate medical attention.' },
};

function findTestInfo(testName: string): { desc: string; danger: string } | null {
    const key = testName.toLowerCase().trim();
    if (TEST_INFO[key]) return TEST_INFO[key];
    for (const [k, v] of Object.entries(TEST_INFO)) {
        if (key.includes(k) || k.includes(key)) return v;
    }
    const words = key.split(/[\s,\-\/]+/);
    for (const word of words) {
        if (word.length >= 3 && TEST_INFO[word]) return TEST_INFO[word];
    }
    return null;
}

function getStatus(val: number, low: number, high: number): { status: 'good' | 'low' | 'high' | 'borderline'; label: string } {
    if (val < low) return { status: 'low', label: 'Low' };
    if (val > high * 1.1) return { status: 'high', label: 'High' };
    if (val > high) return { status: 'borderline', label: 'Borderline' };
    return { status: 'good', label: 'Good' };
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    good: { bg: '#1B5E20', text: '#81C784' },
    low: { bg: '#E65100', text: '#FFB74D' },
    borderline: { bg: '#F57F17', text: '#FFF176' },
    high: { bg: '#B71C1C', text: '#EF9A9A' },
};

// ─── Fill color based on value position ───────────────────────────────
function getFillColors(value: number, normalLow: number, normalHigh: number): [string, string] {
    if (value < normalLow) return ['rgba(255,152,0,0.9)', 'rgba(255,183,77,0.7)'];         // orange (low)
    if (value > normalHigh * 1.1) return ['rgba(244,67,54,0.9)', 'rgba(239,154,154,0.7)']; // red (high)
    if (value > normalHigh) return ['rgba(255,193,7,0.9)', 'rgba(255,224,130,0.7)'];       // amber (borderline)
    return ['rgba(70,241,197,0.85)', 'rgba(0,184,148,0.65)'];                               // green (normal)
}

// ─── TRI-ZONE PROGRESS BAR ─────────────────────────────────────────
const ZonedProgressBar: React.FC<{
    value: number; min: number; max: number;
    normalLow: number; normalHigh: number;
    rangeLabel: string; currentLabel: string;
}> = ({ value, min, max, normalLow, normalHigh, rangeLabel, currentLabel }) => {
    const totalRange = max - min;
    const lowW = ((normalLow - min) / totalRange) * 100;
    const normW = ((normalHigh - normalLow) / totalRange) * 100;
    const highW = ((max - normalHigh) / totalRange) * 100;
    const fill = Math.max(0, Math.min(100, ((value - min) / totalRange) * 100));
    const fillColors = getFillColors(value, normalLow, normalHigh);

    return (
        <View style={{ marginTop: 14 }}>
            <View style={zs.track}>
                <View style={[zs.zoneLow, { width: `${lowW}%` }]} />
                <View style={[zs.zoneNorm, { width: `${normW}%` }]} />
                <View style={[zs.zoneHigh, { width: `${highW}%` }]} />
                <View style={[zs.fill, { width: `${fill}%` }]}>
                    <View
                        style={{ flex: 1, borderRadius: 10, backgroundColor: fillColors[0] }}
                    />
                </View>
                <View style={[zs.dot, { left: `${fill}%` }]} />
            </View>
            <Text style={zs.label}>Current: {currentLabel}  •  {rangeLabel}</Text>
        </View>
    );
};

const zs = StyleSheet.create({
    track: { height: 20, borderRadius: 10, flexDirection: 'row', overflow: 'hidden', position: 'relative' },
    zoneLow: { backgroundColor: 'rgba(255,152,0,0.25)' },
    zoneNorm: { backgroundColor: 'rgba(76,175,80,0.30)' },
    zoneHigh: { backgroundColor: 'rgba(244,67,54,0.25)' },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 10 },
    dot: {
        position: 'absolute', top: -2, width: 6, height: 24, borderRadius: 3,
        backgroundColor: '#FFF', marginLeft: -3,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
    },
    label: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8, letterSpacing: 0.2 },
});

// ─── LAB TREND CHART (SVG-based, compact) ────────────────────────────
interface LabHistoryPoint { date: string; value: number; unit: string }
type LabHistory = Record<string, LabHistoryPoint[]>;

const LabTrendChart: React.FC<{ history: LabHistory; tests: string[] }> = ({ history, tests }) => {
    const [selectedTest, setSelectedTest] = useState<string>(tests[0] || '');
    const points = history[selectedTest.toLowerCase()] || [];
    const reportCount = Object.values(history).reduce((max, arr) => Math.max(max, arr.length), 0);

    if (tests.length === 0) return null;

    // ── Chart dimensions ──
    const TOTAL_W = SCREEN_WIDTH - 72;   // container padding 20*2 + outer margin 16*2
    const TOTAL_H = 170;
    const PAD = { top: 24, bottom: 28, left: 36, right: 10 };
    const W = TOTAL_W - PAD.left - PAD.right;
    const H = TOTAL_H - PAD.top - PAD.bottom;

    const ref = findRefRange(selectedTest);
    const values = points.map(p => p.value);
    let dMin = values.length ? Math.min(...values) : 0;
    let dMax = values.length ? Math.max(...values) : 1;
    if (ref) { dMin = Math.min(dMin, ref.normalLow); dMax = Math.max(dMax, ref.normalHigh); }
    const pad = (dMax - dMin) * 0.15 || 0.5;
    dMin -= pad; dMax += pad;
    const range = dMax - dMin || 1;

    const toX = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * W : W / 2);
    const toY = (v: number) => PAD.top + H - ((v - dMin) / range) * H;

    const fmtTick = (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v >= 100 ? Math.round(v).toString() : Number(v.toFixed(1)).toString();
    const fmtDate = (ds: string) => {
        try {
            const d = new Date(ds);
            const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${m[d.getMonth()]} ${d.getDate()}`;
        } catch { return ds.slice(5, 10); }
    };

    // Y-axis ticks
    const yTicks = [dMin, dMin + range / 2, dMax];

    // Build SVG path
    const linePath = points.length >= 2
        ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ')
        : '';

    // Area fill path
    const areaPath = points.length >= 2
        ? linePath + ` L${toX(points.length - 1).toFixed(1)},${(PAD.top + H).toFixed(1)} L${toX(0).toFixed(1)},${(PAD.top + H).toFixed(1)} Z`
        : '';

    // Trend
    const firstVal = points.length >= 2 ? points[0].value : 0;
    const lastVal = points.length >= 2 ? points[points.length - 1].value : 0;
    const trendPct = firstVal !== 0 ? (((lastVal - firstVal) / firstVal) * 100) : 0;
    const trendImproved = ref
        ? Math.abs(lastVal - (ref.normalLow + ref.normalHigh) / 2) < Math.abs(firstVal - (ref.normalLow + ref.normalHigh) / 2)
        : trendPct < 0;
    const trendFlat = Math.abs(trendPct) < 0.5;

    return (
        <View style={trendStyles.container}>
            <Text style={trendStyles.sectionLabel}>TRENDS</Text>
            <Text style={trendStyles.title}>Trends – Last {reportCount} Reports</Text>

            {/* Test toggle chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12, maxHeight: 40 }}
                contentContainerStyle={{ paddingHorizontal: 0, gap: 8 }}
            >
                {tests.map(t => (
                    <TouchableOpacity
                        key={t}
                        style={[trendStyles.chip, selectedTest === t && trendStyles.chipActive]}
                        onPress={() => setSelectedTest(t)}
                    >
                        <Text style={[trendStyles.chipText, selectedTest === t && trendStyles.chipTextActive]}>
                            {t}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* SVG Chart */}
            {points.length >= 1 ? (
                <View style={{ height: TOTAL_H, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <Svg width={TOTAL_W} height={TOTAL_H}>
                        <Defs>
                            <SvgGrad id="areaFill" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor={theme.colors.accent} stopOpacity="0.25" />
                                <Stop offset="1" stopColor={theme.colors.accent} stopOpacity="0" />
                            </SvgGrad>
                        </Defs>

                        {/* Grid lines */}
                        {yTicks.map((tick, i) => (
                            <Line key={`g-${i}`}
                                x1={PAD.left} y1={toY(tick)} x2={PAD.left + W} y2={toY(tick)}
                                stroke="rgba(255,255,255,0.08)" strokeWidth={1}
                            />
                        ))}

                        {/* Y-axis line */}
                        <Line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + H}
                            stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

                        {/* X-axis line */}
                        <Line x1={PAD.left} y1={PAD.top + H} x2={PAD.left + W} y2={PAD.top + H}
                            stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

                        {/* Normal range band */}
                        {ref && (() => {
                            const nTop = toY(Math.min(ref.normalHigh, dMax));
                            const nBot = toY(Math.max(ref.normalLow, dMin));
                            const h = nBot - nTop;
                            if (h <= 0) return null;
                            return (
                                <Rect x={PAD.left} y={nTop} width={W} height={h}
                                    fill="rgba(76,175,80,0.08)" rx={3} />
                            );
                        })()}

                        {/* Area fill */}
                        {areaPath ? <Path d={areaPath} fill="url(#areaFill)" /> : null}

                        {/* Line */}
                        {linePath ? (
                            <Path d={linePath} fill="none" stroke={theme.colors.accent}
                                strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        ) : null}

                        {/* Dots */}
                        {points.map((p, i) => {
                            const cx = toX(i), cy = toY(p.value);
                            const dotColor = ref ? getFillColors(p.value, ref.normalLow, ref.normalHigh)[0] : theme.colors.accent;
                            const isLast = i === points.length - 1;
                            return (
                                <React.Fragment key={`dot-${i}`}>
                                    {isLast && <Circle cx={cx} cy={cy} r={8} fill={dotColor} opacity={0.15} />}
                                    <Circle cx={cx} cy={cy} r={isLast ? 5 : 4}
                                        fill={dotColor} stroke={theme.colors.bgCard} strokeWidth={2} />
                                </React.Fragment>
                            );
                        })}
                    </Svg>

                    {/* Y-axis text labels (RN Text for crisp rendering) */}
                    {yTicks.map((tick, i) => (
                        <Text key={`yl-${i}`} style={{
                            position: 'absolute', left: 0, top: toY(tick) - 7,
                            width: PAD.left - 4, textAlign: 'right',
                            fontSize: 10, color: theme.colors.textMuted, fontWeight: '500',
                        } as any}>{fmtTick(tick)}</Text>
                    ))}

                    {/* Value labels above dots */}
                    {points.map((p, i) => {
                        const x = toX(i), y = toY(p.value);
                        const dotColor = ref ? getFillColors(p.value, ref.normalLow, ref.normalHigh)[0] : theme.colors.accent;
                        const isLast = i === points.length - 1;
                        return (
                            <View key={`vl-${i}`} style={{
                                position: 'absolute', left: x - 22, top: Math.max(2, y - 22),
                                width: 44, alignItems: 'center',
                            }}>
                                <View style={{
                                    backgroundColor: isLast ? dotColor + '30' : 'rgba(255,255,255,0.08)',
                                    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1,
                                }}>
                                    <Text style={{
                                        fontSize: 10, fontWeight: '700',
                                        color: isLast ? dotColor : theme.colors.text, textAlign: 'center',
                                    } as any}>{p.value}</Text>
                                </View>
                            </View>
                        );
                    })}

                    {/* X-axis date labels */}
                    {points.map((p, i) => (
                        <Text key={`xd-${i}`} style={{
                            position: 'absolute', left: toX(i) - 24, top: PAD.top + H + 6,
                            width: 48, textAlign: 'center',
                            fontSize: 9, color: theme.colors.textMuted,
                            fontWeight: i === points.length - 1 ? '600' : '400',
                        } as any}>{fmtDate(p.date)}</Text>
                    ))}

                    {/* Trend badge */}
                    {points.length >= 2 && !trendFlat && (
                        <View style={{
                            position: 'absolute', top: 4, right: 4,
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: trendImproved ? 'rgba(76,175,80,0.12)' : 'rgba(239,83,80,0.12)',
                            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
                        }}>
                            <Ionicons name={trendImproved ? 'trending-up' : 'trending-down'}
                                size={12} color={trendImproved ? '#4CAF50' : '#EF5350'} />
                            <Text style={{
                                fontSize: 10, fontWeight: '700', marginLeft: 3,
                                color: trendImproved ? '#4CAF50' : '#EF5350',
                            } as any}>
                                {trendImproved ? 'Improved' : 'Declined'}
                            </Text>
                        </View>
                    )}
                </View>
            ) : (
                <View style={{ height: 50, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                        No history data for this test.
                    </Text>
                </View>
            )}
        </View>
    );
};

const trendStyles = StyleSheet.create({
    container: {
        backgroundColor: theme.colors.bgCard, borderRadius: theme.borderRadius.m, padding: 16, marginBottom: 16,
        ...theme.shadow.card,
    },
    sectionLabel: {
        fontSize: 11, fontWeight: '600', color: theme.colors.textMuted,
        letterSpacing: 1.5, marginBottom: 4,
    } as any,
    title: { fontSize: 17, fontWeight: '800', color: theme.colors.text, marginBottom: 12 } as any,
    chip: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    chipText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' } as any,
    chipTextActive: { color: '#fff' },
});

// ─── MINI SPARKLINE (SVG-based, inline in each lab card) ─────────────
const SPARK_H = 110;

const MiniSparkline: React.FC<{ points: LabHistoryPoint[]; testName: string }> = ({ points, testName }) => {
    if (points.length < 2) return null;

    const ref = findRefRange(testName);
    const values = points.map(p => p.value);
    let dMin = Math.min(...values);
    let dMax = Math.max(...values);
    if (ref) { dMin = Math.min(dMin, ref.normalLow); dMax = Math.max(dMax, ref.normalHigh); }
    const pad = (dMax - dMin) * 0.15 || 0.5;
    dMin -= pad; dMax += pad;
    const range = dMax - dMin || 1;

    const TOTAL_W = SCREEN_WIDTH - 100;  // card padding
    const PAD = { top: 14, bottom: 20, left: 32, right: 8 };
    const W = TOTAL_W - PAD.left - PAD.right;
    const H = SPARK_H - PAD.top - PAD.bottom;

    const toX = (i: number) => PAD.left + (i / (points.length - 1)) * W;
    const toY = (v: number) => PAD.top + H - ((v - dMin) / range) * H;

    const fmtTick = (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v >= 100 ? Math.round(v).toString() : v.toFixed(1);

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');
    const yTicks = [dMin, dMin + range / 2, dMax];

    const firstVal = points[0].value;
    const lastVal = points[points.length - 1].value;
    const trendPct = firstVal !== 0 ? (((lastVal - firstVal) / firstVal) * 100) : 0;
    const trendUp = trendPct > 0;
    const trendFlat = Math.abs(trendPct) < 0.5;

    return (
        <View style={{ marginTop: 10, height: SPARK_H, borderRadius: 12, overflow: 'hidden' }}>
            <View
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, backgroundColor: 'rgba(0,201,167,0.03)' }}
            />

            <Svg width={TOTAL_W} height={SPARK_H}>
                {/* Grid lines */}
                {yTicks.map((tick, i) => (
                    <Line key={`sg-${i}`}
                        x1={PAD.left} y1={toY(tick)} x2={PAD.left + W} y2={toY(tick)}
                        stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                ))}

                {/* Axes */}
                <Line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + H}
                    stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                <Line x1={PAD.left} y1={PAD.top + H} x2={PAD.left + W} y2={PAD.top + H}
                    stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

                {/* Normal range */}
                {ref && (() => {
                    const nTop = toY(Math.min(ref.normalHigh, dMax));
                    const nBot = toY(Math.max(ref.normalLow, dMin));
                    const h = nBot - nTop;
                    if (h <= 0) return null;
                    return <Rect x={PAD.left} y={nTop} width={W} height={h} fill="rgba(76,175,80,0.08)" rx={3} />;
                })()}

                {/* Line */}
                <Path d={linePath} fill="none" stroke={theme.colors.accent}
                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />

                {/* Dots */}
                {points.map((p, i) => {
                    const cx = toX(i), cy = toY(p.value);
                    const dotColor = ref ? getFillColors(p.value, ref.normalLow, ref.normalHigh)[0] : theme.colors.accent;
                    const isLast = i === points.length - 1;
                    return (
                        <Circle key={`sd-${i}`} cx={cx} cy={cy} r={isLast ? 4 : 3}
                            fill={dotColor} stroke={theme.colors.bgCard} strokeWidth={1.5} />
                    );
                })}
            </Svg>

            {/* Y-axis labels */}
            {yTicks.map((tick, i) => (
                <Text key={`syl-${i}`} style={{
                    position: 'absolute', left: 2, top: toY(tick) - 6,
                    width: PAD.left - 4, textAlign: 'right',
                    fontSize: 9, color: theme.colors.textMuted, fontWeight: '500',
                } as any}>{fmtTick(tick)}</Text>
            ))}

            {/* X-axis date labels */}
            {points.map((p, i) => {
                const x = toX(i);
                let dateLabel = '';
                try {
                    const d = new Date(p.date);
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    dateLabel = `${months[d.getMonth()]} ${d.getDate()}`;
                } catch { dateLabel = (p.date || '').slice(5, 10); }
                return (
                    <Text key={`sxd-${i}`} style={{
                        position: 'absolute', left: x - 20, top: PAD.top + H + 4,
                        width: 40, textAlign: 'center',
                        fontSize: 8, color: theme.colors.textMuted,
                        fontWeight: i === points.length - 1 ? '600' : '400',
                    } as any}>{dateLabel}</Text>
                );
            })}

            {/* Trend badge */}
            {!trendFlat && (
                <View style={{
                    position: 'absolute', top: 2, right: 4,
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: trendUp ? 'rgba(239,83,80,0.12)' : 'rgba(76,175,80,0.12)',
                    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
                }}>
                    <Ionicons name={trendUp ? 'arrow-up' : 'arrow-down'} size={9} color={trendUp ? '#EF5350' : '#4CAF50'} />
                    <Text style={{ fontSize: 9, fontWeight: '700', marginLeft: 2, color: trendUp ? '#EF5350' : '#4CAF50' } as any}>
                        {Math.abs(trendPct).toFixed(1)}%
                    </Text>
                </View>
            )}
        </View>
    );
};



// ─── LAB RESULT CARD ────────────────────────────────────────────────
const LabCard: React.FC<{ lab: LabResult; onInfo: (name: string) => void }> = ({ lab, onInfo }) => {
    const ref = findRefRange(lab.test_name);
    const numVal = parseFloat(lab.value);
    const hasNum = !isNaN(numVal);
    const hasRef = ref && hasNum;

    const statusInfo = hasRef ? getStatus(numVal, ref.normalLow, ref.normalHigh) : null;
    const sc = statusInfo ? STATUS_COLORS[statusInfo.status] : null;
    const icon = ref?.icon || 'flask';
    const iconColor = ref?.iconColor || '#78909C';
    const info = findTestInfo(lab.test_name);

    // Generic bar: for values without a reference range, show a simple bar
    const genericFill = hasNum && !hasRef ? Math.min(100, Math.max(5, (numVal / (numVal * 2 || 100)) * 100)) : 0;

    return (
        <View style={cs.card}>
            <View style={cs.row}>
                <View style={cs.left}>
                    <View style={[cs.icon, { backgroundColor: iconColor + '20' }]}>
                        <Ionicons name={icon as any} size={20} color={iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={cs.name}>{lab.test_name}</Text>
                        {lab.category ? <Text style={cs.cat}>{lab.category}</Text> : null}
                    </View>
                </View>
                {info && (
                    <TouchableOpacity
                        style={{ padding: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' }}
                        onPress={() => onInfo(lab.test_name)}
                    >
                        <Ionicons name="information-circle-outline" size={22} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            <Text style={cs.big}>
                {lab.value} {lab.unit ? <Text style={cs.unit}>{lab.unit}</Text> : null}
            </Text>

            {hasRef && (
                <ZonedProgressBar
                    value={numVal} min={ref.min} max={ref.max}
                    normalLow={ref.normalLow} normalHigh={ref.normalHigh}
                    rangeLabel={`Normal: ${ref.normalLow}–${ref.normalHigh}`}
                    currentLabel={`${lab.value} ${lab.unit || ''}`}
                />
            )}

            {/* Generic simple bar for tests without a known reference range */}
            {hasNum && !hasRef && (
                <View style={{ marginTop: 14 }}>
                    <View style={{ height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <View
                            style={{ width: `${genericFill}%` as any, height: '100%', borderRadius: 8, backgroundColor: 'rgba(149,117,205,0.7)' }}
                        />
                    </View>
                    <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 6 }}>
                        Value: {lab.value} {lab.unit || ''}
                    </Text>
                </View>
            )}

            {sc && statusInfo && (
                <View style={[cs.pill, { backgroundColor: sc.bg }]}>
                    <Text style={[cs.pillT, { color: sc.text }]}>{statusInfo.label}</Text>
                </View>
            )}
        </View>
    );
};

const cs = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.bgCard, borderRadius: theme.borderRadius.m, padding: 20, marginBottom: 16,
        ...theme.shadow.card,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    icon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    name: { fontSize: 16, fontWeight: '700', color: theme.colors.text } as any,
    cat: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    big: { fontSize: 36, fontWeight: '800', color: theme.colors.text, marginTop: 12, letterSpacing: -1 } as any,
    unit: { fontSize: 16, fontWeight: '500', color: theme.colors.textMuted } as any,
    pill: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, marginTop: 14 },
    pillT: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 } as any,
    valueBadge: {
        backgroundColor: 'rgba(70,241,197,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    loincText: { fontSize: 10, fontWeight: '700', color: theme.colors.accent, letterSpacing: 0.5 } as any,
});

// ─── INFO CARD (generic) ────────────────────────────────────────────
const InfoCard: React.FC<{ title: string; icon: string; iconColor: string; children: React.ReactNode }> = ({
    title, icon, iconColor, children,
}) => (
    <View style={infoStyles.card}>
        <View style={infoStyles.header}>
            <View style={[infoStyles.iconCircle, { backgroundColor: iconColor + '20' }]}>
                <Ionicons name={icon as any} size={18} color={iconColor} />
            </View>
            <Text style={infoStyles.title}>{title}</Text>
        </View>
        {children}
    </View>
);

const InfoRow: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => {
    if (!value) return null;
    return (
        <View style={infoStyles.row}>
            <Text style={infoStyles.label}>{label}</Text>
            <Text style={infoStyles.value}>{value}</Text>
        </View>
    );
};

const infoStyles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.bgCard, borderRadius: theme.borderRadius.m, padding: 20, marginBottom: 16,
        ...theme.shadow.card,
    },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    iconCircle: { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    title: { fontSize: 17, fontWeight: '700', color: theme.colors.text } as any,
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    label: { fontSize: 14, color: theme.colors.textMuted },
    value: { fontSize: 14, fontWeight: '600', color: theme.colors.text } as any,
});

// ─── MAIN SCREEN ────────────────────────────────────────────────────
const ReportDetailScreen = ({ navigation, route }: any) => {
    const reportId = route?.params?.reportId;
    const reportDate = route?.params?.date ?? '';
    const reportScore = route?.params?.score;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<OntologyData | null>(null);
    const [infoVisible, setInfoVisible] = useState(false);
    const [infoName, setInfoName] = useState('');
    const [labHistory, setLabHistory] = useState<LabHistory>({});
    const [labHistoryTests, setLabHistoryTests] = useState<string[]>([]);

    const showInfo = useCallback((name: string) => {
        setInfoName(name);
        setInfoVisible(true);
    }, []);

    const fetchAnalysis = useCallback(async () => {
        if (!reportId) {
            setError('No report ID provided');
            setLoading(false);
            return;
        }
        try {
            setError(null);
            const res = await fetch(`${BASE_URL}/api/report/${reportId}/analysis`);
            if (res.status === 404) {
                setError('Report not found or not yet processed');
                return;
            }
            const json = await res.json();
            if (json.status === 'processing') {
                setError('Report is still being processed. Pull to refresh.');
                return;
            }
            if (json.status !== 'success') {
                setError('No analysis data available');
                return;
            }

            // Prefer ontology data if it has lab results
            const onto = json.ontology;
            const hasOntologyLabs = onto?.lab_results && onto.lab_results.length > 0;

            if (hasOntologyLabs) {
                setData(onto);
            } else if (json.extracted_data) {
                // Fallback: convert LLM extracted_data to OntologyData shape
                const ext = json.extracted_data;
                const clinical = ext?.clinical_data || {};
                const patientInfo = ext?.patient_info || {};

                // Convert LLM lab_reports to our LabResult format
                const labResults: LabResult[] = (clinical?.lab_reports || []).map((lr: any) => ({
                    test_name: lr.name || lr.test_name || 'Unknown',
                    value: String(lr.value ?? lr.result ?? ''),
                    unit: lr.unit || null,
                    category: lr.category || lr.section || 'Other',
                    loinc_code: null,
                    loinc_name: null,
                    loinc_score: null,
                }));

                // Convert LLM vitals 
                const vitalsArr = clinical?.vitals || [];
                const vitalsObj: any = {};
                for (const v of vitalsArr) {
                    const name = (v.name || '').toLowerCase();
                    if (name.includes('bp') || name.includes('blood pressure'))
                        vitalsObj.blood_pressure = String(v.value);
                    else if (name.includes('pulse') || name.includes('heart'))
                        vitalsObj.pulse_rate = String(v.value);
                    else if (name.includes('spo2') || name.includes('oxygen'))
                        vitalsObj.spo2_percent = String(v.value);
                }

                // Convert LLM medications
                const meds = (clinical?.medications || []).map((m: any) => ({
                    name: m.name || m.drug || '',
                    form: m.form || m.type || 'Tablet',
                    dosage_schedule: m.dosage_schedule || m.schedule || null,
                    volume: m.volume || null,
                }));

                const converted: OntologyData = {
                    patient: {
                        name: patientInfo.name || json.patient_name || null,
                        age: patientInfo.age || null,
                        sex: patientInfo.sex || patientInfo.gender || null,
                        address: patientInfo.address || null,
                    },
                    visit: onto?.visit || null,
                    diagnosis: clinical?.diagnosis?.[0] || onto?.diagnosis || null,
                    clinical_summary: onto?.clinical_summary || clinical?.summary || null,
                    course_in_hospital: onto?.course_in_hospital || null,
                    vitals: vitalsObj,
                    lab_results: labResults,
                    medications: meds,
                    billing: onto?.billing || null,
                    advice: onto?.advice || null,
                };
                console.log('ReportDetail: using LLM fallback, labs:', labResults.length, 'meds:', meds.length, 'vitals:', Object.keys(vitalsObj));
                setData(converted);
            } else if (onto) {
                // Ontology exists but no lab results — still show other sections
                setData(onto);
            } else {
                setError('No analysis data available');
            }
        } catch (e: any) {
            setError('Failed to load report data');
            console.error('ReportDetailScreen error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [reportId]);

    useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

    // Fetch lab history for trend chart
    useEffect(() => {
        (async () => {
            try {
                const userPhone = (await AsyncStorage.getItem('user_phone')) || '';
                console.log('LabHistory: user_phone =', JSON.stringify(userPhone));
                if (!userPhone) {
                    console.log('LabHistory: no user_phone, skipping');
                    return;
                }
                const url = `${BASE_URL}/api/lab-history/${userPhone}`;
                console.log('LabHistory: fetching', url);
                const res = await fetch(url);
                console.log('LabHistory: response status =', res.status);
                const json = await res.json();
                console.log('LabHistory: keys =', Object.keys(json), 'history keys =', json.history ? Object.keys(json.history) : 'none');
                if (json.status === 'success' && json.history) {
                    setLabHistory(json.history);
                    // Build unique test name list (only tests with 1+ data points)
                    const names = Object.keys(json.history).filter(k => json.history[k].length >= 1);
                    // Capitalize first letter of each word
                    const display = names.map(n => n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
                    setLabHistoryTests(display);
                    console.log('LabHistory: loaded', names.length, 'tests:', names.slice(0, 5));
                } else {
                    console.log('LabHistory: bad response:', JSON.stringify(json).slice(0, 200));
                }
            } catch (e: any) {
                console.log('LabHistory: FETCH ERROR:', e?.message || e);
            }
        })();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAnalysis();
    }, [fetchAnalysis]);

    // Valid units that indicate a measurable lab test
    const VALID_UNITS = /(%|mg|ml|g|dl|l\/|iu|u\/l|mmol|umol|meq|fl|pg|cells|mm|lakhs|thou|10|cumm)/i;

    // Filter: only show labs with numeric values AND valid units or a known ref range
    const filteredLabs = (data?.lab_results || []).filter((lab) => {
        const num = parseFloat(lab.value);
        if (isNaN(num)) return false;
        if (findRefRange(lab.test_name)) return true;
        const valStr = lab.value + ' ' + (lab.unit || '');
        return VALID_UNITS.test(valStr);
    });

    // Group filtered labs by category
    const groupedLabs = filteredLabs.reduce((acc, lab) => {
        const cat = lab.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(lab);
        return acc;
    }, {} as Record<string, LabResult[]>);

    // ── Loading state ──
    if (loading) {
        return (
            <GradientBackground style={{ flex: 1 }}>
                <StatusBar barStyle="light-content" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.accent} />
                    <Text style={{ marginTop: 16, color: theme.colors.textMuted }}>Analyzing report…</Text>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground style={{ flex: 1 }}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={hdr.bar}>
                <TouchableOpacity style={hdr.back} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={hdr.title} numberOfLines={1}>
                    {data?.patient?.name ? `Report – ${data.patient.name}` : `Report Details`}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={{ flex: 1, overflow: Platform.OS === 'web' ? 'hidden' as any : undefined }}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
                }
            >
                {/* Error */}
                {error && (
                    <View style={hdr.errorBanner}>
                        <Ionicons name="warning" size={16} color="#EF5350" />
                        <Text style={hdr.errorText}>{error}</Text>
                    </View>
                )}

                {data && (
                    <>
                        {/* ── Patient Info ── */}
                        {data.patient && (data.patient.name || data.patient.age) && (
                            <InfoCard title="Patient" icon="person" iconColor="#42A5F5">
                                <InfoRow label="Name" value={data.patient.name} />
                                <InfoRow label="Age" value={data.patient.age} />
                                <InfoRow label="Sex" value={data.patient.sex} />
                                <InfoRow label="Address" value={data.patient.address} />
                            </InfoCard>
                        )}

                        {/* ── Diagnosis ── */}
                        {data.diagnosis && (
                            <InfoCard title="Diagnosis" icon="medkit" iconColor="#EF5350">
                                <Text style={{ fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 }}>
                                    {data.diagnosis}
                                </Text>
                            </InfoCard>
                        )}

                        {/* ── Vitals ── */}
                        {data.vitals && Object.keys(data.vitals).length > 0 && (
                            <InfoCard title="Vitals" icon="heart" iconColor="#F06292">
                                <InfoRow label="Blood Pressure" value={data.vitals.blood_pressure} />
                                <InfoRow label="Pulse Rate" value={data.vitals.pulse_rate ? `${data.vitals.pulse_rate} bpm` : undefined} />
                                <InfoRow label="SpO2" value={data.vitals.spo2_percent ? `${data.vitals.spo2_percent}%` : undefined} />
                            </InfoCard>
                        )}

                        {/* ── Lab Trend Chart ── */}
                        {labHistoryTests.length > 0 && (
                            <LabTrendChart history={labHistory} tests={labHistoryTests} />
                        )}

                        {/* ── Lab Results (grouped by category) ── */}
                        {Object.entries(groupedLabs).map(([category, labs]) => (
                            <View key={category}>
                                <Text style={hdr.section}>{category.toUpperCase()}</Text>
                                {labs.map((lab, i) => (
                                    <LabCard key={`${lab.test_name}-${i}`} lab={lab} onInfo={showInfo} />
                                ))}
                            </View>
                        ))}

                        {/* ── Medications ── */}
                        {data.medications && data.medications.length > 0 && (
                            <InfoCard title="Medications" icon="medical" iconColor="#66BB6A">
                                {data.medications.map((med, i) => (
                                    <View key={i} style={{ paddingVertical: 6, borderBottomWidth: i < data.medications.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                                        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
                                            {med.form}. {med.name}
                                        </Text>
                                        {med.dosage_schedule && (
                                            <Text style={{ fontSize: 13, color: theme.colors.textMuted, marginTop: 2 }}>
                                                ({med.dosage_schedule.morning}-{med.dosage_schedule.afternoon}-{med.dosage_schedule.night})
                                            </Text>
                                        )}
                                        {med.volume && (
                                            <Text style={{ fontSize: 13, color: theme.colors.textMuted, marginTop: 2 }}>
                                                {med.volume}
                                            </Text>
                                        )}
                                    </View>
                                ))}
                            </InfoCard>
                        )}

                        {/* ── Billing ── */}
                        {data.billing && (
                            <InfoCard title="Billing" icon="receipt" iconColor="#FFA726">
                                <InfoRow label="Bill No" value={data.billing.bill_no} />
                                {data.billing.items?.map((item: any, i: number) => (
                                    <InfoRow key={i} label={item.description} value={`₹${item.amount?.toLocaleString()}`} />
                                ))}
                                {data.billing.total && (
                                    <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 8, paddingTop: 8 }}>
                                        <InfoRow label="Total" value={`₹${data.billing.total.toLocaleString()}`} />
                                    </View>
                                )}
                            </InfoCard>
                        )}

                        {/* ── Advice ── */}
                        {data.advice && (
                            <InfoCard title="Advice" icon="information-circle" iconColor="#26A69A">
                                <Text style={{ fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 }}>
                                    {data.advice}
                                </Text>
                            </InfoCard>
                        )}

                        {/* ── Clinical Summary ── */}
                        {data.clinical_summary && (
                            <InfoCard title="Clinical Summary" icon="document-text" iconColor="#5C6BC0">
                                <Text style={{ fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22 }}>
                                    {data.clinical_summary}
                                </Text>
                            </InfoCard>
                        )}
                    </>
                )}

                <View style={{ height: 30 }} />
            </ScrollView>
            </View>

            {/* ── Info Modal ── */}
            <Modal visible={infoVisible} transparent animationType="slide" onRequestClose={() => setInfoVisible(false)}>
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
                    activeOpacity={1}
                    onPress={() => setInfoVisible(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={{
                            backgroundColor: theme.colors.bgCard,
                            borderTopLeftRadius: 28, borderTopRightRadius: 28,
                            padding: 24, paddingBottom: 40,
                        }}
                    >
                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.textMuted, alignSelf: 'center', marginBottom: 20, opacity: 0.4 }} />
                        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 16 } as any}>
                            {infoName}
                        </Text>
                        {(() => {
                            const info = findTestInfo(infoName);
                            const ref = findRefRange(infoName);
                            if (!info) return null;
                            return (
                                <>
                                    <View style={{ backgroundColor: 'rgba(66,165,245,0.1)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                            <Ionicons name="information-circle" size={20} color="#42A5F5" />
                                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#42A5F5', marginLeft: 8 } as any}>What is this test?</Text>
                                        </View>
                                        <Text style={{ fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22 }}>
                                            {info.desc}
                                        </Text>
                                    </View>
                                    <View style={{ backgroundColor: 'rgba(239,83,80,0.1)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                            <Ionicons name="warning" size={20} color="#EF5350" />
                                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#EF5350', marginLeft: 8 } as any}>Danger Levels</Text>
                                        </View>
                                        <Text style={{ fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22 }}>
                                            {info.danger}
                                        </Text>
                                    </View>
                                    {ref && (
                                        <View style={{ backgroundColor: 'rgba(76,175,80,0.1)', borderRadius: 16, padding: 16 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                                <Ionicons name="checkmark-circle" size={20} color="#66BB6A" />
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#66BB6A', marginLeft: 8 } as any}>Normal Range</Text>
                                            </View>
                                            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text } as any}>
                                                {ref.normalLow} – {ref.normalHigh}
                                            </Text>
                                        </View>
                                    )}
                                </>
                            );
                        })()}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </GradientBackground>
    );
};

const hdr = StyleSheet.create({
    bar: {
        flexDirection: 'row', alignItems: 'center',
        paddingTop: 54, paddingHorizontal: 16, paddingBottom: 14,
    },
    back: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: theme.colors.bgCard, justifyContent: 'center', alignItems: 'center',
    },
    title: {
        flex: 1, textAlign: 'center',
        fontSize: 18, fontWeight: '700', color: theme.colors.text,
    } as any,
    section: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted, letterSpacing: 1.2, marginBottom: 14, marginTop: 8 } as any,
    errorBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(239,83,80,0.15)', padding: 14, borderRadius: 14, marginBottom: 16,
    },
    errorText: { fontSize: 14, color: '#EF5350', flex: 1 },
});

export default ReportDetailScreen;
