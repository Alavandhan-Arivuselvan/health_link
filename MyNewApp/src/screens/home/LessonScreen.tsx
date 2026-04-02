import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ScrollView,
    StatusBar,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getChapterData, Slide, QuizQuestion } from '../../data/mockLessons';
import { completeChapter } from '../../services/learningStore';
import { theme } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');

type Phase = 'slides' | 'quiz' | 'score';

const LessonScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const chapterId = route.params?.chapterId as string;
    const chapter = getChapterData(chapterId);

    const [phase, setPhase] = useState<Phase>('slides');
    const [currentSlide, setCurrentSlide] = useState(0);
    const [currentQuiz, setCurrentQuiz] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [score, setScore] = useState(0);
    const [quizAnswered, setQuizAnswered] = useState(false);
    const [xpEarned, setXpEarned] = useState(0);
    const [visible, setVisible] = useState(true);

    if (!chapter) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.colors.text }}>Chapter not found</Text>
            </SafeAreaView>
        );
    }

    const totalSlides = chapter.slides.length;
    const totalQuiz = chapter.quiz.length;
    const totalSteps = totalSlides + totalQuiz;
    const currentStep = phase === 'slides'
        ? currentSlide
        : phase === 'quiz'
            ? totalSlides + currentQuiz
            : totalSteps;

    const handleNextSlide = () => {
        setVisible(false);
        setTimeout(() => {
            if (currentSlide < totalSlides - 1) {
                setCurrentSlide(currentSlide + 1);
            } else {
                setPhase('quiz');
            }
            setVisible(true);
        }, 100);
    };

    const handleSelectAnswer = (index: number) => {
        if (quizAnswered) return;
        setSelectedAnswer(index);
        setQuizAnswered(true);
        if (index === chapter.quiz[currentQuiz].correctIndex) {
            setScore((s) => s + 1);
        }
    };

    const handleNextQuiz = () => {
        if (currentQuiz < totalQuiz - 1) {
            setVisible(false);
            setTimeout(() => {
                setCurrentQuiz(currentQuiz + 1);
                setSelectedAnswer(null);
                setQuizAnswered(false);
                setVisible(true);
            }, 100);
        } else {
            // Quiz finished — compute final score
            const lastCorrect = selectedAnswer === chapter.quiz[currentQuiz].correctIndex ? 1 : 0;
            const finalScore = score + lastCorrect;
            const earned = chapter.xpReward;
            setXpEarned(earned);
            setScore(finalScore);
            completeChapter(chapter.id, finalScore, totalQuiz, earned);
            setPhase('score');
        }
    };

    const handleGoHome = () => {
        navigation.goBack();
    };

    // ─── RENDER SLIDE ─────────────────────────────────────────────
    const renderSlide = (slide: Slide) => (
        <View style={[styles.slideCard, { opacity: visible ? 1 : 0 }]}>
            <View style={[styles.slideIconWrap, { backgroundColor: (slide.color || chapter.color) + '20' }]}>
                <Ionicons name={slide.icon as any} size={48} color={slide.color || chapter.color} />
            </View>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideContent}>{slide.content}</Text>
        </View>
    );

    // ─── RENDER QUIZ ──────────────────────────────────────────────
    const renderQuiz = (q: QuizQuestion) => (
        <View style={[styles.quizCard, { opacity: visible ? 1 : 0 }]}>
            <View style={styles.quizHeader}>
                <Ionicons name="help-circle" size={28} color="#f59e0b" />
                <Text style={styles.quizLabel}>QUESTION {currentQuiz + 1}/{totalQuiz}</Text>
            </View>
            <Text style={styles.quizQuestion}>{q.question}</Text>

            <View style={styles.optionsWrap}>
                {q.options.map((opt, i) => {
                    let optStyle = styles.optionDefault;
                    let optTextStyle = styles.optionTextDefault;

                    if (quizAnswered) {
                        if (i === q.correctIndex) {
                            optStyle = styles.optionCorrect;
                            optTextStyle = styles.optionTextCorrect;
                        } else if (i === selectedAnswer && i !== q.correctIndex) {
                            optStyle = styles.optionWrong;
                            optTextStyle = styles.optionTextWrong;
                        }
                    } else if (i === selectedAnswer) {
                        optStyle = styles.optionSelected;
                    }

                    return (
                        <TouchableOpacity
                            key={i}
                            style={[styles.optionBtn, optStyle]}
                            onPress={() => handleSelectAnswer(i)}
                            activeOpacity={0.7}
                            disabled={quizAnswered}
                        >
                            <View style={[styles.optionLetterWrap, quizAnswered && i === q.correctIndex ? styles.optionLetterCorrect : quizAnswered && i === selectedAnswer && i !== q.correctIndex ? styles.optionLetterWrong : null]}>
                                <Text style={[styles.optionLetter, optTextStyle]}>
                                    {String.fromCharCode(65 + i)}
                                </Text>
                            </View>
                            <Text style={[styles.optionText, optTextStyle]} numberOfLines={3}>{opt}</Text>
                            {quizAnswered && i === q.correctIndex && (
                                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                            )}
                            {quizAnswered && i === selectedAnswer && i !== q.correctIndex && (
                                <Ionicons name="close-circle" size={20} color="#EF5350" />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {quizAnswered && (
                <View style={styles.explanationBox}>
                    <Ionicons name="bulb" size={18} color="#f59e0b" />
                    <Text style={styles.explanationText}>{q.explanation}</Text>
                </View>
            )}
        </View>
    );

    // ─── RENDER SCORE ─────────────────────────────────────────────
    const renderScore = () => {
        const percentage = Math.round((score / totalQuiz) * 100);
        const emoji = percentage >= 80 ? '🎉' : percentage >= 50 ? '👏' : '💪';

        return (
            <View style={styles.scoreCard}>
                <Text style={styles.scoreEmoji}>{emoji}</Text>
                <Text style={styles.scoreTitle}>
                    {percentage >= 80 ? 'Excellent!' : percentage >= 50 ? 'Well Done!' : 'Keep Learning!'}
                </Text>

                <View style={styles.scoreCircle}>
                    <Text style={styles.scoreNumber}>{score}</Text>
                    <Text style={styles.scoreTotal}>/{totalQuiz}</Text>
                </View>

                <Text style={styles.scoreSubtitle}>Questions Correct</Text>

                <View style={styles.xpBadge}>
                    <Ionicons name="flash" size={20} color="#f59e0b" />
                    <Text style={styles.xpBadgeText}>+{xpEarned} XP earned!</Text>
                </View>

                <TouchableOpacity style={styles.homeBtn} onPress={handleGoHome} activeOpacity={0.8}>
                    <Ionicons name="home" size={20} color="#fff" />
                    <Text style={styles.homeBtnText}>Back to Home</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* ── TOP BAR ────────── */}
            {phase !== 'score' && (
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={handleGoHome} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                    </TouchableOpacity>

                    {/* Progress bar */}
                    <View style={styles.progressTrack}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    width: `${((currentStep + 1) / totalSteps) * 100}%` as any,
                                    backgroundColor: phase === 'quiz' ? '#f59e0b' : chapter.color,
                                },
                            ]}
                        />
                    </View>

                    <Text style={styles.stepText}>
                        {currentStep + 1}/{totalSteps}
                    </Text>
                </View>
            )}

            {/* ── CONTENT ────────── */}
            <ScrollView
                style={[styles.contentScroll, { overflow: 'auto' as any }]}
                contentContainerStyle={styles.contentWrap}
                showsVerticalScrollIndicator={false}
            >
                {phase === 'slides' && chapter.slides[currentSlide] && renderSlide(chapter.slides[currentSlide])}
                {phase === 'quiz' && chapter.quiz[currentQuiz] && renderQuiz(chapter.quiz[currentQuiz])}
                {phase === 'score' && renderScore()}
            </ScrollView>

            {/* ── BOTTOM ACTION — not absolute, sits in flex flow ────────── */}
            {phase !== 'score' && (
                <View style={styles.bottomBar}>
                    {phase === 'slides' && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: chapter.color }]}
                            onPress={handleNextSlide}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.actionBtnText}>
                                {currentSlide < totalSlides - 1 ? 'Continue' : 'Start Quiz'}
                            </Text>
                            <Ionicons
                                name={currentSlide < totalSlides - 1 ? 'arrow-forward' : 'school'}
                                size={20}
                                color="#fff"
                            />
                        </TouchableOpacity>
                    )}

                    {phase === 'quiz' && quizAnswered && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}
                            onPress={handleNextQuiz}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.actionBtnText}>
                                {currentQuiz < totalQuiz - 1 ? 'Next Question' : 'See Results'}
                            </Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}

                    {phase === 'quiz' && !quizAnswered && (
                        <View style={[styles.actionBtn, { backgroundColor: '#30363D' }]}>
                            <Text style={[styles.actionBtnText, { color: '#8B949E' }]}>
                                Select an answer above
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0D1117',
    },

    // Top bar
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#161B22',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressTrack: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#161B22',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    stepText: {
        fontSize: 12,
        color: '#8B949E',
        fontWeight: '600',
        width: 36,
        textAlign: 'right',
    },

    // Content
    contentScroll: {
        flex: 1,
    },
    contentWrap: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 120,
        justifyContent: 'center',
    },

    // Slide
    slideCard: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    slideIconWrap: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    slideTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#E6EDF3',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 28,
    },
    slideContent: {
        fontSize: 16,
        color: '#C9D1D9',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 8,
    },

    // Quiz
    quizCard: {
        paddingVertical: 10,
    },
    quizHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    quizLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#f59e0b',
        letterSpacing: 1,
    },
    quizQuestion: {
        fontSize: 20,
        fontWeight: '700',
        color: '#E6EDF3',
        lineHeight: 28,
        marginBottom: 24,
    },
    optionsWrap: {
        gap: 12,
    },
    optionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        gap: 12,
    },
    optionDefault: {
        backgroundColor: '#161B22',
        borderColor: '#30363D',
    },
    optionSelected: {
        backgroundColor: 'rgba(0,201,167,0.1)',
        borderColor: '#00C9A7',
    },
    optionCorrect: {
        backgroundColor: 'rgba(34,197,94,0.1)',
        borderColor: '#22c55e',
    },
    optionWrong: {
        backgroundColor: 'rgba(239,83,80,0.1)',
        borderColor: '#EF5350',
    },
    optionLetterWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#30363D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionLetterCorrect: {
        backgroundColor: 'rgba(34,197,94,0.25)',
    },
    optionLetterWrong: {
        backgroundColor: 'rgba(239,83,80,0.25)',
    },
    optionLetter: {
        color: '#8B949E',
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
    },
    optionText: {
        flex: 1,
        fontSize: 15,
        color: '#E6EDF3',
        fontWeight: '500',
    },
    optionTextDefault: {},
    optionTextCorrect: {
        color: '#22c55e',
    },
    optionTextWrong: {
        color: '#EF5350',
    },
    explanationBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginTop: 20,
        padding: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(245,158,11,0.08)',
        borderLeftWidth: 3,
        borderLeftColor: '#f59e0b',
    },
    explanationText: {
        flex: 1,
        fontSize: 14,
        color: '#C9D1D9',
        lineHeight: 20,
    },

    // Score
    scoreCard: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    scoreEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    scoreTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#E6EDF3',
        marginBottom: 24,
    },
    scoreCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#161B22',
        borderWidth: 4,
        borderColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 8,
    },
    scoreNumber: {
        fontSize: 40,
        fontWeight: '800',
        color: '#22c55e',
    },
    scoreTotal: {
        fontSize: 20,
        fontWeight: '600',
        color: '#8B949E',
        marginTop: 8,
    },
    scoreSubtitle: {
        fontSize: 14,
        color: '#8B949E',
        marginBottom: 24,
    },
    xpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(245,158,11,0.12)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        marginBottom: 32,
    },
    xpBadgeText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#f59e0b',
    },
    homeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#00C9A7',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 16,
    },
    homeBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

    // Bottom bar — positioned above the tab bar
    bottomBar: {
        position: 'absolute' as any,
        bottom: 96,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingBottom: 12,
        paddingTop: 12,
        backgroundColor: '#0D1117',
        borderTopWidth: 1,
        borderTopColor: '#21262D',
        zIndex: 10,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 16,
    },
    actionBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});

export default LessonScreen;
