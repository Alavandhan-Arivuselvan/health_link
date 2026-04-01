import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@healthlink_learning_state';

export interface LearningState {
    totalXP: number;
    streakDays: number;
    lastActiveDate: string | null;
    completedChapters: string[];
    completedQuizzes: Record<string, { score: number; total: number }>;
}

const defaultState: LearningState = {
    totalXP: 0,
    streakDays: 0,
    lastActiveDate: null,
    completedChapters: [],
    completedQuizzes: {},
};

export const getLearningState = async (): Promise<LearningState> => {
    try {
        const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
        if (jsonValue != null) {
            return JSON.parse(jsonValue);
        }
    } catch (e) {
        console.error('Failed to load learning state', e);
    }
    return defaultState;
};

export const saveLearningState = async (state: LearningState): Promise<void> => {
    try {
        const jsonValue = JSON.stringify(state);
        await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
    } catch (e) {
        console.error('Failed to save learning state', e);
    }
};

export const addXP = async (amount: number): Promise<LearningState> => {
    const state = await getLearningState();
    state.totalXP += amount;

    const today = new Date().toISOString().split('T')[0];
    if (state.lastActiveDate !== today) {
        if (state.lastActiveDate) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayString = yesterday.toISOString().split('T')[0];

            if (state.lastActiveDate === yesterdayString) {
                state.streakDays += 1;
            } else {
                state.streakDays = 1;
            }
        } else {
            state.streakDays = 1;
        }
        state.lastActiveDate = today;
    }

    await saveLearningState(state);
    return state;
};

export const completeChapter = async (
    chapterId: string,
    score: number,
    total: number,
    xpEarned: number
): Promise<LearningState> => {
    const state = await getLearningState();

    if (!state.completedChapters.includes(chapterId)) {
        state.completedChapters.push(chapterId);
    }

    const existingScore = state.completedQuizzes[chapterId]?.score || 0;
    if (score >= existingScore) {
        state.completedQuizzes[chapterId] = { score, total };
    }

    await saveLearningState(state);
    return await addXP(xpEarned);
};

export const resetLearningState = async (): Promise<LearningState> => {
    await saveLearningState(defaultState);
    return defaultState;
};
