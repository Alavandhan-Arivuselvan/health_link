import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChapterData } from '../data/mockLessons';

const { width: SCREEN_W } = Dimensions.get('window');

interface LearningPathProps {
    chapters: ChapterData[];
    completedChapters: string[];
    onChapterPress: (chapter: ChapterData) => void;
}

const NODE_SIZE = 64;
const CONTAINER_PADDING = 32;
const AVAILABLE_WIDTH = SCREEN_W - CONTAINER_PADDING * 2;

const LearningPath: React.FC<LearningPathProps> = ({ chapters, completedChapters, onChapterPress }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Your Learning Journey</Text>
            <Text style={styles.sectionSub}>
                {completedChapters.length}/{chapters.length} chapters completed
            </Text>

            <View style={styles.pathContainer}>
                {chapters.map((chapter, index) => {
                    const isCompleted = completedChapters.includes(chapter.id);
                    const previousCompleted = index === 0 || completedChapters.includes(chapters[index - 1].id);
                    const isCurrent = !isCompleted && previousCompleted;

                    // Zigzag: alternate left and right, keeping nodes on screen
                    const isLeft = index % 2 === 0;
                    const nodeX = isLeft ? AVAILABLE_WIDTH * 0.15 : AVAILABLE_WIDTH * 0.50;

                    return (
                        <View key={chapter.id}>
                            {/* Dashed connector line */}
                            {index > 0 && (
                                <View style={styles.connectorWrap}>
                                    <View style={[
                                        styles.connectorLine,
                                        {
                                            borderColor: isCompleted || isCurrent ? '#00C9A7' : '#30363D',
                                            alignSelf: isLeft ? 'flex-start' : 'flex-end',
                                            marginLeft: isLeft ? nodeX + NODE_SIZE / 2 : undefined,
                                            marginRight: !isLeft ? AVAILABLE_WIDTH - nodeX - NODE_SIZE / 2 : undefined,
                                            width: Math.abs(AVAILABLE_WIDTH * 0.35),
                                            transform: [{ rotate: isLeft ? '-30deg' : '30deg' }],
                                        },
                                    ]} />
                                </View>
                            )}

                            {/* Node Row */}
                            <View style={[styles.nodeRow, { paddingLeft: nodeX }]}>
                                <ChapterNode
                                    chapter={chapter}
                                    isCompleted={isCompleted}
                                    isCurrent={isCurrent}
                                    onPress={() => onChapterPress(chapter)}
                                />
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

// ─── CHAPTER NODE (no Animated API) ──────────────────────────────────
interface ChapterNodeProps {
    chapter: ChapterData;
    isCompleted: boolean;
    isCurrent: boolean;
    onPress: () => void;
}

const ChapterNode: React.FC<ChapterNodeProps> = ({ chapter, isCompleted, isCurrent, onPress }) => {
    const nodeColor = isCompleted
        ? '#22c55e'
        : isCurrent
            ? chapter.color
            : '#30363D';

    const glowColor = isCompleted
        ? 'rgba(34,197,94,0.3)'
        : isCurrent
            ? chapter.color + '40'
            : 'transparent';

    return (
        <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
                style={[
                    styles.nodeOuter,
                    {
                        borderColor: nodeColor,
                        shadowColor: nodeColor,
                    },
                    isCurrent && styles.nodeCurrentPulse,
                ]}
                activeOpacity={0.7}
                onPress={onPress}
                disabled={!isCompleted && !isCurrent}
            >
                <View style={[styles.nodeGlow, { backgroundColor: glowColor }]} />
                <View style={[styles.nodeInner, { backgroundColor: nodeColor + '20' }]}>
                    {isCompleted ? (
                        <Ionicons name="checkmark" size={28} color="#22c55e" />
                    ) : (
                        <Ionicons
                            name={chapter.icon as any}
                            size={24}
                            color={isCurrent ? chapter.color : '#484F58'}
                        />
                    )}
                </View>
            </TouchableOpacity>

            {/* Label below node */}
            <View style={styles.nodeLabel}>
                <Text
                    style={[
                        styles.nodeLabelTitle,
                        { color: isCompleted ? '#22c55e' : isCurrent ? '#E6EDF3' : '#484F58' },
                    ]}
                    numberOfLines={2}
                >
                    {chapter.title}
                </Text>
                <Text style={styles.nodeLabelSub} numberOfLines={1}>
                    {isCompleted
                        ? '✓ Completed'
                        : isCurrent
                            ? `+${chapter.xpReward} XP`
                            : 'Complete previous first'}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#E6EDF3',
        marginBottom: 4,
    },
    sectionSub: {
        fontSize: 13,
        color: '#8B949E',
        marginBottom: 24,
    },
    pathContainer: {
        overflow: 'hidden',
    },
    connectorWrap: {
        height: 32,
        justifyContent: 'center',
    },
    connectorLine: {
        height: 0,
        borderWidth: 1.5,
        borderStyle: 'dashed',
    },
    nodeRow: {
        flexDirection: 'row',
    },
    nodeOuter: {
        width: NODE_SIZE,
        height: NODE_SIZE,
        borderRadius: NODE_SIZE / 2,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8,
    },
    nodeCurrentPulse: {
        // On native this won't animate, but the glow + shadow gives visual emphasis
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 12,
    },
    nodeGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: NODE_SIZE / 2,
    },
    nodeInner: {
        width: NODE_SIZE - 10,
        height: NODE_SIZE - 10,
        borderRadius: (NODE_SIZE - 10) / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nodeLabel: {
        alignItems: 'center',
        marginTop: 8,
        width: 120,
    },
    nodeLabelTitle: {
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
    nodeLabelSub: {
        fontSize: 10,
        color: '#8B949E',
        textAlign: 'center',
        marginTop: 2,
    },
});

export default LearningPath;
