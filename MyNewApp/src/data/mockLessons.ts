export interface Slide {
    id: string;
    title: string;
    content: string;
    icon: string;
    color?: string;
}

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

export interface ChapterData {
    id: string;
    title: string;
    subtitle: string;
    xpReward: number;
    icon: string;
    color: string;
    slides: Slide[];
    quiz: QuizQuestion[];
}

export const MOCK_CHAPTERS: ChapterData[] = [
    {
        id: 'intro',
        title: 'Welcome to HealthLink',
        subtitle: 'Learn how to use your data',
        xpReward: 50,
        icon: 'planet',
        color: '#00C9A7',
        slides: [
            {
                id: 's1',
                title: 'What is HealthLink?',
                content: 'HealthLink connects your wearable data (like steps) with your clinical medical reports to give you a complete picture of your health.',
                icon: 'analytics',
                color: '#00C9A7',
            },
            {
                id: 's2',
                title: 'How OCR Works',
                content: 'When you upload a lab report, our AI reads the text using OCR (Optical Character Recognition) and turns it into structured data automatically.',
                icon: 'scan',
                color: '#BA68C8',
            },
            {
                id: 's3',
                title: 'Your Knowledge Graph',
                content: 'We map your symptoms, tests, and medications into a "Knowledge Graph", finding hidden connections that even doctors might miss.',
                icon: 'cellular',
                color: '#4FC3F7',
            },
        ],
        quiz: [
            {
                id: 'q1',
                question: 'What does OCR stand for in HealthLink?',
                options: [
                    'Optical Character Recognition',
                    'Online Clinical Report',
                    'Optimal Care Routine',
                    'Overall Cardiovascular Record',
                ],
                correctIndex: 0,
                explanation: 'OCR reads text from images or PDFs so we can understand your paper reports.',
            },
            {
                id: 'q2',
                question: 'Which of the following creates a complete picture of your health?',
                options: [
                    'Only step counts',
                    'Only clinical reports',
                    'Wearable data + Clinical reports',
                    'Random guesses',
                ],
                correctIndex: 2,
                explanation: 'By combining wearable data and clinical records, HealthLink creates a comprehensive view of your health.',
            },
            {
                id: 'q3',
                question: 'What is the "Knowledge Graph" used for?',
                options: [
                    'Drawing pretty pictures',
                    'Mapping connections between your symptoms and tests',
                    'Tracking your daily steps',
                    'Monitoring your sleep',
                ],
                correctIndex: 1,
                explanation: 'The Knowledge Graph connects data points like symptoms, diagnoses, and medications to find insightful patterns.',
            },
        ],
    },
    {
        id: 'report-1',
        title: 'Understanding Your Blood Test',
        subtitle: 'Hemoglobin, Glucose & More',
        xpReward: 100,
        icon: 'water',
        color: '#EF5350',
        slides: [
            {
                id: 's1',
                title: 'Your Hemoglobin (Hb) is 14.5 g/dL',
                content: "Hemoglobin is a protein in red blood cells that carries oxygen to your body's organs and tissues. Your level is well within the normal range (12-17.5 g/dL).",
                icon: 'water',
                color: '#EF5350',
            },
            {
                id: 's2',
                title: 'Your Fasting Glucose is 88 mg/dL',
                content: 'Fasting blood sugar measures the amount of glucose (sugar) in your blood after fasting for 8-10 hours. Your levels indicate excellent insulin sensitivity (normal is < 100 mg/dL).',
                icon: 'cube',
                color: '#FFB74D',
            },
            {
                id: 's3',
                title: 'What does this mean together?',
                content: 'Normal glucose and hemoglobin mean your body is efficiently producing energy and transporting it effectively. Keeping up your daily 10,000 steps helps maintain this balance!',
                icon: 'fitness',
                color: '#00C9A7',
            },
        ],
        quiz: [
            {
                id: 'q1',
                question: 'What does Hemoglobin do?',
                options: [
                    'Breaks down sugar',
                    'Carries oxygen to tissues',
                    'Fights infections',
                    'Strengthens bones',
                ],
                correctIndex: 1,
                explanation: 'Hemoglobin acts like a delivery truck, carrying oxygen from your lungs to the rest of your body.',
            },
            {
                id: 'q2',
                question: 'Is a Fasting Glucose of 88 mg/dL considered normal?',
                options: [
                    'Yes, it is excellent',
                    'No, it is too low',
                    'No, it is too high',
                    'It depends on the time of day',
                ],
                correctIndex: 0,
                explanation: 'A normal fasting glucose sits comfortably between 70 and 100 mg/dL.',
            },
        ],
    },
];

export const getChapterData = (chapterId: string): ChapterData | undefined => {
    return MOCK_CHAPTERS.find((c) => c.id === chapterId);
};
